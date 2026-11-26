import Testing

@testable import RakazoCore

/// Feeds `seconds` of constant `level` in 100 ms buffers; returns the elapsed ms at the first cut.
private func firstCut(_ cutter: inout ChunkCutter, level: Double, seconds: Double) -> Double? {
  var elapsed = 0.0
  while elapsed < seconds * 1000 {
    elapsed += 100
    if cutter.tick(level: level, dtMs: 100) { return elapsed }
  }
  return nil
}

@Test func chunkCutterNeverCutsBeforeTwentySecondsEvenWhenQuiet() {
  var cutter = ChunkCutter()
  let cut = firstCut(&cutter, level: 0, seconds: 19.9)
  #expect(cut == nil)
}

@Test func chunkCutterCutsAtFirstQuietPointAfterTwentySeconds() {
  var loud = ChunkCutter()
  let cut = firstCut(&loud, level: 0.3, seconds: 21)
  #expect(cut == nil)
  // 21 s of speech, then silence: cut once 600 ms of quiet has passed.
  var quiet = 0.0
  var quietCut: Double?
  while quietCut == nil, quiet < 2000 {
    quiet += 100
    if loud.tick(level: 0.001, dtMs: 100) { quietCut = quiet }
  }
  #expect(quietCut == 600)
}

@Test func chunkCutterQuietBelowSixHundredMsDoesNotCut() {
  var cutter = ChunkCutter()
  _ = firstCut(&cutter, level: 0.3, seconds: 21)
  let ticks = [
    cutter.tick(level: 0, dtMs: 500),
    cutter.tick(level: 0.3, dtMs: 100),  // speech resets the quiet clock
    cutter.tick(level: 0, dtMs: 500),
  ]
  #expect(ticks == [false, false, false])
}

@Test func chunkCutterHardCutsAtSixtySecondsThenStartsOver() {
  var cutter = ChunkCutter()
  let first = firstCut(&cutter, level: 0.3, seconds: 70)
  let second = firstCut(&cutter, level: 0.3, seconds: 70)
  #expect(first == 60_000)
  #expect(second == 60_000)
}
