import Foundation

/// Decides where one recording splits into uploaded chunks. A port of
/// `apps/web/src/lib/meeting-capture/chunker.ts`: cut at the first quiet point once the chunk is
/// `minMs` long, and never later than `maxMs`.
public struct ChunkCutter: Sendable {
  public struct Limits: Sendable, Equatable {
    public var minMs: Double
    public var maxMs: Double
    public var quietMs: Double
    public var quietLevel: Double

    public init(minMs: Double, maxMs: Double, quietMs: Double, quietLevel: Double) {
      self.minMs = minMs
      self.maxMs = maxMs
      self.quietMs = quietMs
      self.quietLevel = quietLevel
    }

    public static let standard = Limits(minMs: 20_000, maxMs: 60_000, quietMs: 600, quietLevel: 0.02)
  }

  public let limits: Limits
  private var elapsedMs = 0.0
  private var quietForMs = 0.0

  public init(limits: Limits = .standard) {
    self.limits = limits
  }

  /// Feed one audio buffer: its RMS level (0 to 1) and its length in milliseconds. Returns true
  /// when the current chunk should end after this buffer; the next buffer starts a new chunk.
  public mutating func tick(level: Double, dtMs: Double) -> Bool {
    elapsedMs += dtMs
    quietForMs = level < limits.quietLevel ? quietForMs + dtMs : 0
    let cut = elapsedMs >= limits.maxMs || (elapsedMs >= limits.minMs && quietForMs >= limits.quietMs)
    if cut {
      elapsedMs = 0
      quietForMs = 0
    }
    return cut
  }

  /// Starts a new chunk without a cut (after an interruption closed the previous one).
  public mutating func reset() {
    elapsedMs = 0
    quietForMs = 0
  }
}
