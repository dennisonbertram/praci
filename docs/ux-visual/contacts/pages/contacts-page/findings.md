# Findings: Contacts page and ContactNotice (2026-10-20)

Evidence is in `shots/` and `audit.json` in this folder. Second opinions are in `second-opinion.json`.

| id | level | problem | evidence | sev | found by | verified |
|----|-------|---------|----------|-----|----------|----------|
| F01 | layout | At 768 a real agent toast covers Undo and Dismiss; `elementFromPoint` at Undo returns the toast. | shots/768x1024-toast-collision.png | P1 | own, muse, argon | measured |
| F02 | layout | At 375 the full-width toast overlaps the notice (343x34px). | shots/375x812-toast-collision.png | P1 | own, muse, argon | measured |
| F03 | component | Only the 20px name text opens a contact. The row tints on hover, but the rest of it does nothing. | audit.json smallTargets | P1 | own, muse, argon | measured |
| F04 | component | At 375, the "Open <long name>" button pushes the form to 508px inside a 343px dialog, so Save is cut off. | shots/375x812-dialog-duplicate-email.png | P1 | own | measured |
| F05 | layout | At 1920 the table stretches to about 1550px, and Email starts 480px from Name. | shots/1920x1080-populated.png | P2 | own, muse, argon | observed |
| F06 | page | Rows are 56px tall on a tool surface. | shots/1440x900-scrolled.png | P2 | own, muse | measured |
| F07 | component | Keyboard focus on a name shows only an underline, with no ring. | shots/1440x900-focus-name.png | P2 | own | measured |
| F08 | component | After Clear filters, focus falls to the body. | activeElement | P2 | own | measured |
| F09 | component | The saved-row highlight is about 1.1:1, and it is the only save confirmation. | shots/375x812-saved-highlight.png | P2 | own | measured |
| F10 | component | Undo and Dismiss have the same weight. | shots/375x812-deleted-undo.png | P2 | own, muse, argon | observed |
| F11 | component | The notice buttons are 28px tall on touch screens. | rects | P2 | own | measured |
| F12 | component | At 375, a notice with a long name is 98px and 4 lines tall. | shots/375x812-deleted-undo.png | P2 | own, muse, argon | measured |
| F13 | page | At 375, Email and Organization are dropped with no secondary line. | shots/375x812-populated.png | P2 | muse, argon | observed |
| F14 | page | The empty state is small text far from the only action. | shots/1440x900-sb-page-empty.png | P2 | own, muse, argon | observed |
| F15 | component | An invalid email gets the native browser bubble. | shots/1440x900-dialog-invalid-email.png | P2 | own | observed |
| F16 | group | There are two "Search" fields (sidebar and page). | shots/1440x900-populated.png | P3 | muse | observed |
| F17 | component | Empty cells are blank. | shots/1440x900-populated.png | P3 | muse, argon | observed |
| F18 | group | At 768 the Kind column is too wide while Email truncates. | shots/768x1024-populated.png | P3 | argon | observed |
| F19 | page | "No matches" drops the table header and does not restate the query. | shots/1440x900-no-matches.png | P3 | own, muse, argon | observed |
| F20 | page | The load error is left aligned while the empty state is centred. | shots/1440x900-sb-page-load-error.png | P3 | own | observed |
| F21 | page | The mobile top bar holds only a hamburger. | shots/375x812-populated.png | P3 | own, argon | observed |
| F22 | component | The cursor on the name is the default arrow. | computed | P3 | own | measured |
| F23 | page | The toolbar scrolls away on long lists. | code | P3 | own | suspected |
| F24 | component | The toast close X shows only on hover. | shots/768x1024-toast-collision.png | P3 | argon | observed |
| F25 | component | The edit caret lands at the end of the name. | shots/1440x900-dialog-edit.png | P3 | own | observed |
| F26 | component | The notice is page-local and lost on navigation. | code | P3 | own | suspected |
| F27 | group | The notice labels are 12.8px against 14px text; the app shows 9 font sizes. | audit.json | P3 | own | measured |

## Excellent as is
- The filter chip with a single Clear filters action, and the URL state.
- The inline clear on search.
- No horizontal overflow at any width.
- Reversible delete.
- `title` tooltips on truncated text.
- The duplicate-email error under Email with "Open <name>".
- A single primary action.
