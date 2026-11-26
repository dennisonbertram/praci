import Foundation

/// One dispatched server-sent event: the `event:` name (default `message`) and joined `data:` lines.
public struct SSEFrame: Sendable, Equatable {
  public let event: String
  public let data: String

  public init(event: String, data: String) {
    self.event = event
    self.data = data
  }
}

/// Incremental parser for the `text/event-stream` format. Feed it bytes in any chunking; it
/// returns a frame at each blank line. Comment lines (`: ...`) and unknown fields are ignored.
/// It works on raw bytes because `URLSession.AsyncBytes.lines` drops the blank lines that
/// terminate frames.
public struct SSEParser: Sendable {
  private var buffer = Data()
  private var event = ""
  private var dataLines: [String] = []

  public init() {}

  public mutating func feed(_ chunk: Data) -> [SSEFrame] {
    buffer.append(chunk)
    var frames: [SSEFrame] = []
    while let newline = buffer.firstIndex(of: 0x0A) {
      var line = buffer[buffer.startIndex..<newline]
      buffer = Data(buffer[buffer.index(after: newline)...])
      if line.last == 0x0D { line = line.dropLast() }
      if let frame = consume(String(bytes: line, encoding: .utf8) ?? "") { frames.append(frame) }
    }
    return frames
  }

  private mutating func consume(_ line: String) -> SSEFrame? {
    if line.isEmpty {
      defer {
        event = ""
        dataLines = []
      }
      // A block with no data lines (for example only comments) dispatches nothing.
      guard !dataLines.isEmpty else { return nil }
      return SSEFrame(event: event.isEmpty ? "message" : event, data: dataLines.joined(separator: "\n"))
    }
    if line.hasPrefix(":") { return nil }
    let name: String
    var value: String
    if let colon = line.firstIndex(of: ":") {
      name = String(line[..<colon])
      value = String(line[line.index(after: colon)...])
      if value.hasPrefix(" ") { value.removeFirst() }
    } else {
      name = line
      value = ""
    }
    switch name {
    case "event": event = value
    case "data": dataLines.append(value)
    default: break
    }
    return nil
  }
}
