import Foundation
import Testing

@testable import RakazoCore

private actor ScriptedTransport: HTTPTransport {
  enum Step { case respond(Int, String), fail }
  private var steps: [Step]
  private(set) var requests: [HTTPRequest] = []

  init(_ steps: [Step]) { self.steps = steps }

  func send(_ request: HTTPRequest, maximumResponseBytes: Int) async throws -> HTTPResponse {
    requests.append(request)
    guard !steps.isEmpty else { return HTTPResponse(statusCode: 201) }
    switch steps.removeFirst() {
    case .respond(let status, let body): return HTTPResponse(statusCode: status, body: Data(body.utf8))
    case .fail: throw URLError(.notConnectedToInternet)
    }
  }
}

private struct Fixture {
  let disk: CaptureDisk
  let record: CaptureRecord

  init(chunks: Int = 3) throws {
    disk = CaptureDisk(
      root: FileManager.default.temporaryDirectory
        .appendingPathComponent("uploader-\(UUID().uuidString)", isDirectory: true))
    record = CaptureRecord(
      apiBase: "http://127.0.0.1:3301", userId: "user-a", spaceId: "space-9", captureId: "cap-1",
      startedAt: Date(timeIntervalSince1970: 0))
    try disk.save(record)
    for seq in 0..<chunks {
      try Data("chunk\(seq)".utf8).write(to: disk.partURL(record, seq: seq, startMs: seq * 1000))
      try disk.finishChunk(record, seq: seq, startMs: seq * 1000, endMs: seq * 1000 + 900)
    }
  }

  func uploader(
    _ transport: ScriptedTransport, unauthorized: RPCError = .stale
  ) -> ChunkUploader {
    ChunkUploader(
      transport: transport, disk: disk,
      authorize: { path, method, body, contentType, spaceID in
        var headers = ["authorization": "Bearer tok", "x-rakazo-space-id": spaceID ?? ""]
        if let contentType { headers["content-type"] = contentType }
        return AuthorizedRequest(
          request: HTTPRequest(
            url: URL(string: "http://127.0.0.1:3301\(path)")!, method: method, headers: headers,
            body: body),
          generation: 1, hadSpace: spaceID != nil)
      },
      handleUnauthorized: { _ in unauthorized })
  }

  var remaining: [Int] { disk.chunks(record).map(\.seq) }
  var lost: Int { disk.records(apiBase: record.apiBase, userId: record.userId)[0].lostChunks }
}

@Test func storedAndDuplicateChunksAreDeletedInOrderWithSpaceHeader() async throws {
  let fixture = try Fixture()
  let transport = ScriptedTransport([.respond(201, "{}"), .respond(200, "{}"), .respond(201, "{}")])
  let outcome = await fixture.uploader(transport).upload(fixture.record)
  #expect(outcome == .done)
  #expect(fixture.remaining.isEmpty)
  let requests = await transport.requests
  #expect(requests.count == 3)
  #expect(requests[0].url.absoluteString.hasPrefix("http://127.0.0.1:3301/api/meeting-captures/cap-1/chunks?"))
  let query = URLComponents(url: requests[1].url, resolvingAgainstBaseURL: false)!.queryItems!
  #expect(query.map { "\($0.name)=\($0.value!)" } == [
    "track=microphone", "seq=1", "startMs=1000", "endMs=1900",
  ])
  #expect(requests.allSatisfy { $0.headers["x-rakazo-space-id"] == "space-9" })
  #expect(requests[0].headers["content-type"] == "application/octet-stream")
  #expect(requests[0].body == Data("chunk0".utf8))
}

@Test(arguments: [500, 429, 401])
func retryableStatusKeepsThatChunkAndLaterOnesAndStops(status: Int) async throws {
  let fixture = try Fixture()
  let transport = ScriptedTransport([.respond(201, "{}"), .respond(status, "{}")])
  let outcome = await fixture.uploader(transport).upload(fixture.record)
  #expect(outcome == (status == 401 ? .unauthorized(.stale) : .retryLater))
  #expect(fixture.remaining == [1, 2])
  #expect(await transport.requests.count == 2)
}

@Test func networkFailureKeepsEverythingAndStops() async throws {
  let fixture = try Fixture()
  let transport = ScriptedTransport([.fail])
  #expect(await fixture.uploader(transport).upload(fixture.record) == .retryLater)
  #expect(fixture.remaining == [0, 1, 2])
  #expect(await transport.requests.count == 1)
}

@Test func chunkTheServerRefusesForGoodIsDroppedAndCountedLost() async throws {
  let fixture = try Fixture()
  let transport = ScriptedTransport([
    .respond(400, "{}"), .respond(413, "{}"),
    .respond(409, #"{"error":"Chunk already stored with other bytes"}"#),
  ])
  #expect(await fixture.uploader(transport).upload(fixture.record) == .done)
  #expect(fixture.remaining.isEmpty)
  #expect(fixture.lost == 3)
}

@Test func notFoundEndsTheCapture() async throws {
  let fixture = try Fixture()
  let transport = ScriptedTransport([.respond(404, "{}")])
  #expect(await fixture.uploader(transport).upload(fixture.record) == .ended(.notFound))
  #expect(await transport.requests.count == 1)
  #expect(fixture.remaining == [0, 1, 2])
}

@Test func otherConflictEndsTheCapture() async throws {
  let fixture = try Fixture()
  let transport = ScriptedTransport([.respond(409, #"{"error":"Capture is closed"}"#)])
  #expect(await fixture.uploader(transport).upload(fixture.record) == .ended(.closed))
  #expect(fixture.lost == 0)
}

@Test func rejectedSessionEndsAndStaleOneKeeps() async throws {
  let ended = try Fixture()
  let outcome = await ended.uploader(ScriptedTransport([.respond(401, "")]), unauthorized: .unauthorized)
    .upload(ended.record)
  #expect(outcome == .unauthorized(.ended))
  #expect(ended.remaining == [0, 1, 2])
}

@Test func finishRequestSendsLostChunksOnlyWhenAboveZero() async throws {
  let fixture = try Fixture(chunks: 0)
  let uploader = fixture.uploader(ScriptedTransport([]))
  func payload(_ record: CaptureRecord) async throws -> [String: Any] {
    let sent = try await uploader.finishRequest(record, endedAt: Date(timeIntervalSince1970: 0))
    #expect(sent.request.url.path == "/rpc/meetingCaptures/finish")
    #expect(sent.request.headers["x-rakazo-space-id"] == "space-9")
    let body = try JSONSerialization.jsonObject(with: sent.request.body!) as! [String: Any]
    return body["json"] as! [String: Any]
  }
  let clean = try await payload(fixture.record)
  #expect(clean["captureId"] as? String == "cap-1")
  #expect(clean["endedAt"] as? String == "1970-01-01T00:00:00.000Z")
  #expect(clean["lostChunks"] == nil)
  var lossy = fixture.record
  lossy.lostChunks = 2
  #expect(try await payload(lossy)["lostChunks"] as? Int == 2)
}
