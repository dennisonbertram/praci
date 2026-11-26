import Foundation

/// Request body for `/rpc/<procedure>`: the input wrapped as `{"json": input}`.
public struct RPCRequest<Input: Encodable>: Encodable {
  public let json: Input

  public init(json: Input) { self.json = json }
}

public struct RPCEnvelope<Payload: Decodable>: Decodable {
  public let json: Payload

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    json = try container.decode(Payload.self, forKey: .json)
  }

  private enum CodingKeys: String, CodingKey {
    case json
  }
}

public struct RPCErrorPayload: Decodable, Sendable {
  public let defined: Bool
  public let code: String
  public let status: Int
  public let message: String
  public let data: JSONValue?
}

public struct RPCErrorEnvelope: Decodable, Sendable {
  public let json: RPCErrorPayload
}
