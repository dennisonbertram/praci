# Problems: Contacts visual pass (2026-10-20)

Sources: pages/contacts-page, pages/contact-dialog and pages/cap-table-contacts findings (56 findings in total).
Coverage: every inventory state was audited except the loading skeleton (seen once, not judged).

| Cluster | Title | Root cause | Findings | Sev | Acceptance criteria |
|---------|-------|-----------|----------|-----|---------------------|
| K1 | The dialog overflows the viewport | The dialog has no max height and no scroll region; the Notes textarea and the "Open <name>" button have no size limits | D1, F04 | P0 | At 375x812 and 1440x900, with 2,000 characters of notes and a 60-character existing name, the title, all fields and Save stay reachable, and the dialog never exceeds the viewport |
| K2 | The Undo notice collides with agent toasts | Two independent transient surfaces share the bottom of the screen | F01, F02, F10, F11, F12, C12, F26 | P1 | At 375, 768 and 1440, with an agent toast showing, `elementFromPoint` at Undo returns Undo; Undo is visually primary; touch targets are at least 44px on coarse pointers; a long name does not make a notice taller than 2 lines at 375 |
| K3 | Rows are not clickable as rows | Only the name button opens a contact | F03, F07, F22, C10 | P1 | Clicking anywhere on a contact row opens it, on both Contacts and Cap table; the pointer cursor shows; the name keeps a visible focus ring for keyboard users |
| K4 | Validation is inconsistent and inaccessible | Native `type=email` validation, no `aria-invalid`, focus lost after a failed save | D2, D3, D4, F15 | P2 | An invalid or duplicate email shows an inline error under Email, with `aria-invalid` and `aria-describedby`; after a failed Save, focus moves to the invalid field; no browser bubble |
| K5 | The save confirmation is invisible | The highlight token is about 1.1:1 | F09 | P2 | The saved row is visibly highlighted in both themes (at least 1.5:1 against the row background, or a ring), using semantic tokens |
| K6 | Focus is lost after transient actions | Elements unmount without moving focus | F08, C13 | P2 | After Clear filters focus goes to Search; after Undo focus goes to the restored row's name |
| K7 | The table density and column priority are off | Fixed column proportions; 56px rows; no max width | F05, F06, F18, C1, C2, C4 | P2 | At 1280 with the Carta panel open, Shares stays visible and Email is dropped before Name truncates; at 1920 the Contacts table is capped to a readable width; Contacts uses the standard Table density |
| K8 | Phone rows lose context | Columns are hidden with no secondary line | F13, C7 | P2 | At 375, each contact row shows its organization (or email) as a muted second line; contact cards on Cap table show no orphan dash |
| K9 | Dialog details | Assorted | D10, D14, F20 | P3 | Kind matches the other fields' width; no resize grip on the textarea; the hint and "Added by" are separated from Notes; the load error is centred like the empty state |

## Deferred (outside this feature, or already decided)
- C3, C5, C6, C8, C9, C11 and C14 are Cap table page layout predating this feature (Carta panel width, chart card height, holder cards, the tab strip, the auditors toolbar, the header).
- F16 and C15 (two "Search" fields): sidebar contact search was deferred in the flow report.
- F14 (empty-state action): the flow report decided the header button is enough. C9 flags the duplicated Add on Cap table, which supports that decision.
- F21 and F24 are app-shell and toast-component issues outside this feature. F27 (the app-wide type scale) is also app-wide.
- F17, F19, F23, F25, D5, D6, D7, D8, D9, D11, D12 and D13 are P3 polish, suspected, or a matter of taste; logged only.
