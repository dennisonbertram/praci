# Clusters decided directly (one clear fix each)

- **K1, the dialog overflows.**
  - The design-system `DialogContent` gets `max-h-[calc(100dvh-2rem)]` with a scrolling body region, so the header and footer stay visible. The ui-web dialog fix applies to every dialog.
  - The Notes textarea gets a max height (about 10 lines) and scrolls inside.
  - The "Open <name>" button truncates (`max-w-full truncate`).
  - Acceptance: at 375x812 and 1440x900, with 2,000 characters of notes and a 60-character existing name, the title, all fields and Save stay reachable.
- **K4, validation.**
  - The form uses `noValidate` and validates email inline, with the same treatment as the duplicate error: `aria-invalid`, `aria-describedby`, and the error under Email.
  - After a failed Save, focus moves to the invalid field.
- **K5, the save highlight.** Use a stronger semantic treatment, such as an `inset ring` or `bg-accent` at full strength for about 2s, visible in both themes.
- **K6, focus.** After Clear filters, focus moves to Search. After Undo, focus moves to the restored row's name.
- **K8, phone rows.** Below the Email breakpoint, the Contacts Name cell shows the organization (or else the email) as a muted second line. Cap table contact cards drop the orphan dash.
- **K9, polish.** Kind matches the other fields' width. `resize-none` on the textarea. The hint and "Added by" get top spacing or a divider, so they don't read as help for Notes. The load error is centred like the empty state.
