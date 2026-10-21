# STORY-007 Find an investor on Cap table, then look in Contacts (pass)

Carta is connected in this demo, so this walked the catalog's connected variation (holders plus contacts, Carta agent panel on the right).

- Step 1: Cap table opens with summary cards, ownership chart and tabs All, Shareholders, Investors, Options, Auditors, Other.
- Step 2: the Auditors tab sets ?kind=auditor and lists only the holders, because no contact is an auditor now (another walker changed the seeded auditor to Advisor).
- Investors tab (?kind=investor): holders plus contacts Priya, Lee, Ada Example, Ada Example (WalkB), Dana. Other tab: Eve and Faye (both WalkB). The All tab lists holders and Investor/Auditor/Other contacts only; the Legal contacts (for example Fictional Law Group) are absent.
- Contacts with Kind Investor shows the same five contacts and with Kind Other the same two; Contacts has no Carta card or hint (checked), the hint is only on Cap table.
- Phone (390): tabs wrap to two rows; each contact row shows kind, organization and email under the name; no overflow, no spills.
- Not exercised: clicking a contact name on Cap table (same dialog as Contacts, walked in STORY-005).
- Errors: none.

## Flow Log
Actual 2 to the Auditors tab, ideal 2. Hesitation: Legal contacts exist only on Contacts, and the founder is not told that Cap table omits them (matches the stated new behavior, so not logged).
