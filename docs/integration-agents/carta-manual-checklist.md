# Carta migration: owner-only account checks

These checks require the maintainer's own Carta account. Automated validation uses synthetic
data and offline fakes only; it does not prove that Carta's current live API behaves identically.
Do not use production writes merely to validate this migration.

1. Before upgrading, record which Carta servers belong to each user and space and whether
   their Carta agent is active. Back up the database using the normal deployment procedure.
2. After migrating, confirm each Carta server links only to that same user's active Carta
   agent in that same space. Archived, missing, or mismatched agents must not be linked.
   Changes should be off. Existing assignment rows for other bots should still exist,
   but exclusivity should prevent those bots from using Carta directly.
3. Open Integrations → Carta. Confirm there is one general **Agent** section with the Carta
   agent link, **Allow changes in Carta** off, and **Only this agent** on. Confirm the
   existing **Open Cap table** shortcut still works. If no agent exists, **Create agent**
   should open the specialized Carta agent, not a generic duplicate.
4. Ask the Carta agent to read the cap table. Compare its figures with Carta; no mutation
   should be offered while changes are off. Refresh Cap table and confirm the existing
   populate run updates the page and investor contacts without sending mail.
5. If a safe non-production Carta account is available, turn changes on through the
   confirmation dialog. Request one harmless supported change. Inspect the full tool name
   and arguments on the approval card, then deny it; verify nothing changed in Carta.
   Only approve a subsequent change if you actually intend it. Each separate write must
   ask again, even with Auto Review or a saved allow rule. Turn changes off afterward.
6. Ask for an investor email draft. Verify that sending requires a fresh approval displaying
   the exact recipients (including cc/bcc), subject, and complete body. Deny the send unless
   you intend to send that actual message. A draft ID alone must not authorize sending.
7. Confirm another agent cannot directly use Carta while **Only this agent** is on. If you
   deliberately turn it off, previously assigned bots may regain allowed reads, never writes.
   Turn it back on after checking. Repeating a refresh must not reset the chosen setting.
8. Disconnect or remove a test server only if intended. Confirm its former agent cannot
   continue to call it, and reconnecting does not silently re-enable writes. Removing a server
   does not introduce new automatic archiving behavior.

Tool access remains exactly the Carta read list and the two write entry points (`mutate`,
`call_tool`). A newly advertised tool, even one annotated read-only, is not automatically allowed.
Report a mismatch for review instead of widening the allowlist to make a live check pass.
