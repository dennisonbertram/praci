import RakazoAPI
import SwiftUI

/// A pick-one card: radio rows, then Continue. The close button records the dismissed answer.
struct ChoiceCardView: View {
  let choice: ChoiceBlock
  let messageID: String
  let model: ThreadModel
  let approval: ApprovalModel
  @State private var selected: String?
  @Environment(AppModel.self) private var app

  private var answered: Bool { choice.answerID != nil || approval.sentAnswer != nil }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 2) {
          Text(choice.question).font(.body.weight(.semibold))
          if let subtitle = choice.subtitle {
            Text(subtitle).font(.footnote).foregroundStyle(Color.token(.mutedForeground))
          }
        }
        Spacer(minLength: 8)
        if !answered {
          Button {
            Task { await dismiss() }
          } label: {
            Label("Dismiss", systemImage: "xmark").labelStyle(.iconOnly)
          }
          .buttonStyle(.plain)
          .foregroundStyle(Color.token(.mutedForeground))
          .disabled(approval.pending != nil)
          .accessibilityIdentifier("choiceDismiss")
        }
      }
      ForEach(choice.shownOptions) { option in
        row(option)
      }
      if !answered {
        CardActionButton(
          title: Text("Continue"), style: .prominent, busy: approval.pending == selected,
          disabled: selected == nil || approval.pending != nil, identifier: "choiceContinue"
        ) {
          guard let selected else { return }
          Task { await choose(selected) }
        }
      }
    }
    .approvalCardChrome()
    .accessibilityElement(children: .contain)
    .accessibilityIdentifier("approvalCard")
  }

  private func row(_ option: ChoiceBlock.Option) -> some View {
    let isOn = answered ? true : selected == option.id
    return Button {
      selected = option.id
    } label: {
      HStack(spacing: 12) {
        Image(systemName: isOn ? "largecircle.fill.circle" : "circle")
          .foregroundStyle(isOn ? Color.token(.foreground) : Color.token(.mutedForeground))
        Text(verbatim: option.label).foregroundStyle(Color.token(.foreground))
        Spacer(minLength: 0)
      }
      .frame(minHeight: 44)
      .padding(.horizontal, 12)
      .background(Color.token(.accent), in: RoundedRectangle(cornerRadius: 14))
      .overlay(
        RoundedRectangle(cornerRadius: 14)
          .stroke(isOn ? Color.token(.primary) : .clear, lineWidth: 1))
    }
    .buttonStyle(.plain)
    .disabled(answered || approval.pending != nil)
    .accessibilityAddTraits(isOn ? .isSelected : [])
    .accessibilityIdentifier("choiceOption.\(option.id)")
  }

  private func choose(_ optionID: String) async {
    guard let botID = model.cardBotID(messageID) else { return }
    await approval.run(optionID, app: app, thread: model) {
      let _: JSONValue = try await app.call(
        "onboarding/choose", input: OnboardingChooseInput(botId: botID, optionId: optionID))
    }
  }

  private func dismiss() async {
    guard let botID = model.cardBotID(messageID) else { return }
    await approval.run(ChoiceBlock.dismissedAnswerID, app: app, thread: model) {
      let _: JSONValue = try await app.call(
        "onboarding/dismissFocus", input: OnboardingDismissInput(botId: botID))
    }
  }
}
