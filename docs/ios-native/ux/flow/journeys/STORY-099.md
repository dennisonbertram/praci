# Journey critique: business pages (STORY-099, 102, 105, 108, 104)

Evidence: Swift code in `apps/ios/Sources/Praci` and `docs/ios-native/ux/catalog.md`. No device walk. Each claim is marked M (measured from code) or S (suspected, needs device walk). All data is invented.

**Verdict: acceptable.** The read paths (099) are minimal. The cost sits in the setup paths (102, 105, 108): every Connect button opens Settings at its top level, and nothing refreshes when the user comes back. Hide amounts (104) is correct on Finance but silently incomplete elsewhere.

## 1. Friction scorecard

| Story | Ideal | Actual | Notes |
|---|---|---|---|
| 099 Check runway | 2 | 2 (Home row, read top card) | M. `Finance/FinanceScreen.swift:46-59` puts Runway, Cash, Burn first. Minimal. |
| 102 Finance Connect | 3 | about 6 | M. Connect (`FinanceScreen.swift:20`) opens the Settings sheet at its root (`App/AppShell.swift:13-15`). Then Integrations, the Mercury row, authorize, Done (`SettingsScreen.swift:18`), then pull to refresh. |
| 108 Cap table Connect | 3 | about 6 | M. Same shape: `CapTableScreen.swift:38`. |
| 105 Legal first scan | 5 | 6 to 7 | M. Open Legal, "Add your OpenRouter key" (`LegalScreen.swift:55`) opens Settings root, Models, Connect a model (`ModelsScreen.swift:24`), the connect sheet, Done, then Allow (`LegalScreen.swift:68`), then Scan now (`:79`). |
| 104 Hide amounts | 2 | 2 plus a reopen | M for the toggle (`SettingsScreen.swift:81-88`). Reload behaviour is S. |

- **Decisions**: In 105 the user must choose between "Allow" and "Scan now" as two separate taps. 90% of users who open Legal want a scan. Finance Connect asks nothing extra (Mercury or Brex is a real choice).
- **Re-entry**: none typed. Navigation is re-done: the user already said "Connect" on a specific page and then re-finds the target in Settings (M).
- **Confirmations guarding nothing destructive**: none on these pages. Good.
- **Dead ends**: Finance/Cap table empty states end in the Settings sheet; after finishing, the page underneath still shows the empty state (finding 27, M for the load site: `FinanceScreen.swift:40`, `CapTableScreen.swift:56`, `LegalScreen.swift:47` each load only from `.task`; S that the `.task` does not re-run when a sheet closes, since the underlying view does not reappear).
- **Hesitations**:
  - Empty state "No accounts yet / Connect Mercury or Brex" has an unlabelled generic "Connect" (`FinanceScreen.swift:16-20`); the user cannot tell where it leads (S).
  - Cap table: "See who owns your company" and "Connect Carta" look identical when Carta is connected but nothing has synced (finding 50, M: the empty branch at `CapTableScreen.swift:34-42` has no connected case).
  - Legal: "Add your OpenRouter key" names a vendor the persona may not know, while Home's banner says "Connect a model" (`Home/HomeScreen.swift:114`). Two names for one task (M).

## 2. Take-away pass per screen

**Finance (`FinanceScreen.swift`)**
- Top card: Runway, Cash, Burn are the answer to 099; keep. The "Synced ..." footer (`:90-92`) is small and useful; keep.
- Sections after the card, in order: burn chart, Accounts, Upcoming, Spend with period picker, Where it went, Transactions (`:60-80`). Six sections for a glance. "Where it went" and Transactions both restate the Spend period; they are needed only for 100. Defer by putting them below the fold, which they already are. No removal proposed (S, needs device walk to judge length).
- Toolbar eye (`:30-37`) duplicates the Settings toggle; it is a deliberate accelerator for Finance and fine. But it is Finance-only, so a user who hides amounts here believes the whole app is masked (S).

**Legal (`LegalScreen.swift`)**
- Segmented "View" picker has an accessibility title only; fine.
- `statusSection` shows one of three states (needs model, needs consent, scan) in the same slot (`:53-93`). That is good progressive disclosure. The consent block prints the full disclosure text and one row per recipient before "Allow" (`:64-68`); this is required consent copy, keep.
- Footer "N Data room documents not yet checked" (`:89-91`) repeats what Scan now will do; low value, tiny. Keep.
- The three-state design means Allow and Scan now are always two separate visits to the same section. That is a step the model could carry (see JD-3).

**Cap table (`CapTableScreen.swift`)**
- Summary header: Fully diluted, Option pool, 409A, As of, company name as header (`:61-72`). Five facts; none unused by the persona's goal "ownership by holder". "As of" could move to the footer (S, small).
- Share classes section (`:13-22`) sits above Holders, but the stated goal is by holder. Hierarchy mismatch: Holders should be first (S).
- Holder row shows name, security, shares, Invested, percent (`:85-96`); percent is the key figure and is right-aligned, small. Fine.

**Settings Hide amounts (`SettingsScreen.swift:80-102`)**: one toggle among Appearance, Notifications, Usage. Fine.

## 3. The simpler version

Setup, any business page with a missing connection:
1. Open the page.
2. Tap the page's one button ("Connect Mercury", "Connect Carta", "Add a model").
3. Finish at the destination (the Integrations row or Models sheet opens directly).
4. Close; the page has already reloaded and shows data.

Legal first scan:
1. Open Legal. The status block shows the single next step.
2. Tap "Add a model" (opens the same connect sheet Home uses), finish it.
3. Tap "Allow and scan" (one button that grants consent, then starts the scan).
4. Wait.

Concrete changes: (a) deep-link the Connect buttons; (b) reload each page when the Settings sheet closes; (c) share one `hideAmounts` value in `AppModel` instead of each model reading `me` once; (d) merge Allow and Scan; (e) name the Legal blocker like Home.

## 4. Clarity issues

- "Connect" alone on Finance, and "Connect Carta" vs "Connect Mercury or Brex" (`FinanceScreen.swift:18-20`): the verb is clear, the destination is not (S).
- "Add your OpenRouter key" vs Home "Connect a model": same task, two names (M, `LegalScreen.swift:56`, `HomeScreen.swift:114`). The footer "Scanning needs a model." (`:60`) is the useful sentence.
- "Hide amounts" label flips to "Show amounts" in the Finance toolbar (`:34`) but the Settings label never flips; fine, but the Finance one is the only place that tells the state.
- Cap table "As of" with no date wording is acceptable.

## Proposals

- **JD-1** Connect buttons open Settings at the wrong level. Evidence: STORY-102, 108, 105; `FinanceScreen.swift:20`, `CapTableScreen.swift:38`, `LegalScreen.swift:55`, all set `app.showingSettings = true`, and `AppShell.swift:13-15` shows a bare `SettingsScreen`. Proposal: replace the Bool with a destination (for example `.integrations` / `.models`) that the sheet's `NavigationStack` pre-pushes; Legal can reuse the Home `.connectModel` sheet directly. Steps saved: 2 per path. Risk: low; deep link state must reset on close. Size M. Device walk: n.
- **JD-2** Pages go stale after Settings closes (findings 27, 50). Evidence: load only in `.task` (`FinanceScreen.swift:40`, `CapTableScreen.swift:56`, `LegalScreen.swift:47`). Proposal: `.onChange(of: app.showingSettings)` to false reloads the visible page (or one shared "settings changed" tick). Steps saved: 1 pull-to-refresh plus the confusion of an unchanged empty state. Risk: low (extra request). Size S. Device walk: y, to confirm `.task` does not re-fire.
- **JD-3** Legal needs two taps after setup. Evidence: `LegalScreen.swift:62-83`; consent and scan are separate states. Proposal: when consent is the only blocker, the button reads "Allow and scan" and does both; consent text stays visible above it. Steps saved: 1. Risk: consent must stay explicit, so the disclosure must remain on screen. Size S. Device walk: n.
- **JD-4** Hide amounts is read once per page and held per model (finding 29). Evidence: `LegalModel.swift:57`, `CapTableModel.swift:18`, `FinanceModel.swift:38`; three copies plus `SettingsModel.swift:14`. Proposal: one `hideAmounts` on `AppModel`, written by Settings and the Finance eye, read by every page. Also fixes the Finance eye not masking Legal/Cap table. Steps saved: 1 reopen per page (104). Risk: low. Size M. Device walk: y.
- **JD-5** Cap table empty state ignores the connected-but-unsynced case (finding 50). Evidence: `CapTableScreen.swift:34-42`. Proposal: if Carta is connected show "Syncing with Carta" or "Nothing synced yet" with a Sync action instead of Connect Carta. Steps saved: removes a dead loop (Connect leads back to an already-connected row). Risk: needs a connected flag from the server (not verified). Size M. Device walk: y.
- **JD-6** Legal blocker uses a vendor name. Proposal: reuse "Connect a model" wording from Home. Steps saved: 0 (clarity). Risk: none. Size S. Device walk: n.
- **JD-7** Cap table order: Holders above Share classes. Evidence: `CapTableScreen.swift:13-31`, story goal is "ownership by holder". Steps saved: 0 to 1 scroll. Risk: low. Size S. Device walk: y.
