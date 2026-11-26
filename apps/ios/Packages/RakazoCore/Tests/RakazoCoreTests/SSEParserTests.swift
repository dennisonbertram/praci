import Foundation
import RakazoCore
import Testing

private func feed(_ parser: inout SSEParser, _ text: String) -> [SSEFrame] {
  parser.feed(Data(text.utf8))
}

@Test
func parserIgnoresCommentsAndDispatchesNamedFrames() {
  var parser = SSEParser()
  let frames = feed(
    &parser,
    ": \n\nevent: message\ndata: {\"json\":{\"seq\":1}}\n\nevent: done\ndata: \n\n")
  #expect(frames == [
    SSEFrame(event: "message", data: "{\"json\":{\"seq\":1}}"),
    SSEFrame(event: "done", data: ""),
  ])
}

@Test
func parserReassemblesFramesSplitAcrossChunksAndCRLF() {
  var parser = SSEParser()
  #expect(feed(&parser, "event: mess").isEmpty)
  #expect(feed(&parser, "age\r\ndata: a\r\ndata").isEmpty)
  #expect(feed(&parser, ": b\r\n\r\n") == [SSEFrame(event: "message", data: "a\nb")])
}

@Test
func parserDefaultsEventNameAndIgnoresUnknownFields() {
  var parser = SSEParser()
  #expect(feed(&parser, "id: 4\nretry: 10\ndata: x\n\n") == [SSEFrame(event: "message", data: "x")])
  // Event name does not leak into the next block.
  #expect(feed(&parser, "event: error\ndata: e\n\ndata: y\n\n").map(\.event) == ["error", "message"])
}
