#if DEBUG
  import AVFoundation
  import Foundation

  /// Debug builds only: plays a bundled recording into the recorder in real time instead of
  /// listening to the microphone. Launch with `-captureFixture meeting-fixture`.
  @MainActor
  final class FileAudioSource: AudioSource {
    static let launchKey = "captureFixture"

    private let name: String
    private var task: Task<Void, Never>?

    /// The bundled fixture named by the launch argument, if any.
    static func fromLaunchArguments() -> FileAudioSource? {
      UserDefaults.standard.string(forKey: launchKey).map { FileAudioSource(name: $0) }
    }

    init(name: String) { self.name = name }

    func start(_ sink: AudioSink) throws {
      guard let url = Bundle.main.url(forResource: name, withExtension: "m4a") else {
        throw MicrophoneError.unavailable
      }
      _ = try AVAudioFile(forReading: url)
      task = Task.detached {
        guard let file = try? AVAudioFile(forReading: url) else { return sink.failed() }
        let format = file.processingFormat
        let frames: AVAudioFrameCount = 4096
        while !Task.isCancelled, file.framePosition < file.length {
          guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames),
            (try? file.read(into: buffer, frameCount: frames)) != nil, buffer.frameLength > 0
          else { break }
          sink.buffer(SendableBuffer(buffer: buffer))
          try? await Task.sleep(for: .seconds(Double(buffer.frameLength) / format.sampleRate))
        }
        // After the file ends the recording stays open with silence, like a quiet room.
        while !Task.isCancelled {
          guard let quiet = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames) else { break }
          quiet.frameLength = frames
          for channel in 0..<Int(format.channelCount) {
            quiet.floatChannelData?[channel].update(repeating: 0, count: Int(frames))
          }
          sink.buffer(SendableBuffer(buffer: quiet))
          try? await Task.sleep(for: .seconds(Double(frames) / format.sampleRate))
        }
      }
    }

    func stop() {
      task?.cancel()
      task = nil
    }
  }
#endif
