import Foundation
import Testing

@testable import RakazoCore

private func tempDisk() -> CaptureDisk {
  CaptureDisk(
    root: FileManager.default.temporaryDirectory
      .appendingPathComponent("captures-\(UUID().uuidString)", isDirectory: true))
}

private func record(
  user: String = "user-a", base: String = "https://api.example.test", id: String = "cap-1"
) -> CaptureRecord {
  CaptureRecord(
    apiBase: base, userId: user, spaceId: "space-a", captureId: id, title: "Standup",
    startedAt: Date(timeIntervalSince1970: 1_000))
}

@Test func recordRoundTripsAndIsScopedByUserAndServer() throws {
  let disk = tempDisk()
  let mine = record()
  try disk.save(mine)
  try disk.save(record(user: "user-b", id: "cap-2"))
  try disk.save(record(base: "https://other.example.test", id: "cap-3"))
  #expect(disk.records(apiBase: mine.apiBase, userId: "user-a") == [mine])
  #expect(disk.records(apiBase: mine.apiBase, userId: "user-b").map(\.captureId) == ["cap-2"])
  #expect(try disk.folder(for: mine).path.contains("user-a") == false)
}

@Test func finishedChunksAreListedInSeqOrderAndPartsAreIgnored() throws {
  let disk = tempDisk()
  let rec = record()
  try disk.save(rec)
  for seq in [2, 0, 10, 1] {
    let part = try disk.partURL(rec, seq: seq, startMs: seq * 1000)
    try Data("a".utf8).write(to: part)
    if seq != 1 { try disk.finishChunk(rec, seq: seq, startMs: seq * 1000, endMs: seq * 1000 + 500) }
  }
  let chunks = disk.chunks(rec)
  #expect(chunks.map(\.seq) == [0, 2, 10])
  #expect(chunks.map(\.endMs) == [500, 2500, 10_500])
  #expect(chunks.allSatisfy { $0.track == "microphone" && $0.url.pathExtension == "m4a" })
}

@Test func recoveryDeletesLeftoverPartAndCountsItLost() throws {
  let disk = tempDisk()
  let rec = record()
  try disk.save(rec)
  try Data("a".utf8).write(to: disk.partURL(rec, seq: 0, startMs: 0))
  try disk.finishChunk(rec, seq: 0, startMs: 0, endMs: 1000)
  let leftover = try disk.partURL(rec, seq: 1, startMs: 1000)
  try Data("b".utf8).write(to: leftover)

  let recovered = try disk.recover(rec)
  #expect(recovered.lostChunks == 1)
  #expect(recovered.nextSeq == 2)
  #expect(!FileManager.default.fileExists(atPath: leftover.path))
  #expect(disk.chunks(rec).count == 1)
  #expect(disk.records(apiBase: rec.apiBase, userId: rec.userId) == [recovered])
  #expect(try disk.recover(recovered).lostChunks == 1)  // nothing left to count
}

@Test func recoveryKeepsTheLeftoverWhenTheCountCannotBeSaved() throws {
  let disk = tempDisk()
  let rec = record()
  try disk.save(rec)
  let leftover = try disk.partURL(rec, seq: 0, startMs: 0)
  try Data("half".utf8).write(to: leftover)
  // record.json can no longer be replaced: a non-empty folder stands in its place.
  let file = try disk.folder(for: rec).appendingPathComponent("record.json")
  try FileManager.default.removeItem(at: file)
  try FileManager.default.createDirectory(
    at: file.appendingPathComponent("x"), withIntermediateDirectories: true)

  #expect(throws: (any Error).self) { try disk.recover(rec) }
  #expect(FileManager.default.fileExists(atPath: leftover.path))
}

@Test func wipeRemovesOnlyThatUsersCaptures() throws {
  let disk = tempDisk()
  let mine = record()
  let theirs = record(user: "user-b", id: "cap-2")
  try disk.save(mine)
  try disk.save(theirs)
  disk.wipe(apiBase: mine.apiBase, userId: "user-a")
  #expect(disk.records(apiBase: mine.apiBase, userId: "user-a").isEmpty)
  #expect(disk.records(apiBase: theirs.apiBase, userId: "user-b").count == 1)
}

@Test func captureIdCannotEscapeItsFolder() {
  #expect(throws: CaptureDiskError.invalidCaptureID) { try tempDisk().save(record(id: "../x")) }
}
