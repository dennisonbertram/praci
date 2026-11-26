import Accelerate
import AVFoundation
import Foundation
import RakazoCore

/// An audio buffer handed from the audio thread to the writer's queue.
struct SendableBuffer: @unchecked Sendable {
  // Reason: the buffer is written by its producer before this is created and only read afterwards.
  let buffer: AVAudioPCMBuffer
}

/// What a source reports to the recorder.
struct AudioSink: Sendable {
  let buffer: @Sendable (SendableBuffer) -> Void
  /// Audio stopped for a moment (interruption, route change): close the current chunk.
  let gap: @Sendable () -> Void
  /// The source cannot continue.
  let failed: @Sendable () -> Void
}

/// Where a recording's audio comes from: the microphone, or a file in tests and the demo.
@MainActor
protocol AudioSource: AnyObject {
  func start(_ sink: AudioSink) throws
  func stop()
}

/// Writes buffers into AAC chunk files and cuts them with a `ChunkCutter`. All state lives on one
/// serial queue. Chunk numbers live in memory only: after a crash the capture is finished, never
/// resumed, so only `lostChunks` is kept on disk.
final class ChunkWriter: @unchecked Sendable {
  // Reason: every stored property is touched only on `queue`.
  private let queue = DispatchQueue(label: "ai.praci.meeting-writer")
  private let disk: CaptureDisk
  private let record: CaptureRecord
  private let onChunk: @Sendable () -> Void
  private var cutter = ChunkCutter()
  private var file: AVAudioFile?
  private var seq = 0
  private var chunkStartMs = 0
  private var lastEndMs = 0
  private var frames: AVAudioFramePosition = 0
  private var sampleRate = 0.0
  private var skipMs = 0.0

  init(record: CaptureRecord, disk: CaptureDisk, onChunk: @escaping @Sendable () -> Void) {
    self.record = record
    self.disk = disk
    self.onChunk = onChunk
  }

  func append(_ box: SendableBuffer) { queue.async { self.write(box.buffer) } }
  func gap() { queue.async { self.close() } }
  /// Closes the open chunk and returns when it is on disk.
  func finish() { queue.sync { self.close() } }

  private func write(_ input: AVAudioPCMBuffer) {
    guard let buffer = Self.mono(input), buffer.frameLength > 0 else { return }
    let rate = buffer.format.sampleRate
    // After a failed chunk, skip a chunk's worth of audio before trying again, so one fault counts once.
    if skipMs > 0 {
      skipMs -= Double(buffer.frameLength) / rate * 1000
      return
    }
    if file != nil, rate != sampleRate { close() }
    if file == nil { open(rate: rate) }
    guard let file else { return }
    do {
      try file.write(from: buffer)
    } catch {
      lose()
      return
    }
    frames += AVAudioFramePosition(buffer.frameLength)
    var level: Float = 0
    vDSP_rmsqv(buffer.floatChannelData![0], 1, &level, vDSP_Length(buffer.frameLength))
    if cutter.tick(level: Double(level), dtMs: Double(buffer.frameLength) / rate * 1000) { close() }
  }

  private func open(rate: Double) {
    sampleRate = rate
    chunkStartMs = max(lastEndMs, Int(Date().timeIntervalSince(record.startedAt) * 1000))
    do {
      let url = try disk.partURL(record, seq: seq, startMs: chunkStartMs)
      var settings: [String: Any] = [
        // The container is named outright: the file's `.part` extension says nothing about it.
        AVAudioFileTypeKey: kAudioFileM4AType, AVFormatIDKey: kAudioFormatMPEG4AAC,
        AVSampleRateKey: rate, AVNumberOfChannelsKey: 1,
        AVEncoderBitRateKey: 64_000
      ]
      // Low-rate input (a Bluetooth headset at 16 kHz) cannot be encoded at 64 kbps; let the encoder choose.
      if rate < 32_000 { settings[AVEncoderBitRateKey] = nil }
      file = try AVAudioFile(
        forWriting: url, settings: settings, commonFormat: .pcmFormatFloat32, interleaved: false)
    } catch {
      lose()
    }
  }

  private func close() {
    cutter.reset()
    guard let open = file else { return }
    file = nil
    open.close()
    let used = seq
    seq += 1
    let length = frames
    frames = 0
    guard length > 0 else {
      if let part = try? disk.partURL(record, seq: used, startMs: chunkStartMs) {
        try? FileManager.default.removeItem(at: part)
      }
      return
    }
    let endMs = chunkStartMs + Int(Double(length) / sampleRate * 1000)
    guard (try? disk.finishChunk(record, seq: used, startMs: chunkStartMs, endMs: endMs)) != nil
    else { return countLost(seq: used) }
    lastEndMs = endMs
    onChunk()
  }

  /// A chunk that could not be written: forget it and tell finish the meeting is partial.
  private func lose() {
    let used = seq
    file = nil
    seq += 1
    frames = 0
    skipMs = ChunkCutter.Limits.standard.maxMs
    cutter.reset()
    countLost(seq: used)
  }

  private func countLost(seq used: Int) {
    if let part = try? disk.partURL(record, seq: used, startMs: chunkStartMs) {
      try? FileManager.default.removeItem(at: part)
    }
    // ponytail: read-modify-write; the uploader's own lostChunks save can race with this rare path.
    guard var saved = disk.records(apiBase: record.apiBase, userId: record.userId)
      .first(where: { $0.captureId == record.captureId })
    else { return }
    saved.lostChunks += 1
    try? disk.save(saved)
  }

  /// Channel 0 as a mono float buffer, whatever the source delivers.
  private static func mono(_ input: AVAudioPCMBuffer) -> AVAudioPCMBuffer? {
    let format = input.format
    if format.channelCount == 1, format.commonFormat == .pcmFormatFloat32, !format.isInterleaved {
      return input
    }
    guard let source = input.floatChannelData,
      let monoFormat = AVAudioFormat(
        commonFormat: .pcmFormatFloat32, sampleRate: format.sampleRate, channels: 1, interleaved: false),
      let output = AVAudioPCMBuffer(pcmFormat: monoFormat, frameCapacity: input.frameLength)
    else { return nil }
    output.frameLength = input.frameLength
    let stride = format.isInterleaved ? Int(format.channelCount) : 1
    let target = output.floatChannelData![0]
    for index in 0..<Int(input.frameLength) { target[index] = source[0][index * stride] }
    return output
  }
}

/// One recording on this device: an audio source feeding a chunk writer.
@MainActor
final class MeetingRecorder {
  private let writer: ChunkWriter
  private let source: any AudioSource
  private let onFailure: @MainActor () -> Void

  init(
    record: CaptureRecord, disk: CaptureDisk, source: any AudioSource,
    onChunk: @escaping @MainActor () -> Void, onFailure: @escaping @MainActor () -> Void
  ) {
    writer = ChunkWriter(record: record, disk: disk, onChunk: { Task { @MainActor in onChunk() } })
    self.source = source
    self.onFailure = onFailure
  }

  func start() throws {
    let writer = writer
    let onFailure = onFailure
    try source.start(
      AudioSink(
        buffer: { writer.append($0) }, gap: { writer.gap() },
        failed: { Task { @MainActor in onFailure() } }))
  }

  /// Stops the source and closes the open chunk.
  func stop() {
    source.stop()
    writer.finish()
  }
}

enum MicrophoneError: Error { case unavailable }

/// The device microphone through `AVAudioEngine`. Interruptions (calls, Siri), route changes and
/// media-service resets close the current chunk and start a new one; if the engine cannot come
/// back, the recorder is told so it can stop and keep what it has.
@MainActor
final class MicrophoneSource: AudioSource {
  private var engine = AVAudioEngine()
  private var sink: AudioSink?
  private var observers: [any NSObjectProtocol] = []

  func start(_ sink: AudioSink) throws {
    self.sink = sink
    try VoiceAudio.activateForMeeting()
    do {
      try run()
    } catch {
      VoiceAudio.deactivateForMeeting()
      throw error
    }
    observe()
  }

  func stop() {
    for observer in observers { NotificationCenter.default.removeObserver(observer) }
    observers = []
    engine.inputNode.removeTap(onBus: 0)
    engine.stop()
    sink = nil
    VoiceAudio.deactivateForMeeting()
  }

  private func run() throws {
    guard let sink else { return }
    let input = engine.inputNode
    let format = input.outputFormat(forBus: 0)
    guard format.sampleRate > 0, format.channelCount > 0 else { throw MicrophoneError.unavailable }
    input.removeTap(onBus: 0)
    input.installTap(onBus: 0, bufferSize: 4096, format: format) { buffer, _ in
      sink.buffer(SendableBuffer(buffer: buffer))
    }
    engine.prepare()
    try engine.start()
  }

  private func restart(newEngine: Bool = false) {
    guard let sink else { return }
    sink.gap()
    engine.inputNode.removeTap(onBus: 0)
    engine.stop()
    if newEngine { engine = AVAudioEngine() }
    do {
      try VoiceAudio.activateForMeeting()
      try run()
    } catch {
      sink.failed()
    }
  }

  private func observe() {
    let center = NotificationCenter.default
    /// The handler gets the notification's number (named by `key`) and its sender, never the notification itself.
    func add(
      _ name: Notification.Name, key: String? = nil,
      _ handler: @escaping @MainActor (_ raw: UInt?, _ sender: ObjectIdentifier?) -> Void
    ) {
      observers.append(
        center.addObserver(forName: name, object: nil, queue: .main) { note in
          let raw = key.flatMap { note.userInfo?[$0] as? UInt }
          let sender = note.object.map { ObjectIdentifier($0 as AnyObject) }
          MainActor.assumeIsolated { handler(raw, sender) }
        })
    }
    add(AVAudioSession.interruptionNotification, key: AVAudioSessionInterruptionTypeKey) { [weak self] raw, _ in
      switch raw.flatMap(AVAudioSession.InterruptionType.init(rawValue:)) {
      case .began: self?.sink?.gap()
      case .ended: self?.restart()
      default: break
      }
    }
    add(AVAudioSession.routeChangeNotification, key: AVAudioSessionRouteChangeReasonKey) { [weak self] raw, _ in
      if raw.flatMap(AVAudioSession.RouteChangeReason.init(rawValue:)) == .oldDeviceUnavailable {
        self?.restart()
      }
    }
    add(.AVAudioEngineConfigurationChange) { [weak self] _, sender in
      if let self, sender == ObjectIdentifier(engine) { restart() }
    }
    add(AVAudioSession.mediaServicesWereResetNotification) { [weak self] _, _ in
      self?.restart(newEngine: true)
    }
  }
}
