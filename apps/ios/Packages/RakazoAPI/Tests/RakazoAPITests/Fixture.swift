import Foundation
import RakazoAPI
import Testing

func loadFixture(named name: String) throws -> Data {
  let url = try #require(Bundle.module.url(forResource: name, withExtension: "json"))
  return try Data(contentsOf: url)
}

private struct Me: Decodable {
  let userId: String
  let spaceId: String
  let hideAmounts: Bool
}

@Test
func decodesRecordedRPCEnvelopeAndErrorShape() throws {
  let me = try JSONDecoder().decode(RPCEnvelope<Me>.self, from: loadFixture(named: "rpc-me"))
  #expect(me.json.userId == "user-placeholder")
  #expect(me.json.spaceId == "space-placeholder")

  let error = try JSONDecoder().decode(
    RPCErrorEnvelope.self, from: loadFixture(named: "rpc-error-unauthorized"))
  #expect(error.json.status == 401)
  #expect(error.json.code == "UNAUTHORIZED")
}

@Test
func encodesRequestWrapper() throws {
  let data = try JSONEncoder().encode(RPCRequest(json: ["id": "b1"]))
  #expect(String(decoding: data, as: UTF8.self) == #"{"json":{"id":"b1"}}"#)
}
