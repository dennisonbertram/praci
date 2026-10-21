# J3: Trust what agents saved (STORY-015, STORY-013)

Walked on the mock demo stack with browser session flow-j3. Screens are in `J3-trust-agent-saves-screens/`. "Measured" means I saw it in the walk; "suspected" means inferred from the catalog or the screens.

Walk: Chief chat, asked it to save Omar Example (Brightline Labs, NDA); Contacts list; open Omar; change Organization and Kind; Save.

## Friction Scorecard

| Item | Result |
|---|---|
| Steps to create the contact | 1 message, about 45 s wait, one reply "Saved Omar Example at Brightline Labs (Mock) as an important contact, noted as the counterparty on your signed NDA." (01-chief-reply.png). Measured. |
| Steps to read where it came from | Contacts, click name, read Notes: 3 (02, 03). Ideal is 3 today; the list gives no hint. Measured. |
| Steps to fix Organization and Kind | click name, edit Organization, pick Kind, Save: 4, same as the ideal path in STORY-013 (06, 07). Measured. |
| Decisions | Kind picker with 8 options. The agent chose "Other" for an NDA counterparty, which the user then has to correct (03). Measured. |
| Re-entry | None. All fields are prefilled. |
| Confirmations | None, and none needed. Save is undoable by editing again. |
| Dead ends | After Save the dialog closes with no toast and no row highlight (07). The only proof is the changed row. Measured. |
| Hesitation 1 | The list (02) gives no sign that Omar was added by an agent. The user has to open each contact to learn this. Measured. |
| Hesitation 2 | The Notes text says "provided by the user on October 20, 2026", so here the note records the source accurately. But it is free text written by the model and can be vague or missing (suspected, catalog STORY-015 variations). |
| Hesitation 3 | While in the open Kind select I pressed Escape to close the menu. The whole dialog closed and my Organization edit was discarded without a warning (05-after-escape.png, Omar reopened with the old Organization). Measured once; the select popup did not render in screenshots, so a real user may see it differently. |
| Noise | A "Chief finished" toast about an unrelated chat covered the lower right of the Contacts list right after Save (07). In this walk the chat was shared with other test sessions, so this is partly an artifact of testing (suspected). |

Verdict on the pure edit flow (STORY-013): minimal. The trust part (STORY-015) is acceptable: the answer exists but is only found by opening each contact.

## Take-away Pass

- Contacts list (02): nothing to remove. Four columns carry the task. Missing, not extra: a cue for "added by an agent".
- Edit dialog (03): the hint "Contacts are your address book. They do not change Carta." sits under Notes on a contact that has nothing to do with Carta. Removable or showable only on the Cap table (suspected value; catalog issue 29). Delete is the most visible colored control and is placed before Cancel and Save (03). Demote it (P3).
- Notes is the only place the source is written, and it is the last field, below Kind. It is also what the user most wants to read when reviewing an agent save. Reorder is not needed, but a short read-only "Added by Chief" line would remove the need to interpret free text (see change 1).
- Chat reply (01): it already names the organization and reason. It says nothing about the Kind it picked ("Other"). This is the one fact the user then has to fix.

## The Simpler Version

1. Ask Chief to save the contact. The reply names the Kind it chose, for example "Saved Omar Example (Brightline Labs, Other)". 
2. In Contacts, the row carries a small "Chief" mark, so agent saves are visible without opening anything.
3. Click the name. The dialog shows the note, and the source is also stated by the mark or a one-line read-only caption.
4. Change Organization or Kind, press Save. A toast "Saved" appears (as on Cap table) and the row is highlighted.

Changes needed to reach this: change 1 (mark in list), change 2 (reply names kind), change 3 (toast).

## Clarity Issues

- "Other" as the agent's kind for a legal counterparty (03). The agent choosing Other when it is unsure is reasonable, but the user cannot tell Other means "agent did not know". Suspected.
- Dialog title "Edit contact" is clear (03).
- "Adding a contact" is the live status label even for a contact that already exists (catalog issue 6; not reproduced in this walk).
- The footer hint about Carta is off topic here (03). Measured as present; its value is suspected to be low.
- After Save there is no wording at all, so the user infers success from the row (07).

## Ranked Changes

| Rank | Effort | Change | Files it would touch |
|---|---|---|---|
| P1 | M | Show which contacts an agent saved: a small marker (for example the agent name) on the list row, backed by a stored source field set by `contacts_save` / `contacts_add`. The backend owns the field. This answers "trust what agents saved" without opening every contact. | `apps/web/src/pages/Contacts.tsx`, `packages/adapters/src/contact-tools.ts`, `packages/db/src/contacts.ts` |
| P2 | S | Show a "Saved" toast and a row highlight after a Contacts save, reusing the Cap table pattern. | `apps/web/src/pages/Contacts.tsx`, `apps/web/src/components/ContactDialog.tsx` |
| P2 | S | Have the agent state the Kind it chose in its reply, and prefer a specific kind when the user gives a reason (NDA counterparty). Prompt or tool description change only. | `packages/adapters/src/contact-tools.ts` |
| P3 | S | Keep the Carta hint only on the Cap table dialog. | `apps/web/src/components/ContactDialog.tsx`, `apps/web/src/pages/CapTable.tsx` |
| P3 | S | Do not discard dialog edits silently when Escape is pressed while a select is open (verify first with a real mouse and keyboard; the walk used scripted input). | `packages/ui-web` select or dialog usage in `ContactDialog.tsx` |
| P3 | S | Move Delete after Save in tab order and make it a quiet text button. | `apps/web/src/components/ContactDialog.tsx` |
