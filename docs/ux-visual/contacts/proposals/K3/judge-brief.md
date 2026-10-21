# K3: Contact rows are not clickable as rows (Rakazo Contacts and Cap table tables)
Problem: only the 20px name text button opens a contact. The 56px row tints on hover, but clicking anywhere else does nothing. The cursor is the default arrow, and keyboard focus shows only an underline. On Cap table, rows that hold only Carta data have their own "Save as contact" and "Add email" buttons.

Acceptance criteria:
- A click anywhere on a contact row opens it, on both pages.
- The cursor is a pointer.
- The name keeps a visible focus ring.
- Nested buttons keep working.

A (Minimal): copy the finance table's call-site pattern: `TableRow onClick` plus `cursor-pointer` on both pages; the name button loses its own onClick (its click bubbles), and gets a ring on focus-visible. No design-system change. Effort S.

B (Restructure): the stretched-link pattern. TableRow gets an `interactive` option, and the name button gets an `after:absolute inset-0` overlay that covers the row; secondary controls get z-10. The row shows a focus outline through `has-[:focus-visible]`. Effort S. Risk: the overlay blocks text selection in rows.

C (Convention: Linear, Google Contacts, Attio): an optional `onOpen` prop on the ui-web TableRow, giving cursor-pointer and a click handler. The handler ignores clicks on other controls (via `closest` on button, a, input) and ignores clicks while text is selected (Gmail behaviour). The name stays the single tab stop with no onClick of its own (Enter bubbles), a 2px ring on focus, and a row tint while the name is focused. Carta-only rows stay inert. Effort S. It goes in the design system, with a story.
