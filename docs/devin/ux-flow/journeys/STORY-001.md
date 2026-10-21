# STORY-001: Connect Devin from the Integrations tile

Verdict: **acceptable**. The connect form is already near the minimum (one field, one button). The extra cost is at the end: the flow stops at a dialog that does not lead to the Devin page, and the key hint does not say where to get the key.

Evidence used: `docs/devin/ux-paths/catalog.md` (STORY-001, GAP-21, GAP-38), `apps/web/src/components/integrations/IntegrationsHome.tsx` (lines 125, 435-446, 805-845), `apps/web/src/components/integrations/CustomConnectionDialog.tsx` (lines 229-233, 486-530, 860-880), the existing-app screenshots `integ_with_connections.png` and `custom_conn.png`, and the "Connect Devin" dialog in `mockup-v2-full.png`. All screenshots are in the session scratchpad `feature-request/` folder, not in the repo. I did not render the mockup again. No screenshot of the Devin tile exists (the reference note says the tile was not in the Storybook build), so tile appearance below is from the catalog text only.

## Friction Scorecard

| Measure | Result |
|---|---|
| Steps, actual | 5 (Integrations, Devin tile, paste key, Connect, Done) |
| Steps, ideal path in catalog | 5 |
| Steps, simpler version | 3 on first connect from the sidebar (see below); 4 from the tile |
| Decisions | 1 real (which key to paste). 0 needless. The bot-assignment step is skipped for Devin because `afterSignIn` goes straight to "done" when the server already has an agent bot (`CustomConnectionDialog.tsx:229-233`). Measured in code, not run. |
| Re-entry | 1. After "Done" she is back on the catalog and must find her own way to the new page. The Devin card's link goes to `/app/integrations/mcp/<id>`, and `page` is only set for Carta (`IntegrationsHome.tsx:125`). Measured in code. |
| Confirmations | 1 ("Done"), and it guards nothing. |
| Dead ends | 1: the "Devin connected" screen (a title and "Done", no onward action). The Carta version at least has a sentence (`CustomConnectionDialog.tsx:868-872`), and the card has "Open Cap table". |
| Hesitations | 3 (suspected, from the catalog, not observed with a user): (1) a letter tile instead of a logo; (2) not knowing where to create a `cog_` key; (3) after Done, where to look. |
| Data already known but asked | None. The URL is prefilled and hidden for first-party services (`CustomConnectionDialog.tsx:485-486`). |

## Take-away Pass

**Integrations catalog, Devin tile.** Name, subtitle "Coding sessions and repo docs", "Connect". One primary action. Nothing to remove. The letter fallback is a polish issue, not a flow issue; the Integrations screenshot shows Brex and Demo CRM with the same letter tiles, so it is consistent with the app.

**Connect dialog (mockup-v2-full.png, bottom).** Title, one-line hint, one password field, Cancel, Connect, close X.
- Cancel and the X do the same thing. This is the shared dialog pattern, so keep it.
- Two labels carry the same word: the title says "Connect Devin" and the label says "API key". Fine; they name different things.
- Nothing else is removable. Do not add an explainer paragraph (AGENTS.md).

**"Devin connected" screen.** A logo, the title "Devin connected", and "Done".
- Removable: the whole screen, as a stop. A success state that needs a click to dismiss and then leaves the user lost is the weakest point in this journey.
- Fact stated twice: "Connected" appears in this dialog title and again as the green badge on the card in the "Connected" section (`integ_with_connections.png`). Closing the dialog straight into the page makes both unnecessary.

**Catalog "Connected" section.** The new Devin card would show the badge and the "Used by" avatar. For a single-owner page agent the avatar stack adds little, but it is existing behavior for all cards; not this feature's concern.

## The Simpler Version

Target for the tile route (4 steps):

1. Open Integrations and click Connect on the Devin tile.
2. Paste the key.
3. Click Connect.
4. The dialog closes and the app opens the Devin page with the table loading. (Replaces "Done" and the hunt for the page.)

Target for the sidebar route (3 steps, matches the catalog note): click Devin in the sidebar, click Connect Devin, paste key and Connect, land on the page. This is STORY-002; it should share the same dialog and the same "close and go to the page" ending, so there is one connect behavior, not two.

Concrete changes, in order of value:

1. **Remove the "Devin connected / Done" stop; navigate to `/app/devin` on success.** This closes GAP-21. Reuse the `returnTo` mechanism already in `IntegrationsHome.tsx` (lines 836-841 call `navigate(back)` on close). The Carta dialog can keep its done view; Devin should not copy it.
2. **Add an "Open Devin" link on the connected card** (like "Open Cap table", `IntegrationsHome.tsx:125`) for later re-entry. This is a one-line addition to an existing pattern, not new UI.
3. **Make the key hint link to where the key is created** (GAP-38). One link inside the existing hint sentence, no new paragraph.
4. **Keep the form as it is.** One field, one primary button, disabled until the field has text (already true, `CustomConnectionDialog.tsx:698`).
5. Do not add a "what will Rakazo do with this key" explainer. The existing line "Credentials are encrypted and never sent to the model" (`CustomConnectionDialog.tsx:727`) already lives in the custom flow; if trust text is needed, show that one, do not write a new one.

Not recommended: a multi-step wizard, a bot picker for Devin, or a "test connection" button. The Connect click already checks the key.

## Clarity Issues

| Item | Where | Problem | Suggestion |
|---|---|---|---|
| "org-scoped" | Dialog hint, `IntegrationsHome.tsx:443` | Jargon. A founder may not know what scope means or whether her personal key works. | "A Devin service-user key (starts with cog_)." Drop "org-scoped"; put where to create it in the link. |
| "service-user key" | same | Devin term that Priya may not use. Without a link she must search Devin's docs. | Link the phrase to the Devin page where it is created. |
| "Connect Devin" vs tile "Connect" | tile aria-label `IntegrationsHome.tsx:293` | Consistent. No issue. | None. |
| Bot name "Devin agent" with description "Your Devin account" | catalog step 4 | The description says "account" while the key is an org service user, not her account. Suspected confusion, low impact. | Describe what it does, e.g. "Answers questions about your Devin sessions", or leave empty. |
| Success title "Devin connected" | `CustomConnectionDialog.tsx:866` | Clear, but dead end. | Removed by the navigation change. |
| One error for all failures | GAP-38, STORY-003 | Out of scope for this journey; covered by STORY-003. | See STORY-003. |
