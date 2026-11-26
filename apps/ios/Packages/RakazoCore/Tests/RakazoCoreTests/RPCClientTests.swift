import Foundation
import RakazoCore
import Testing

private let session = rpcResponse(#"{"user":{"id":"u1"}}"#)

private struct Me: Decodable, Equatable { let name: String }
private struct Echo: Encodable { let id: String }

@Test
func authorizedRequestCarriesBearerOriginContentTypeAndSpace() async throws {
  let client = try await signedInClient(FakeTransport([session]))
  let auth = try await client.authorized(
    path: "/rpc/me", method: "POST", body: Data("{}".utf8),
    contentType: "application/json", spaceID: "space-1")
  #expect(auth.request.url.absoluteString == "http://127.0.0.1:3301/rpc/me")
  #expect(auth.request.method == "POST")
  #expect(auth.request.headers["authorization"] == "Bearer tok-1")
  #expect(auth.request.headers["origin"] == "rakazo://")
  #expect(auth.request.headers["content-type"] == "application/json")
  #expect(auth.request.headers["x-rakazo-space-id"] == "space-1")
  #expect(auth.hadSpace)
  #expect(auth.generation == (await client.snapshot()).generation)

  let bare = try await client.authorized(
    path: "/rpc/me", method: "POST", body: nil, contentType: nil, spaceID: nil)
  #expect(bare.request.headers["x-rakazo-space-id"] == nil)
  #expect(bare.request.headers["content-type"] == nil)
  #expect(!bare.hadSpace)
}

@Test
func authorizedFailsWhenSignedOut() async throws {
  let client = AuthClient(
    endpoint: testEndpoint, storage: FakeStorage(), transport: FakeTransport([]))
  await #expect(throws: AuthClientError.unauthorized) {
    try await client.authorized(
      path: "/rpc/me", method: "POST", body: nil, contentType: nil, spaceID: nil)
  }
}

@Test
func unauthorizedWithoutSpaceSignsOut() async throws {
  let storage = FakeStorage()
  let client = try await signedInClient(FakeTransport([session]), storage: storage)
  let auth = try await client.authorized(
    path: "/rpc/me", method: "POST", body: nil, contentType: nil, spaceID: nil)
  let outcome = await client.handleUnauthorized(
    generation: auth.generation, hadSpace: auth.hadSpace)
  #expect(outcome == .unauthorized)
  let snapshot = await client.snapshot()
  #expect(!snapshot.isSignedIn)
  #expect(snapshot.sessionEnded)
  #expect(storage.cleared)
}

@Test
func unauthorizedWithSpaceKeepsSession() async throws {
  let client = try await signedInClient(FakeTransport([session]))
  let auth = try await client.authorized(
    path: "/rpc/me", method: "POST", body: nil, contentType: nil, spaceID: "s")
  let outcome = await client.handleUnauthorized(
    generation: auth.generation, hadSpace: auth.hadSpace)
  #expect(outcome == .spaceRejected)
  #expect((await client.snapshot()).isSignedIn)
}

@Test
func staleGenerationNeverSignsOutNewerSession() async throws {
  let transport = FakeTransport([session, session])
  let client = try await signedInClient(transport)
  let old = try await client.authorized(
    path: "/rpc/me", method: "POST", body: nil, contentType: nil, spaceID: nil)
  try await client.restore()  // a newer session: generation moves on
  let outcome = await client.handleUnauthorized(generation: old.generation, hadSpace: false)
  #expect(outcome == .stale)
  #expect((await client.snapshot()).isSignedIn)
}

@Test
func callSendsJsonWrapperToProcedureWithTimeoutAndCap() async throws {
  let transport = FakeTransport([session, rpcResponse(#"{"json":{"name":"Maya"}}"#)])
  let rpc = RPCClient(auth: try await signedInClient(transport), transport: transport)
  let me: Me = try await rpc.call("bots/get", input: Echo(id: "b1"), spaceID: "s1", timeout: 3)
  #expect(me == Me(name: "Maya"))
  let sent = try #require(await transport.requests.last)
  #expect(sent.url.path == "/rpc/bots/get")
  #expect(sent.method == "POST")
  #expect(sent.timeout == 3)
  #expect(sent.headers["x-rakazo-space-id"] == "s1")
  #expect(String(decoding: try #require(sent.body), as: UTF8.self) == #"{"json":{"id":"b1"}}"#)
  #expect(await transport.limits.last == 16 * 1024 * 1024)
}

@Test
func defaultTimeoutIsEightSecondsAndInputlessCallSendsEmptyJson() async throws {
  #expect(HTTPRequest(url: testEndpoint).timeout == 8)
  let transport = FakeTransport([session, rpcResponse(#"{"json":{"name":"M"}}"#)])
  let rpc = RPCClient(auth: try await signedInClient(transport), transport: transport)
  let _: Me = try await rpc.call("me")
  let sent = try #require(await transport.requests.last)
  #expect(sent.timeout == 8)
  #expect(String(decoding: try #require(sent.body), as: UTF8.self) == #"{"json":{}}"#)
}

@Test
func notFoundMeansNotSupported() async throws {
  let transport = FakeTransport([session, HTTPResponse(statusCode: 404, body: Data("404 Not Found".utf8))])
  let rpc = RPCClient(auth: try await signedInClient(transport), transport: transport)
  await #expect(throws: RPCError.notSupported) { let _: Me = try await rpc.call("nope/none") }
}

@Test
func serverErrorsCarryCodeStatusAndMessage() async throws {
  let body = #"{"json":{"defined":true,"code":"BAD_REQUEST","status":400,"message":"Name is required"}}"#
  let transport = FakeTransport([session, rpcResponse(body, status: 400)])
  let rpc = RPCClient(auth: try await signedInClient(transport), transport: transport)
  do {
    let _: Me = try await rpc.call("bots/create")
    Issue.record("expected an error")
  } catch let error as RPCError {
    #expect(error == .server(code: "BAD_REQUEST", status: 400, message: "Name is required"))
    #expect(error.errorDescription == "Name is required")
  }
}

@Test
func nonJsonServerErrorStillReportsStatus() async throws {
  let transport = FakeTransport([session, HTTPResponse(statusCode: 502, body: Data("<html>".utf8))])
  let rpc = RPCClient(auth: try await signedInClient(transport), transport: transport)
  do {
    let _: Me = try await rpc.call("me")
    Issue.record("expected an error")
  } catch let error as RPCError {
    guard case .server(_, let status, _) = error else { Issue.record("wrong error"); return }
    #expect(status == 502)
  }
}

@Test
func unauthorizedResponseSignsOutOnlyWithoutSpace() async throws {
  let unauthorized = rpcResponse(
    #"{"json":{"defined":false,"code":"UNAUTHORIZED","status":401,"message":"Unauthorized"}}"#,
    status: 401)
  let transport = FakeTransport([session, unauthorized, unauthorized])
  let auth = try await signedInClient(transport)
  let rpc = RPCClient(auth: auth, transport: transport)
  await #expect(throws: RPCError.spaceRejected) {
    let _: Me = try await rpc.call("me", spaceID: "s")
  }
  #expect((await auth.snapshot()).isSignedIn)
  await #expect(throws: RPCError.unauthorized) { let _: Me = try await rpc.call("me") }
  #expect(!(await auth.snapshot()).isSignedIn)
}

@Test
func malformedSuccessBodyIsDecodingError() async throws {
  let transport = FakeTransport([session, rpcResponse(#"{"json":{"other":1}}"#)])
  let rpc = RPCClient(auth: try await signedInClient(transport), transport: transport)
  await #expect(throws: RPCError.decoding) { let _: Me = try await rpc.call("me") }
}

@Test
func goalReplyIsAStatusLineNotAServerError() async throws {
  let body = #"{"json":{"defined":true,"code":"BAD_REQUEST","status":400,"message":"No goal set.","data":{"goalReply":true}}}"#
  let transport = FakeTransport([session, rpcResponse(body, status: 400)])
  let rpc = RPCClient(auth: try await signedInClient(transport), transport: transport)
  await #expect(throws: RPCError.goalReply("No goal set.")) { let _: Me = try await rpc.call("threads/send") }
}
