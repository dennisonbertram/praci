import RakazoAPI
import SwiftUI

/// An app the agent needs connected. Authorizing happens in the Integrations screen, which opens
/// the provider's page in Safari and waits for it to finish.
struct ConnectCardView: View {
  let connect: ConnectBlock
  let model: ThreadModel
  @State private var showingIntegrations = false
  @Environment(AppModel.self) private var app

  var body: some View {
    HStack(spacing: 12) {
      Text(verbatim: String(connect.name.prefix(1)).uppercased())
        .font(.headline)
        .frame(width: 40, height: 40)
        .background(Color.token(.muted), in: RoundedRectangle(cornerRadius: 10))
        .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: 2) {
        Text(verbatim: connect.name).font(.subheadline.weight(.semibold))
        if let description = connect.description, !description.isEmpty {
          Text(verbatim: description).font(.footnote).lineLimit(2)
            .foregroundStyle(Color.token(.mutedForeground))
        }
      }
      Spacer(minLength: 8)
      if connect.isConnected {
        ResolvedLine(text: Text("Connected"), tone: .positive)
      } else {
        Button("Connect") { showingIntegrations = true }
          .buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
          .tint(Color.token(.primary))
          .accessibilityLabel("Connect \(connect.name)")
          .accessibilityIdentifier("connectApp")
      }
    }
    .approvalCardChrome()
    .accessibilityElement(children: .contain)
    .accessibilityIdentifier("approvalCard")
    .sheet(isPresented: $showingIntegrations, onDismiss: { Task { await model.refresh(app) } }, content: {
      NavigationStack {
        IntegrationsScreen()
          .toolbar {
            ToolbarItem(placement: .confirmationAction) {
              Button("Done") { showingIntegrations = false }.accessibilityIdentifier("connectDone")
            }
          }
      }
    })
  }
}
