# STORY-031: A teammate in the same space opens the Devin page

Verdict: convoluted for the teammate (7 catalog steps against an ideal of 5, including a forced detour through chat and a dead-end first screen). Most of the friction comes from per-user key entry, which protects nothing here because any org key shows every org session.

Evidence: mockup "Not connected" state and the connect dialog in `mockup-v2-full.png`; existing Integrations screen `refs/integ_with_connections.png` (each card shows Connected, "Used by" avatars, Remove, no owner name). Catalog: STORY-031, GAP-09, GAP-12, GAP-24 and open questions 1, 2, 13. Not exercised live: the page is planned.

## Friction Scorecard

| Measure | Result | Basis |
|---|---|---|
| Steps, catalog walk | 7 | Catalog steps 1 to 7. |
| Steps, Ideal path | 5 | Catalog: see Connect Devin, ask Maya for a key or create one, connect, see sessions. |
| Steps, simplest model below | 2 (open the page, read) | Design proposal, not measured. |
| Decisions | 4. Needless: whether to go to Integrations (the page has the Connect button already); whether to ask Maya or create a key; whether the key is shared. | Catalog steps 2 to 5. |
| Re-entry | Tom must obtain and type a key that Maya already entered. The product holds an org key and an org connection but asks again. This is the clearest "don't ask for what you know" violation (heuristic 3). |
| Confirmations | 0 extra. |
| Dead ends | 2. (a) The empty state is a title and one button, so Tom assumes it is broken since Maya said Devin is set up (catalog step 2, mockup "Not connected" state). (b) Integrations shows no Connected badge for him and no hint that a teammate did (catalog step 3, consistent with `refs/integ_with_connections.png`, which lists only the viewer's own cards). |
| Hesitations | Where to create a key (dialog hint says "starts with cog_" and nothing else); pasting a key from chat feels wrong; after connecting, which sessions are his (no owner column, no org label; GAP-09). |
| Leaks | Key pasted into chat (catalog step 5). A real risk, caused by the model, not the copy. |

## Take-away Pass

Screen 1: "Not connected" page (mockup). Title "Devin", one "Connect Devin" button.
- Nothing to remove. The problem is the opposite: there is not enough on it for a person who does not know what they need. Minimum fix is one line (below), not an explainer.

Screen 2: connect dialog (mockup bottom, existing): title, hint "An org-scoped Devin service-user key (starts with cog_).", API key field, Cancel, Connect.
- Hint is necessary but does not say where to create the key (GAP-38). One link, not a paragraph.
- Everything else is the minimum.

Screen 3: Integrations card for Devin: not a step Tom should need. Reaching it is a detour caused by the page not connecting in place.

Screen 4: the table as seen by Tom: sessions of the whole org, no owner (GAP-09).
- The org name in the header (catalog minimum for GAP-09) is the only addition that earns its place. The "From" column shows origin only, so the table cannot answer "which are mine"; do not add an owner column unless Devin returns a name (catalog says `user_id` is opaque).

## Simplest model: per-user key or one shared space connection?

From a UX standpoint, one shared connection per space is simpler, for these reasons grounded in the catalog:

- Per-user buys no privacy. Any member with any org key sees every org session, including confidential titles (GAP-09, catalog edge case "Prepare layoffs spreadsheet export"). Per-user only adds a key-entry step, a key-sharing problem (GAP-24), and a separate agent and bot per person.
- Shared removes Tom's steps 2 to 6. The second member opens the page and reads.
- Shared removes the chat-leak, and the "one revoked shared key breaks every page" risk remains but is one visible state with one owner to fix it, rather than N silent ones (GAP-04).

What per-user does give, and a shared connection must replace:
- Alerts go to the connector (GAP-12). With one shared connection, decide who is notified (catalog open question 2). Without that, a shared page with alerts to one person is the same teammate problem in another form.
- Authorization: AGENTS.md requires every record to be scoped to space and user and authorized on read and write. A shared connection is space-scoped; the page needs a rule for who may create and remove it (for example, any member to read, the creator or an admin to remove). That is a product decision, not UX copy, and I have not verified how `McpServer` scoping or roles work today beyond what the catalog states.
- The Devin agent: today it is per-user ("Your Devin account", catalog step 6). A shared connection implies one shared agent; its thread visibility is undefined (catalog edge case).

Recommendation: UX prefers the shared space connection; ship per-user first only if the shared model's authorization cannot be settled, and then add the three lines of page copy below. This is the catalog's open question 13 (recommended there: per-user for now). The UX cost of that default is measured above (7 steps, one dead end, one leak). Decision for the owner.

## The Simpler Version

If per-user stays (current plan):
1. Tom opens Devin from the sidebar.
2. The page shows the connect dialog content in place: the key field and Connect, with a link "Create a key in Devin". No separate Integrations visit.
3. He pastes the key and presses Connect; the table appears (the existing dialog already ends at "connected", GAP-21 says to go to the page).
4. Header shows the org name beside "Devin".

Steps 4 instead of 7; the chat detour remains if he lacks a key.

If a shared space connection is chosen:
1. Tom opens Devin; the table is there with the org name in the header.
That is 1 step. The first member connects once. Later members never see "Connect Devin" unless the connection is removed.

What the page must say, in either model (each line stated once):
- Not connected: "Connect Devin" with the dialog; in the dialog, a link to where service-user keys are created (GAP-38). One short line that the key reads sessions only is optional; the catalog does not require it, so I would leave it out.
- Connected: the org name in the header (GAP-09). Nothing about who connected it.
- Under per-user only: no "a teammate already connected" notice. Naming Maya exposes a person for little gain; it also would not unblock Tom, who still needs a key.

## Clarity Issues

- "Connect Devin" with no context reads as a broken page when someone has said it is set up (mockup "Not connected" state; catalog step 2). Under per-user the page cannot know the teammate's state without a query across users, which it should not expose.
- "Org-scoped Devin service-user key (starts with cog_)" uses three terms a first-time teammate may not know (org, service user, cog_). Link to the page where it is created rather than defining each.
- The Integrations Devin tile reads "Coding sessions and repo docs" (catalog) and shows no "Connected" for Tom; consistent with privacy but unexplained. Not fixable without the shared model.
- The page does not say which org's sessions it shows, so a teammate whose key is from a different org sees different data silently (catalog edge case; GAP-09).
- A teammate outside the Devin org sees nothing and nothing explains why (catalog variation). An empty state should say "No sessions in this org", not look like an outage (GAP-15).
- Notifications: a teammate who never connects hears nothing about a session waiting on them (GAP-12, catalog variation). If this stays, say so in the PR; no UI.
