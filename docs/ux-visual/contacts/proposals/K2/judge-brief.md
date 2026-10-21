# K2: The Undo notice collides with agent toasts (Rakazo Contacts, web app, monochrome shadcn/Base UI design system)
Problem: after a contact is deleted, a "Deleted <name> [Undo] [Dismiss]" notice is sticky at the bottom of the page column. The app's agent toasts (Base UI toaster) are fixed bottom-right, 28rem wide, with their bottom edge 88px above the viewport bottom; on phones they are full width. At 768px wide a toast covers Undo, so the click hits the toast. At 375px it covers the notice text. Undo and Dismiss have the same weight, the buttons are 28px tall, and a long name wraps to 4 lines.

Acceptance criteria:
- At 375, 768 and 1440, with a toast showing, `elementFromPoint` at Undo returns Undo.
- Undo is visually primary.
- Touch targets are at least 44px on coarse pointers.
- At 375 the notice is at most 2 lines.

A (Minimal): keep the separate notice and push it to the bottom of the scroll container with flex and mt-auto, so it sits below the toast band (it relies on the toaster's 88px offset; about 12px of clearance at 375). line-clamp-2, Undo becomes the filled primary button, coarse-pointer 44px buttons. Effort S. Risk: breaks again if the toaster offset changes.

B (Restructure): remove the separate notice. Undo goes through the one app toaster: add an `action` to the toast data, render it as a primary Button, and use the toast close X as Dismiss. The toast is persistent (timeout 0), and toasts with an action sort to the front of the stack. Clamp to 2 lines and use 44px coarse targets. Undo then survives navigation. Effort M. Risk: it touches the shared toaster used by agent notifications; non-action toasts must not change.

C (Convention: Gmail and Linear snackbars, Material): a new ui-web Snackbar component, fixed bottom-4, centred, z-40, at most 64px tall, so it lies in a band below the toasts (which start at 88px). Undo is primary, Dismiss is an icon X, 44px coarse targets, a spacer after the table, and the failed-restore copy is shortened. Effort S to M. Risk: there are still two transient systems, kept apart only by their offsets.
