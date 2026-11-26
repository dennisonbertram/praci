import Foundation
import RakazoAPI

public enum RPCError: LocalizedError, Sendable, Equatable {
  case server(code: String, status: Int, message: String)
  /// A status line answered through the error channel (`data.goalReply`), not a failure.
  case goalReply(String)
  case notSupported
  case unauthorized
  case spaceRejected
  /// A 401 for a request sent by an earlier session; the current session is untouched.
  case stale
  case decoding

  public var errorDescription: String? {
    switch self {
    case .server(_, _, let message), .goalReply(let message): message
    case .notSupported: "Update your server to use this."
    case .unauthorized: "Your session is no longer valid."
    case .spaceRejected: "That space is no longer available."
    case .stale: "The session changed. Try again."
    case .decoding: "The server returned an invalid response."
    }
  }
}

private struct EmptyInput: Encodable {}

public struct RPCClient: Sendable {
  public static let maximumResponseBytes = 16 * 1024 * 1024

  private let auth: AuthClient
  private let transport: any HTTPTransport

  public init(auth: AuthClient, transport: any HTTPTransport = URLSessionHTTPTransport()) {
    self.auth = auth
    self.transport = transport
  }

  public func call<O: Decodable>(
    _ procedure: String, spaceID: String? = nil, timeout: TimeInterval = 8
  ) async throws -> O {
    try await call(procedure, input: EmptyInput(), spaceID: spaceID, timeout: timeout)
  }

  public func call<I: Encodable, O: Decodable>(
    _ procedure: String, input: I, spaceID: String? = nil, timeout: TimeInterval = 8
  ) async throws -> O {
    let body = try JSONEncoder().encode(RPCRequest(json: input))
    let sent: AuthorizedRequest
    do {
      sent = try await auth.authorized(
        path: "/rpc/\(procedure)", method: "POST", body: body,
        contentType: "application/json", spaceID: spaceID, timeout: timeout)
    } catch AuthClientError.unauthorized {
      throw RPCError.unauthorized
    }
    let response = try await transport.send(
      sent.request, maximumResponseBytes: Self.maximumResponseBytes)

    switch response.statusCode {
    case 200..<300:
      do {
        return try JSONDecoder().decode(RPCEnvelope<O>.self, from: response.body).json
      } catch {
        throw RPCError.decoding
      }
    case 401:
      throw await auth.handleUnauthorized(generation: sent.generation, hadSpace: sent.hadSpace)
    case 404:
      throw RPCError.notSupported
    default:
      let payload = try? JSONDecoder().decode(RPCErrorEnvelope.self, from: response.body).json
      if let payload, case .object(let data)? = payload.data, data["goalReply"] == .bool(true) {
        throw RPCError.goalReply(payload.message)
      }
      throw RPCError.server(
        code: payload?.code ?? "UNKNOWN", status: response.statusCode,
        message: payload?.message ?? "Couldn’t continue. Try again.")
    }
  }
}
