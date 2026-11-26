import Foundation
import RakazoAPI
import RakazoCore
import RakazoUI
import SwiftUI

struct FundraisingScreen: View {
  @Environment(AppModel.self) private var app
  @State private var model = FundraisingModel()
  @State private var logTarget: LogTarget?

  var body: some View {
    LoadableView(state: model.state, retry: { Task { await model.load(app) } }, content: { overview in
      List {
        RefreshErrorSection(message: model.refreshError) { await model.load(app) }
        roundSection(overview)
        attentionSection(overview.safes)
        pipelineSections(overview.prospects)
        safeSection(overview.safes)
      }
      .listStyle(.insetGrouped)
    })
    .navigationTitle("Fundraising")
    .navigationBarTitleDisplayMode(.inline)
    .refreshable { await model.load(app) }
    .task(id: app.spaceID) { await model.load(app) }
    .sheet(item: $logTarget) { target in
      LogCallSheet(
        prospect: target.prospect,
        onSave: { outcome, note, next in
          await model.logCall(target.prospect, outcome: outcome, note: note, next: next, app: app)
        },
        onCancel: { logTarget = nil })
    }
    .safeAreaInset(edge: .bottom, spacing: 0) {
      if let toast = model.undoCall { CallUndoToastView(model: model, toast: toast) }
    }
    .actionErrorAlert("Fundraising action failed", message: Binding(
      get: { model.actionError }, set: { model.actionError = $0 }), cancelButton: true)
  }

  private func roundSection(_ overview: FundraisingOverview) -> some View {
    Section("Round") {
      if let round = overview.round {
        VStack(alignment: .leading, spacing: 12) {
          HStack {
            Text(round.name).font(.headline)
            Spacer()
            if round.closedAt != nil { Text("Closed").font(.caption).foregroundStyle(Color.token(.mutedForeground)) }
          }
          RoundProgressBar(
            target: round.targetCents,
            funded: overview.fundedCents,
            signed: overview.signedCents,
            pending: overview.pendingCents)
          HStack(alignment: .firstTextBaseline, spacing: 8) {
            roundFigure("Funded", overview.fundedCents)
            roundFigure("Signed", overview.signedCents)
            roundFigure("Pending", overview.pendingCents)
            roundFigure("Target", round.targetCents)
          }
        }
        .padding(.vertical, 4)
      } else {
        Text("No round")
          .foregroundStyle(Color.token(.mutedForeground))
      }
    }
  }

  private func roundFigure(_ title: String, _ cents: Int) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(title).font(.caption).foregroundStyle(Color.token(.mutedForeground))
      Text(usd(cents)).font(.subheadline.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.75)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  @ViewBuilder
  private func attentionSection(_ safes: [FundraisingSafe]) -> some View {
    let items = safes.compactMap { safe -> (FundraisingSafe, AttentionKind)? in
      if safe.status == "signed" { return (safe, .deposit) }
      guard safe.source == "native", safe.status == "sent", let sentAt = safe.sentAt,
        let sentDate = isoDate(sentAt), Date().timeIntervalSince(sentDate) >= 14 * 86_400
      else { return nil }
      return (safe, .signature)
    }
    if !items.isEmpty {
      Section("Attention") {
        ForEach(items, id: \.0.id) { item in
          let safe = item.0
          let kind = item.1
          HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
              Text(safe.investorName).font(.headline)
              Text(kind == .deposit ? "Awaiting deposit · \(usd(safe.amountCents))" : "Sent \(shortDay(safe.sentAt ?? safe.createdAt)), not signed")
                .font(.caption)
                .foregroundStyle(Color.token(.mutedForeground))
            }
            Spacer(minLength: 8)
            if kind == .deposit {
              NavigationLink(value: Route.finance) { Text("Find in Finance") }
                .font(.subheadline)
            }
            if safe.source == "native" && (kind == .deposit || safe.status == "sent") {
              safeMenu(safe)
            }
          }
          .accessibilityElement(children: .contain)
        }
      }
    }
  }

  @ViewBuilder
  private func pipelineSections(_ prospects: [FundraisingProspect]) -> some View {
    let indexed = Dictionary(uniqueKeysWithValues: prospects.map { ($0.id, $0) })
    let bands = PipelineDayBand.allCases
    ForEach(bands, id: \.self) { band in
      let rows = model.pipeline.filter { $0.band == band }
      if !rows.isEmpty {
        Section(band.title) {
          ForEach(rows) { row in
            if let prospect = indexed[row.id] {
              NavigationLink(value: Route.contact(id: prospect.id)) {
                PipelineProspectRow(row: row)
              }
              .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                Button {
                  logTarget = LogTarget(prospect: prospect)
                } label: {
                  Label("Log a call", systemImage: "phone")
                }
                .tint(Color.token(.primary))
              }
              .accessibilityIdentifier("fundraisingProspect-\(prospect.id)")
            }
          }
        }
      }
    }
    if model.pipeline.isEmpty {
      Section("Pipeline") {
        Text("No prospects")
          .foregroundStyle(Color.token(.mutedForeground))
      }
    }
  }

  private func safeSection(_ safes: [FundraisingSafe]) -> some View {
    Section("SAFEs") {
      if safes.isEmpty {
        Text("No SAFEs")
          .foregroundStyle(Color.token(.mutedForeground))
      } else {
        ForEach(safes) { safe in
          HStack {
            VStack(alignment: .leading, spacing: 2) {
              Text(safe.investorName).font(.headline)
              Text("\(usd(safe.amountCents)) · \(safe.status.capitalized)")
                .font(.subheadline).foregroundStyle(Color.token(.mutedForeground))
            }
            Spacer()
            if safe.source == "native" && ["draft", "sent", "signed"].contains(safe.status) {
              safeMenu(safe)
            }
          }
        }
      }
    }
  }

  @ViewBuilder
  private func safeMenu(_ safe: FundraisingSafe) -> some View {
    Menu {
      if safe.status == "draft" {
        Button("Mark sent") { Task { await model.mark(safe, action: "sent", app: app) } }
      }
      if safe.status == "sent" {
        Button("Mark signed") { Task { await model.mark(safe, action: "signed", app: app) } }
      }
      if safe.status == "signed" {
        Button("Mark funded") { Task { await model.mark(safe, action: "funded", app: app) } }
      }
    } label: {
      Image(systemName: "ellipsis")
        .frame(width: 44, height: 44)
        .contentShape(Rectangle())
    }
    .accessibilityLabel("SAFE actions")
  }

  private func usd(_ cents: Int) -> String {
    (Double(cents) / 100).formatted(.currency(code: "USD").precision(.fractionLength(0)))
  }

  private func shortDay(_ iso: String) -> String {
    fundraisingDayLabel(iso)
  }
}

private struct PipelineProspectRow: View {
  let row: PipelineRow

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(row.name).font(.headline)
      HStack(spacing: 6) {
        Text(pipelineStatusName(row.status))
        if let nextCallAt = row.nextCallAt {
          Text("·")
          Text(shortDay(nextCallAt, hasTime: row.nextCallHasTime))
        }
      }
      .font(.subheadline)
      .foregroundStyle(row.band == .overdue ? Color.token(.destructive) : Color.token(.mutedForeground))
    }
    .accessibilityElement(children: .combine)
  }

  private func shortDay(_ iso: String, hasTime: Bool = false) -> String {
    let day = hasTime
      ? (pipelineCallDay(at: iso, hasTime: true) ?? String(iso.prefix(10)))
      : String(iso.prefix(10))
    return fundraisingDayLabel(day)
  }
}

private struct RoundProgressBar: View {
  let target: Int
  let funded: Int
  let signed: Int
  let pending: Int

  private var scale: Int { max(target, funded + signed + pending) }

  var body: some View {
    GeometryReader { geometry in
      HStack(spacing: 1) {
        segment(funded, color: Color.token(.primary), width: geometry.size.width)
        segment(signed, color: Color.token(.primary).opacity(0.68), width: geometry.size.width)
        segment(pending, color: Color.token(.primary).opacity(0.35), width: geometry.size.width)
        Spacer(minLength: 0)
      }
    }
    .frame(height: 8)
    .background(Color.token(.muted))
    .clipShape(Capsule())
    .accessibilityLabel("Round progress")
  }

  private func segment(_ cents: Int, color: Color, width: CGFloat) -> some View {
    Rectangle().fill(color).frame(width: scale > 0 ? width * min(1, CGFloat(max(0, cents)) / CGFloat(scale)) : 0)
  }
}

private struct LogTarget: Identifiable {
  let prospect: FundraisingProspect
  var id: String { prospect.id }
}

private enum AttentionKind: Equatable { case deposit, signature }

private extension PipelineDayBand {
  var title: String {
    switch self {
    case .overdue: "Overdue"
    case .today: "Today"
    case .week: "Next 7 days"
    case .later: "Later"
    case .none: "No date"
    }
  }
}

private func isoDate(_ value: String) -> Date? {
  let fractional = ISO8601DateFormatter()
  fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  return fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value)
}

/// Fundraising stores date-only values at noon UTC; format their ISO day in UTC so it never moves
/// to the following day in time zones east of UTC.
private func fundraisingDayLabel(_ iso: String) -> String {
  let formatter = DateFormatter()
  formatter.calendar = Calendar(identifier: .gregorian)
  formatter.locale = .current
  formatter.timeZone = TimeZone(secondsFromGMT: 0)
  formatter.dateFormat = "yyyy-MM-dd"
  guard let date = formatter.date(from: String(iso.prefix(10))) else { return iso }
  formatter.dateFormat = DateFormatter.dateFormat(
    fromTemplate: "MMMd", options: 0, locale: .current)
  return formatter.string(from: date)
}

private struct CallUndoToastView: View {
  @Environment(AppModel.self) private var app
  let model: FundraisingModel
  let toast: CallUndoToast

  var body: some View {
    HStack(spacing: 16) {
      Text(toast.title).lineLimit(1)
      Spacer(minLength: 8)
      Button("Undo") { Task { await model.undoLoggedCall(toast.eventId, app: app) } }
        .fontWeight(.semibold)
        .accessibilityIdentifier("fundraisingUndoCall")
    }
    .font(.subheadline)
    .padding(.horizontal, 20).padding(.vertical, 12)
    .glassEffect()
    .padding(.bottom, 8)
    .task(id: toast.id) {
      try? await Task.sleep(for: .seconds(5))
      model.dismissUndo(toast.eventId)
    }
  }
}

/// The web's pipeline status names (`PipelineControls.statusNames`).
private func pipelineStatusName(_ status: String) -> LocalizedStringKey {
  switch status {
  case "not_reached": "Not reached"
  case "reached_out": "Reached out"
  case "intro_requested": "Intro requested"
  case "intro_made": "Intro made"
  case "meeting_booked": "Meeting booked"
  case "met": "Met"
  case "diligence": "Diligence"
  case "committed": "Committed"
  case "passed": "Passed"
  default: LocalizedStringKey(status)
  }
}
