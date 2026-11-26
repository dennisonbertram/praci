# Journey critique: Settings (STORY-117, 118, 121)

Evidence: `apps/ios/Sources/Praci/Settings/{SettingsScreen.swift,Models/*,Rules/ApprovalRulesScreen.swift}` and catalog findings 24, 48, 49. No device walk. M = measured from code, S = suspected, needs device walk. Invented data only.

**Verdict:** 117 switch default model: **acceptable**. 118 replace and remove a key: **minimal**. 121 add an approval rule: **acceptable**.

## 1. Friction scorecard

| Story | Ideal | Actual | Notes |
|---|---|---|---|
| 117 Switch default model | 4 | 4 to 5 | M. Settings, Models (`SettingsScreen.swift:62`), Model row (`ModelsScreen.swift:50`), tap a model (`:95`, auto-dismiss at `:98`). Thinking level is optional (`:57-71`). Matches the ideal; 5 only if search is used. |
| 118 Replace key | 3 | 4 | M. Settings, Models, provider row (`ModelsScreen.swift:17`), paste key, Save key (`:136`). The Ideal path counts 3 without opening Settings; actual from Home is 5. |
| 118 Remove provider | 3 | 5 | M. Settings, Models, provider row, Disconnect (`:155`), confirm (`:162`). |
| 121 Add rule | 4 | 6 | M. Settings, Allowed without asking (`SettingsScreen.swift:72`), plus (`ApprovalRulesScreen.swift:137`), choose Applies to, type Name, choose Action, Save. |

- **Decisions**:
  - 117: Thinking is a second control on the same page; fine, optional.
  - 121: three decisions in a Form (Applies to, Name, Action) (`:158-172`). Defaults are "Tool" and "Ask" (`:151,153`). "Ask" is already the app default behaviour, so the default action does nothing; the user always must change it to Allow or Block (M, `:153`). A better default is "Allow", since the sheet is reached by a user who wants to stop being asked (S).
- **Re-entry**: 121 asks the user to type a tool or site name from memory (`:164`). The app knows the actions it has asked about (the approval cards). Recognition over recall fails here (M). Finding 48 in the catalog says the rule kind is free text; the code shows kind is a Picker (`:158`) and the Name is free text (`:164`), so the typo risk is in Name, not kind. Corrected.
- **Confirmations**: Disconnect has a confirmation dialog (`ModelsScreen.swift:162`). Disconnecting a key is recoverable (paste it again) but it removes the default model and brings the Home banner back (finding 49, S), so the guard is defensible. Swipe-remove of a rule has no confirmation (`ApprovalRulesScreen.swift:112-114`), which is right.
- **Dead ends**: 117 returns to Models and shows the new model (`ModelsScreen.swift:53`); fine. A failed default save only shows a footer error and does not visibly roll back (finding 24, M: `ModelsModel.swift:67-76` sets `error` and keeps the old snapshot, so the list does not change, which is a correct rollback; the footer is the only signal, S if it is noticed).
- **Hesitations**:
  - Settings has three names for approvals: row "Allowed without asking" (`SettingsScreen.swift:73`), title "Approval rules" (`ApprovalRulesScreen.swift:133`), section "Rules" (`:118`) (M).
  - The rules list row shows `matchValue.capitalized` with the kind under it (`:107-108`); a tool id like `gmail_archive` becomes "Gmail_archive" (S).
  - Provider row says "Connected" on every provider (`ModelsScreen.swift:20`), which carries no information; all listed providers are connected by definition (M).

## 2. Take-away pass per screen

**Models (`ModelsScreen.swift`)**
- Default model section: Model and Thinking. Keep; the Thinking picker only shows when the model has levels (`:56`). Good progressive disclosure.
- Providers section: each row's "Connected" value is redundant (`:20`); drop it, and show the model count or nothing. "Connect a model" plus button is the one add action; fine.
- Footer error only for the default section; the key form has its own. Fine.

**Provider detail (`ProviderDetailScreen`)**
- "Status: Connected" section (`:126-128`) is the only content of its Section and repeats the row. Removable (M). Without it the screen is: key field, Save key, Disconnect.
- Save key is a separate button below a SecureField; a user who pastes and goes back loses the key silently (S). A trailing "Save" in the toolbar is the native pattern for a one-field form (M, `AddRuleSheet` already uses it, `ApprovalRulesScreen.swift:179-192`), so the two forms are inconsistent.

**Rules list (`ApprovalRulesScreen.swift`)**
- First section has only "Review actions automatically" toggle (`:80-89`); it is a different feature from rules and sits on the same screen. It is disabled when the checker is unavailable with no reason shown (M, `:87`). Not on this journey's path; flagged for the redundancy critic.
- Footer text "Background runs always ask before they send, change or run anything, except mail changes you always allowed." (`:123`) is a long explainer under the list; it repeats the interface. The empty list also shows "No rules" (`:129`). Per AGENTS.md, a persistent explainer should be removed or revealed only when relevant (S).

**Add rule sheet**: three fields. With an action sent from an approval card ("Always allow"), the kind and name would be prefilled and the sheet would be one tap. This would remove the sheet for the common case.

## 3. The simpler version

Switch default model (117): Settings, Models, Model row, pick (4). Already minimal. Optional: choose the model from the Home or thread header menu (2 steps), but that adds a surface; not proposed.

Replace key (118): Settings, Models, provider row, paste, Save (5 from Home; 4 from Settings). Remove status section and Models "Connected" values; make Save a toolbar button.

Add rule (121):
1. From any approval card, tap "Always allow this" (rule created with kind and name prefilled), toast "Archive mail is now allowed" with Undo.
2. Or Settings, Allowed without asking, plus: pick from a list of tools that have asked before, choose Allow or Block.

Changes: prefill from cards; default the action to Allow; make Name a picker of known tools; one name for the screen; trim the footer.

## 4. Clarity issues

- "Allowed without asking" vs "Approval rules" vs "Rules" (M above). The row name states the common outcome but the Add sheet also creates Ask and Block rules, so the label is narrower than the screen. Choose "Approval rules" everywhere (S).
- "Applies to: Tool / Connector / Category / Site" assume the persona knows the difference (`ApprovalRulesScreen.swift:158-163`). A non-technical founder will not know whether "archive mail" is a Tool or a Category. Jargon (S).
- "Name" for the match value (`:164`) does not say what to type.
- "Thinking" with capitalized level words ("Low", "High") (`ModelsScreen.swift:57,68`) is consistent with the web app; acceptable.

## Proposals

- **JD-1** Prefill the rule from the approval card. Evidence: STORY-121; `ApprovalRulesScreen.swift:151-172` has no input from where the rule was asked. Proposal: the card's "Always allow" creates the rule with a toast and Undo; the Settings sheet is the manual path. Steps saved: 5 (whole Settings trip). Risk: needs the approvals topic (STORY-035) to expose kind and name; not verified. Size M. Device walk: y.
- **JD-2** Default rule action is "Ask", which is already the default behaviour. Evidence: `ApprovalRulesScreen.swift:153`. Proposal: default to "Allow". Steps saved: 1 per rule. Risk: a rushed Save grants permission, so keep the sheet showing the choice. Size S. Device walk: n.
- **JD-3** Name is free text. Evidence: `ApprovalRulesScreen.swift:164` (finding 48 corrected: kind is a picker). Proposal: pick Name from known tools or connectors, keeping free text only for Site. Steps saved: 0 to 1; removes typo rules. Risk: needs a list endpoint; not verified. Size M. Device walk: y.
- **JD-4** Remove redundant "Connected" values and the Status section. Evidence: `ModelsScreen.swift:20`, `:126-128`. Proposal: delete both. Steps saved: 0 (two removed elements). Risk: none. Size S. Device walk: n.
- **JD-5** Save key as a toolbar button, like Add rule. Evidence: `ModelsScreen.swift:136`, `ApprovalRulesScreen.swift:179-192`. Proposal: confirmationAction "Save" in the toolbar, disabled on empty key. Steps saved: 0 (consistency, one fewer prominent control). Risk: none. Size S. Device walk: n.
- **JD-6** One name for the rules screen. Evidence: `SettingsScreen.swift:73`, `ApprovalRulesScreen.swift:118,133`. Proposal: "Approval rules" in all three. Steps saved: 0 (clarity). Risk: none. Size S. Device walk: n.
- **JD-7** Drop the rules footer explainer. Evidence: `ApprovalRulesScreen.swift:123`. Proposal: remove, or show only in the Add sheet when Allow is chosen. Steps saved: 0. Risk: users lose the background-run caveat, so confirm the wording with the owner. Size S. Device walk: n.
- **JD-8** Disconnecting the default provider has no warning (finding 49, S). Evidence: `ModelsScreen.swift:162-166` uses the same text for every provider. Proposal: when the provider holds the default model, the dialog says agents will stop replying until another model is chosen. Steps saved: 0 (prevents a later detour). Risk: new copy; justified because it guards a state change. Size S. Device walk: y.
