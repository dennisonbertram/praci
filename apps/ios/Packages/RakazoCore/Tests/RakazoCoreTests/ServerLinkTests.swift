import Foundation
import Testing

@testable import RakazoCore

private func connectLink(server: String) -> String {
  var components = URLComponents(string: "rakazo://connect")!
  components.queryItems = [URLQueryItem(name: "server", value: server)]
  return components.string!
}

@Test
func parsesConnectLinksAndIgnoresUnknownParameters() throws {
  #expect(
    try ServerLink.parse(
      "rakazo://connect?server=https%3A%2F%2Fmy-mac.example.ts.net&version=1")
      == URL(string: "https://my-mac.example.ts.net"))
}

@Test
func parsesBareServerOrigins() throws {
  #expect(
    try ServerLink.parse("https://my-mac.example.ts.net")
      == URL(string: "https://my-mac.example.ts.net"))
  #expect(
    try ServerLink.parse("my-mac.example.ts.net")
      == URL(string: "https://my-mac.example.ts.net"))
  #expect(
    try ServerLink.parse("my-mac.example.ts.net:8443")
      == URL(string: "https://my-mac.example.ts.net:8443"))
  #expect(
    try ServerLink.parse("https://[2001:db8::1]:8443")
      == URL(string: "https://[2001:db8::1]:8443"))
}

@Test
func parsesPrivateHTTPOrigins() throws {
  #expect(try ServerLink.parse("http://100.64.0.1:3100") == URL(string: "http://100.64.0.1:3100"))
  #expect(throws: ServerEndpoint.ValidationError.publicHTTP) {
    try ServerLink.parse("http://my-mac.example.ts.net")
  }
}

@Test
func rejectsNonOriginServerValues() {
  for value in [
    "https://user@my-mac.example.ts.net",
    "https://my-mac.example.ts.net/path",
    "https://my-mac.example.ts.net?next=elsewhere",
    "https://my-mac.example.ts.net#fragment",
  ] {
    #expect(throws: ServerEndpoint.ValidationError.malformed) {
      try ServerLink.parse(value)
    }
    #expect(throws: ServerEndpoint.ValidationError.malformed) {
      try ServerLink.parse(connectLink(server: value))
    }
  }
}

@Test
func rejectsEmptyServerInput() {
  for input in ["", " \n"] {
    #expect(throws: ServerEndpoint.ValidationError.empty) {
      try ServerLink.parse(input)
    }
  }
}

@Test
func rejectsMalformedConnectLinks() {
  #expect(throws: ServerEndpoint.ValidationError.empty) {
    try ServerLink.parse("rakazo://connect")
  }
  #expect(throws: ServerEndpoint.ValidationError.empty) {
    try ServerLink.parse("rakazo://connect?server=")
  }
  var duplicate = URLComponents(string: "rakazo://connect")!
  duplicate.queryItems = [
    URLQueryItem(name: "server", value: "https://my-mac.example.ts.net"),
    URLQueryItem(name: "server", value: "https://other.example.test"),
  ]
  #expect(throws: ServerEndpoint.ValidationError.malformed) {
    try ServerLink.parse(duplicate.string!)
  }
  #expect(throws: ServerEndpoint.ValidationError.malformed) {
    try ServerLink.parse("rakazo://sign-in?server=https%3A%2F%2Fmy-mac.example.ts.net")
  }
  #expect(throws: ServerEndpoint.ValidationError.malformed) {
    try ServerLink.parse("rakazo://connect/?server=https%3A%2F%2Fmy-mac.example.ts.net")
  }
  #expect(throws: ServerEndpoint.ValidationError.malformed) {
    try ServerLink.parse("rakazo://user@connect?server=https%3A%2F%2Fmy-mac.example.ts.net")
  }
  #expect(throws: ServerEndpoint.ValidationError.malformed) {
    try ServerLink.parse("rakazo://connect?server=https%3A%2F%2Fmy-mac.example.ts.net#fragment")
  }
  #expect(throws: ServerEndpoint.ValidationError.unsupportedScheme) {
    try ServerLink.parse("ftp://my-mac.example.ts.net")
  }
}
