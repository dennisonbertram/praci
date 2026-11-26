import PDFKit
import RakazoAPI
import SwiftUI

/// Names of the signed-in space's agents, for screen titles. A failed read just leaves the title generic.
@MainActor
func agentName(_ botID: String, app: AppModel) async -> String? {
  let bots: [BotSummary]? = try? await app.call("bots/list")
  return bots?.first { $0.id == botID }?.name
}

func parseISODate(_ iso: String?) -> Date? {
  guard let iso else { return nil }
  let fractional = ISO8601DateFormatter()
  fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  return fractional.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
}

/// "Today, 8:00 AM" style time for detail screens.
func detailTimestamp(_ iso: String?) -> String? {
  guard let date = parseISODate(iso) else { return nil }
  return date.formatted(date: .abbreviated, time: .shortened)
}

struct PDFPreview: UIViewRepresentable {
  let data: Data

  func makeUIView(context: Context) -> PDFView {
    let view = PDFView()
    view.autoScales = true
    view.document = PDFDocument(data: data)
    return view
  }

  func updateUIView(_ view: PDFView, context: Context) {}
}
