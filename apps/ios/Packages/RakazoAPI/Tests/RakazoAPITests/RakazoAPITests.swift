import Foundation
import Testing
@testable import RakazoAPI

@Test
func decodesRecordedHealthResponseUsingGeneratedOpenAPIModel() throws {
    let data = try fixture(named: "health-response")
    let envelope = try JSONDecoder().decode(
        RPCEnvelope<Components.Schemas.HealthResponse>.self,
        from: data
    )

    #expect(envelope.json.json.ok)
    #expect(envelope.json.json.version == "0.1.0")
}

@Test
func decodesKnownMessageBlockWithTypedAccessAndRetainsFields() throws {
    let block = try JSONDecoder().decode(MessageBlock.self, from: fixture(named: "synthetic-known-card"))

    #expect(block.kind == .card)
    #expect(block.cardLines == [.init(k: "State", v: "Waiting")])
    #expect(block.fields["source"]?.stringValue == "synthetic test fixture")
}

@Test
func preservesUnknownMessageBlockKindsAndPayload() throws {
    let data = try fixture(named: "synthetic-unknown-block")
    let block = try JSONDecoder().decode(MessageBlock.self, from: data)

    #expect(block.kind == .unknown("future_card"))
    #expect(block.title == "Synthetic only")
    #expect(block.fields["futurePayload"] != nil)
    #expect(try block.field("futurePayload", as: FuturePayload.self)?.enabled == true)

    let encoded = try JSONEncoder().encode(block)
    let decodedAgain = try JSONDecoder().decode(MessageBlock.self, from: encoded)
    #expect(decodedAgain.kind == block.kind)
    #expect(decodedAgain.fields == block.fields)
}

@Test
func preservesUnknownProductEventTypesAndPayload() throws {
    let event = try JSONDecoder().decode(
        ProductEvent.self,
        from: fixture(named: "synthetic-product-event")
    )

    #expect(event.type == "thread.future_event")
    #expect(event.payload["synthetic"] == .bool(true))
    #expect(event.payload["futureField"]?.stringValue == "preserved")
}

private func fixture(named name: String) throws -> Data {
    let url = try #require(Bundle.module.url(forResource: name, withExtension: "json"))
    return try Data(contentsOf: url)
}

private struct FuturePayload: Decodable {
    let enabled: Bool
}
