import Foundation
import Observation
import RakazoAPI
import RakazoCore

@MainActor
@Observable
final class GtmModel {
  let page = PageLoader<GtmOverview>()
  var state: Loadable<GtmOverview> { page.state }
  var refreshError: String? { page.refreshError }
  var actionError: String?
  var removing: GtmItem?
  private(set) var working = Set<String>()

  static func shouldCreateAgent(hasAgent: Bool) -> Bool { !hasAgent }

  func load(_ app: AppModel) async {
    let spaceID = app.spaceID
    await page.load(spaceID: spaceID, isCurrent: { app.spaceID == spaceID }) {
      if app.userID == nil { await app.confirmUser() }
      guard let userID = app.userID else { throw URLError(.userAuthenticationRequired) }
      let bots: [GtmAgentProbe] = try await app.call("bots/list")
      let key = "gtm-agent:\(userID)"
      let hasAgent = bots.contains { $0.spawnKey == key && $0.archivedAt == nil }
      if Self.shouldCreateAgent(hasAgent: hasAgent) {
        let _: JSONValue = try await app.call("gtm/agent")
      }
      let overview: GtmOverview = try await app.call("gtm/overview")
      return overview
    }
  }

  func update(_ item: GtmItem, status: String, app: AppModel) async {
    guard !working.contains(item.id) else { return }
    working.insert(item.id)
    actionError = nil
    defer { working.remove(item.id) }
    do {
      let _: JSONValue = try await app.call(
        "scratchpad/update",
        input: ScratchpadUpdateInput(itemId: item.id, status: status, updatedAt: item.updatedAt))
      await load(app)
    } catch {
      if isConflict(error) {
        actionError = String(localized: "Changed, review again")
        await load(app)
      } else if isNotFound(error) {
        await load(app)
      } else {
        actionError = error.localizedDescription
      }
    }
  }

  func remove(_ item: GtmItem, app: AppModel) async {
    guard !working.contains(item.id) else { return }
    working.insert(item.id)
    actionError = nil
    defer { working.remove(item.id) }
    do {
      let _: OKResult = try await app.call(
        "scratchpad/remove", input: ScratchpadRemoveInput(itemId: item.id))
      await load(app)
    } catch {
      if isConflict(error) {
        actionError = String(localized: "Changed, review again")
        await load(app)
      } else if isNotFound(error) {
        await load(app)
      } else {
        actionError = error.localizedDescription
      }
    }
  }

  private func isConflict(_ error: Error) -> Bool {
    guard case RPCError.server(let code, _, _) = error else { return false }
    return code == "CONFLICT"
  }

  private func isNotFound(_ error: Error) -> Bool {
    guard case RPCError.server(let code, _, _) = error else { return false }
    return code == "NOT_FOUND"
  }
}

/// The server does not yet enforce these two approval gates, so native UI always withholds Approve.
func gtmCanApprove(_ item: GtmItem) -> Bool {
  guard item.category == "create_account",
    item.channel != "email",
    !["x", "linkedin", "threads", "bluesky"].contains(item.channel ?? "")
  else { return false }
  return true
}

func gtmChannelLabel(_ channel: String?) -> String? {
  guard let channel else { return nil }
  switch channel {
  case "x": return "X"
  case "linkedin": return "LinkedIn"
  case "threads": return "Threads"
  case "bluesky": return "Bluesky"
  case "reddit": return "Reddit"
  case "hn": return "Hacker News"
  case "producthunt": return "Product Hunt"
  case "directory": return "Directories"
  case "email": return "Email"
  default: return channel
  }
}

func gtmDate(_ value: String?) -> Date? {
  guard let value else { return nil }
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  return formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
}
