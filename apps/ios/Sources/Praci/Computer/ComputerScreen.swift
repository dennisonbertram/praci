import RakazoAPI
import RakazoCore
import SwiftUI

struct ComputerScreen: View {
  let botID: String
  @Environment(AppModel.self) private var app
  @Environment(\.scenePhase) private var scenePhase
  @State private var model: ComputerModel

  init(botID: String) {
    self.botID = botID
    _model = State(initialValue: ComputerModel(botID: botID))
  }

  var body: some View {
    VStack(spacing: 12) {
      if let error = model.loadError, !model.isLoaded {
        ContentUnavailableView {
          Label("Can’t connect", systemImage: "wifi.exclamationmark")
        } description: {
          Text(error)
        } actions: {
          Button("Try again") { Task { await model.retry(app) } }
            .accessibilityIdentifier("computerRetry")
        }
      } else if let status = model.status {
        screenArea(status)
        statusLine(status)
        controls(status)
      } else {
        ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
      }
    }
    .padding(.horizontal)
    .padding(.bottom, 8)
    .background(Color.token(.background))
    .navigationTitle(title)
    .navigationBarTitleDisplayMode(.inline)
    .task { await model.start(app) }
    .onDisappear { model.close(app: app) }
    .onChange(of: scenePhase) { _, phase in
      if phase == .active {
        Task { await model.start(app) }
      } else {
        model.stop()
      }
    }
  }

  private var title: LocalizedStringKey {
    if case .dedicated? = model.status?.mode { "Private computer" } else { "Team computer" }
  }

  // MARK: Screen

  @ViewBuilder
  private func screenArea(_ status: ComputerStatus) -> some View {
    ZStack {
      Color.token(.card)
      if let url = model.loadedURL {
        ScreenWebView(
          url: url, nativeKeys: model.hasControl, keyboardSession: model.keyboardSession,
          handle: model.webHandle, onMessage: model.screenMessage,
          onFailure: {
            model.screenFailed(String(localized: "The desktop did not load."))
          }
        )
        .id("\(model.hasControl):\(url.absoluteString)")
        .allowsHitTesting(model.hasControl)
        .accessibilityHidden(!model.hasControl)
      } else {
        placeholder(status)
      }
    }
    .clipShape(RoundedRectangle(cornerRadius: 14))
    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.token(.border)))
    .frame(maxHeight: .infinity)
    .accessibilityIdentifier("computerScreenArea")
  }

  @ViewBuilder
  private func placeholder(_ status: ComputerStatus) -> some View {
    VStack(spacing: 12) {
      if model.booting || status.state == .booting {
        ProgressView()
        Text(startingTitle).font(.headline)
      } else if status.state == .running {
        Text(model.screenError == nil ? "No live screen" : "Couldn’t load the desktop")
          .font(.headline)
        if let error = model.screenError { Text(error).font(.subheadline) }
      } else if status.state == .suspended {
        Text("Computer is asleep").font(.headline)
        Text("Take control to wake it.").font(.subheadline)
      } else if status.state == .error {
        Text("Computer failed to start").font(.headline)
        Button("Try again") { Task { await model.openComputer(takeControl: false, app: app) } }
          .buttonStyle(.bordered)
          .accessibilityIdentifier("openComputer")
      } else {
        Text("Computer is stopped").font(.headline)
        Button("Start computer") { Task { await model.openComputer(takeControl: false, app: app) } }
          .buttonStyle(.bordered)
          .accessibilityIdentifier("openComputer")
      }
    }
    .multilineTextAlignment(.center)
    .foregroundStyle(Color.token(.mutedForeground))
    .padding()
  }

  private var startingTitle: LocalizedStringKey {
    if case .dedicated? = model.status?.mode { "Starting Private computer" } else { "Starting Team computer" }
  }

  // MARK: Status and controls

  private func statusLine(_ status: ComputerStatus) -> some View {
    VStack(spacing: 4) {
      Text(statusText(status))
        .font(.subheadline)
        .foregroundStyle(Color.token(.mutedForeground))
        .accessibilityIdentifier("computerStatus")
      if let error = model.actionError {
        Text(error)
          .font(.footnote)
          .foregroundStyle(Color.token(.destructive))
          .accessibilityIdentifier("computerError")
      }
    }
    .frame(maxWidth: .infinity)
  }

  private func statusText(_ status: ComputerStatus) -> LocalizedStringKey {
    if model.booting || status.state == .booting { return "Starting" }
    if model.hasControl { return status.takeoverRequested ? "Waiting for you" : "You are driving" }
    if status.state == .suspended { return "Asleep" }
    if let name = status.busyBotName { return "\(name) is driving" }
    return "Not in use"
  }

  @ViewBuilder
  private func controls(_ status: ComputerStatus) -> some View {
    if model.hasControl {
      ComputerKeyBar(onCommand: model.send)
      if status.takeoverRequested {
        HStack(spacing: 12) {
          Button { Task { await model.release(.skipped, app: app) } } label: {
            Text("Skip").frame(maxWidth: .infinity)
          }
          .buttonStyle(.bordered)
          .accessibilityIdentifier("releaseSkip")
          Button { Task { await model.release(.done, app: app) } } label: {
            Text("I’m done").frame(maxWidth: .infinity)
          }
          .buttonStyle(.borderedProminent)
        .tint(Color.token(.primary))
        .foregroundStyle(Color.token(.primaryForeground))
          .accessibilityIdentifier("releaseDone")
        }
        .controlSize(.large)
      } else {
        Button { Task { await model.release(nil, app: app) } } label: {
          Label("Release control", systemImage: "lock.open").frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .tint(Color.token(.primary))
        .foregroundStyle(Color.token(.primaryForeground))
        .controlSize(.large)
        .accessibilityIdentifier("release")
      }
    } else if model.botBlocksTakeover {
      Button { Task { await model.stopBotAndTakeControl(app: app) } } label: {
        Label("Stop \(status.busyBotName ?? String(localized: "the bot")) and take control", systemImage: "stop.circle")
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(.borderedProminent)
      .tint(Color.token(.primary))
      .foregroundStyle(Color.token(.primaryForeground))
      .controlSize(.large)
      .accessibilityIdentifier("stopAndTakeControl")
    } else {
      Button { Task { await model.takeControl(app: app) } } label: {
        Label("Take control", systemImage: "hand.tap").frame(maxWidth: .infinity)
      }
      .buttonStyle(.borderedProminent)
        .tint(Color.token(.primary))
        .foregroundStyle(Color.token(.primaryForeground))
      .controlSize(.large)
      .disabled(model.booting || status.state == .booting)
      .accessibilityIdentifier("takeControl")
    }
  }
}
