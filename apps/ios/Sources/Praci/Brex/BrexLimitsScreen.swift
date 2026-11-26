import RakazoAPI
import SwiftUI

struct BrexLimitsScreen: View {
  let data: BrexLimits
  let hidden: Bool

  var body: some View {
    Section("Limits") {
      if data.partial { Text("Partial results").foregroundStyle(Color.token(.mutedForeground)) }
      if data.limits.isEmpty {
        Text("No spend limits").foregroundStyle(Color.token(.mutedForeground))
      } else {
        ForEach(data.limits) { limit in
          VStack(alignment: .leading, spacing: 3) {
            HStack {
              Text(limit.name).font(.headline)
              Spacer(minLength: 8)
              Text(brexLimitStatusLabel(limit.status))
                .foregroundStyle(Color.token(.mutedForeground))
            }
            Text(amountSummary(limit))
              .font(.subheadline)
              .foregroundStyle(Color.token(.mutedForeground))
            if let start = limit.startDate, let end = limit.endDate {
              Text("\(financeDay(start)) – \(financeDay(end))")
                .font(.caption)
                .foregroundStyle(Color.token(.mutedForeground))
            }
          }
          .padding(.vertical, 2)
        }
      }
    }
  }

  private func amountSummary(_ limit: BrexSpendLimit) -> String {
    let currency = limit.currency ?? "USD"
    let used = limit.usedCents.map { financeMoney($0, currency: currency, hidden: hidden) } ?? "—"
    let total = limit.limitCents.map { financeMoney($0, currency: currency, hidden: hidden) } ?? "—"
    let period = limit.period.map { " · \(brexSpendPeriodLabel($0))" } ?? ""
    if let percent = limit.percent {
      return "\(used) of \(total) · \(String(format: "%.0f", percent))%\(period)"
    }
    return "\(used) of \(total)\(period)"
  }
}
