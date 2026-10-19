# UXV-4 Approval and status colours don't match meaning — decision

Chosen (colour by meaning, no layout change):
- Answered approval card: Denied → destructive with an X icon; Allowed once / Always allowed → neutral foreground with a check icon; any other answer ("Answered: …") → neutral, no success green. Success green stays for completed actions only.
- Allow changes confirmation: the grant button uses the primary variant, not destructive (turning writes on is a permission grant, not a destructive act; every change still asks first).

Out of scope here (already filed): raw JSON on the card (#151), two approvals for one change (#150), Allow once vs Deny weighting (decide with #150).

Acceptance: unit tests for the outcome colour/icon per answer; the dialog's grant button meets 4.5:1; screenshots of a denied, an allowed and an answered-confirm card.
