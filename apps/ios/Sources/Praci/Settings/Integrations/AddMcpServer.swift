import Foundation
import Observation
import RakazoAPI
import SwiftUI

struct McpHeaderRow: Identifiable, Equatable {
  let id = UUID()
  var name = ""
  var value = ""
}

/// The body of `mcp/servers/create` for a remote (streamable HTTP) server. Header values are secrets.
struct CreateMcpServerInput: Encodable, Equatable, Sendable {
  var slug: String
  var name: String
  var transport = "streamable_http"
  var endpoint: String
  var headers: [String: String]
  var enabled = true
}

enum AddMcpServerLogic {
  static let maxURLLength = 2048

  /// The same rule as the web form and `McpRemoteEndpointSchema`: an http(s) URL with a host, no
  /// credentials or fragment. HTTPS for public hosts is enforced by the server, which shows its error.
  static func isValidURL(_ text: String) -> Bool {
    guard text.count <= maxURLLength, !text.hasSuffix("#"),
      let url = URL(string: text), let scheme = url.scheme?.lowercased(),
      scheme == "http" || scheme == "https", let host = url.host, !host.isEmpty
    else { return false }
    return url.user == nil && url.password == nil && url.fragment == nil
  }

  /// "api.brex.com" becomes "Brex", like `deriveMcpName` on the web.
  static func derivedName(_ endpoint: String) -> String {
    let generic = "MCP server"
    guard let host = URL(string: endpoint)?.host?.lowercased() else { return generic }
    if host.allSatisfy({ $0.isNumber || $0 == "." }) || host.contains(":") { return generic }
    var labels = host.split(separator: ".").map(String.init)
    while labels.count > 2, ["www", "api", "mcp"].contains(labels[0]) { labels.removeFirst() }
    if labels.count > 1 { labels.removeLast() }
    if labels.count > 1, ["co", "com", "org", "net", "gov", "ac"].contains(labels[labels.count - 1]) {
      labels.removeLast()
    }
    guard let label = labels.last, !label.isEmpty else { return generic }
    return label.prefix(1).uppercased() + label.dropFirst()
  }

  /// Nil when the URL is not valid. Input is trimmed, an empty name falls back to the host, and
  /// rows without a header name are dropped.
  static func request(name: String, url: String, headers: [McpHeaderRow]) -> CreateMcpServerInput? {
    let endpoint = url.trimmingCharacters(in: .whitespacesAndNewlines)
    guard isValidURL(endpoint) else { return nil }
    let label = name.trimmingCharacters(in: .whitespacesAndNewlines)
    var pairs: [String: String] = [:]
    for row in headers {
      let key = row.name.trimmingCharacters(in: .whitespacesAndNewlines)
      if !key.isEmpty { pairs[key] = row.value.trimmingCharacters(in: .whitespacesAndNewlines) }
    }
    let suffix = UUID().uuidString.lowercased().replacingOccurrences(of: "-", with: "").prefix(8)
    return CreateMcpServerInput(
      slug: "integration-\(suffix)",
      name: label.isEmpty ? derivedName(endpoint) : String(label.prefix(AccessLogic.serverNameLimit)),
      endpoint: endpoint, headers: pairs)
  }
}

@MainActor
@Observable
final class AddMcpServerModel {
  var name = ""
  var url = ""
  var headers: [McpHeaderRow] = []
  var error: String?
  var busy = false
  /// The new server's own agent, set once it was created; the sheet opens it.
  var agentBotID: String?
  @ObservationIgnored private let create: (CreateMcpServerInput) async throws -> String?

  init(create: @escaping (CreateMcpServerInput) async throws -> String?) { self.create = create }

  var canSubmit: Bool { !busy && !url.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

  /// True when the server was created. On failure the input stays so the person can fix it.
  func submit() async -> Bool {
    guard let input = AddMcpServerLogic.request(name: name, url: url, headers: headers) else {
      error = "Enter the server URL, starting with https://."
      return false
    }
    busy = true
    error = nil
    defer { busy = false }
    do {
      agentBotID = try await create(input)
      headers = []
      return true
    } catch {
      self.error = settingsErrorText(error)
      return false
    }
  }
}

struct AddMcpServerSheet: View {
  @Environment(\.dismiss) private var dismiss
  @State private var model: AddMcpServerModel
  let onAdded: (_ agentBotID: String?) async -> Void

  init(app: AppModel, onAdded: @escaping (_ agentBotID: String?) async -> Void) {
    _model = State(
      initialValue: AddMcpServerModel { input in
        let server: McpServer = try await app.call("mcp/servers/create", input: input)
        return server.agentBotId
      })
    self.onAdded = onAdded
  }

  var body: some View {
    @Bindable var model = model
    NavigationStack {
      Form {
        Section {
          TextField("Name (optional)", text: $model.name)
            .accessibilityIdentifier("mcpName")
          TextField("https://example.com/mcp", text: $model.url)
            .keyboardType(.URL)
            .textContentType(.URL)
            .autocorrectionDisabled()
            .textInputAutocapitalization(.never)
            .accessibilityIdentifier("mcpURL")
        } footer: {
          if let error = model.error {
            Text(error).foregroundStyle(Color.token(.destructive))
          } else {
            Text("A new agent is created for this server, and only it can use the server until you share it.")
          }
        }
        Section("Headers") {
          ForEach($model.headers) { $row in
            VStack(alignment: .leading) {
              TextField("Name", text: $row.name)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
              SecureField("Value", text: $row.value)
                .textContentType(.oneTimeCode)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
            }
          }
          .onDelete { model.headers.remove(atOffsets: $0) }
          Button("Add header") { model.headers.append(McpHeaderRow()) }
            .accessibilityIdentifier("mcpAddHeader")
        }
      }
      .navigationTitle("Add MCP server")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Close", systemImage: "xmark") { dismiss() }.labelStyle(.iconOnly)
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Add") {
            Task {
              if await model.submit() {
                await onAdded(model.agentBotID)
                dismiss()
              }
            }
          }
          .disabled(!model.canSubmit)
          .accessibilityIdentifier("mcpSubmit")
        }
      }
    }
  }
}
