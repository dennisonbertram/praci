# Findings: ContactDialog (2026-10-20)

Evidence is in `shots/` and `audit.json` in this folder. Second opinions are in `second-opinion.json`. Attribution: [own] means this pass, [muse] and [argon] are the two external reviewers.

| id | level | problem | evidence | sev | found by | verified |
|----|-------|---------|----------|-----|----------|----------|
| D1 | layout | The Notes textarea auto-grows with no maximum, and the fixed, centered dialog cannot scroll. At 1440 twelve lines make the dialog 1241px tall; at 375 about 600 characters push Save to y=854 of 812. The title, Name and Save become unreachable. | shots/1440-long-text.png, shots/375-long-notes-overflow.png | P0 | own, muse, argon | measured |
| D2 | component | An invalid email shows the browser's native bubble over Organization. There is no inline error, no `aria-invalid`, and the error does not persist. | shots/1440-invalid-email-save.png | P2 | own, muse, argon | measured |
| D3 | component | The duplicate-email error never marks the field: no `aria-invalid`, no `aria-describedby`, neutral border. | shots/1440-duplicate-email.png | P2 | own, muse, argon | measured |
| D4 | group | After a failed Save, focus falls to `body`. | measured | P2 | own | measured |
| D5 | layout | The dialog re-centres and jumps 31px when the error appears. | shots/1440-duplicate-email.png | P3 | own | measured |
| D6 | group | Name is required, but nothing says so, and the disabled Save gives no reason. | shots/1440-from-captable-new.png | P2 | own, muse, argon | observed |
| D7 | component | The title follows the Cap table tab ("Add investor") even after the Kind is changed. | shots/1440-from-captable-new.png | P3 | own | suspected |
| D8 | component | The Delete text contrast is about 3.9:1. | shots/1440-edit-agent-saved.png | P3 | muse, own | suspected |
| D9 | component | Editing a long name puts the caret at the end, so the field shows the tail; Save is enabled with no changes. | shots/1440-edit-long.png | P3 | own | observed |
| D10 | component | Kind is 107px wide while the other fields are 352px, and the textarea resize grip shows on touch screens. | shots/375-from-captable-new.png | P3 | own, argon | measured |
| D11 | group | From the Cap table All tab, Kind defaults to Investor; Contacts defaults to Other. | shots/1440-from-captable-all-filled.png | P3 | own | measured |
| D12 | component | Close is 28px and Cancel, Save and Open are 28-32px: under 44px on a phone. | shots/375-duplicate-email.png | P3 | own, muse, argon | measured |
| D13 | page | The "Save <name> as a contact" variant is reachable only from a Carta holder without a contact. | shots/1440-story-prefilled-from-holder.png | P3 | own | observed |
| D14 | component | The Carta hint and "Added by" sit 12px under Notes in the same muted style, so they read as help for Notes. | shots/1440-edit-agent-saved.png | P3 | argon, own | measured |

## Excellent as is
- Duplicate-email recovery: the "Open <name>" button, and the error clears when the email is edited.
- Keyboard order, visible focus rings, and Escape returning focus to the trigger.
- Delete is separated from Cancel and Save, and Undo covers it.
- On mobile, Save is full width above Cancel.
