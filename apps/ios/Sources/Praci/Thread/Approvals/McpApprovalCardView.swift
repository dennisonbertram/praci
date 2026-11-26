import RakazoAPI
import SwiftUI

/// "Connect MCP server <name>": approve or dismiss an agent-created server.
struct McpApprovalCardView: View {
  let mcp: McpApprovalBlock
  let messageID: String
  let model: ThreadModel
  let approval: ApprovalModel
  @Environment(AppModel.self) private var app

  /// The server's status wins once it is no longer pending; until then this device's answer shows.
  private var status: String {
    if mcp.status != "pending" { return mcp.status }
    switch approval.sentAnswer {
    case "approve": return "connected"
    case "dismiss": return "dismissed"
    default: return "pending"
    }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(spacing: 12) {
        Text(verbatim: String(mcp.name.prefix(1)).uppercased())
          .font(.subheadline.weight(.semibold))
          .frame(width: 32, height: 32)
          .background(Color.token(.muted), in: RoundedRectangle(cornerRadius: 8))
          .accessibilityHidden(true)
        VStack(alignment: .leading, spacing: 2) {
          Text("Connect MCP server \(mcp.name)").font(.subheadline.weight(.semibold))
          Text(verbatim: mcp.summary).font(.footnote).lineLimit(2)
            .foregroundStyle(Color.token(.mutedForeground))
        }
      }
      switch status {
      case "connected":
        ResolvedLine(text: Text("Connected"), tone: .positive)
      case "dismissed":
        ResolvedLine(text: Text("Dismissed"), tone: .neutral)
      default:
        if mcp.needsOAuth {
          Text("Finish authorization in the web app.").font(.footnote)
            .foregroundStyle(Color.token(.mutedForeground))
        }
        HStack(spacing: 8) {
          if !mcp.needsOAuth {
            CardActionButton(
              title: Text("Approve"), style: .prominent, busy: approval.pending == "approve",
              disabled: approval.pending != nil, identifier: "mcpApprove"
            ) { Task { await send("approve") } }
          }
          CardActionButton(
            title: Text("Not now"), style: .secondary, busy: approval.pending == "dismiss",
            disabled: approval.pending != nil, identifier: "mcpDismiss"
          ) { Task { await send("dismiss") } }
        }
      }
    }
    .approvalCardChrome()
    .accessibilityElement(children: .contain)
    .accessibilityIdentifier("approvalCard")
  }

  private func send(_ action: String) async {
    guard let botID = model.cardBotID(messageID) else { return }
    let input = McpAssignmentInput(
      botId: botID, serverId: mcp.serverId, threadId: model.snapshot?.threadId)
    await approval.run(action, app: app, thread: model) {
      let _: JSONValue = try await app.call("mcp/assignments/\(action)", input: input)
    }
  }
}
