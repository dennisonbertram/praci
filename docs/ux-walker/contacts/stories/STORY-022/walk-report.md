# STORY-022: Legal agent saves counterparties

Status: blocked by environment
Session: walk-c (walk-c2 after the first browser session hung)

## Screens
- step-3-consent: Legal agent replies 'Data Room consent is required for OpenRouter ... Allow it on the Legal page.' with an Open Legal link.
- step-4-legal: Legal page shows the consent card with Allow; four contracts listed.
- step-5-allowed: after Allow, resending gives a red banner 'The model provider did not accept your API key. Check it in Settings > Models.' with an Open Models settings button (step-6-key-error).

Geometry audit: pageOverflowX 0, no wrapped controls; unevenRows hits were the sidebar name/time rows and overflowSpills the message hover action bar, both intentional and not logged.

## Flow Log
The Legal agent uses its own OpenRouter model and the demo stack has no valid key, so no contacts were saved. Both error messages name the fix and offer a link; I treat the key failure as an environment limit, not a finding. I clicked Allow on the Legal consent card (a stack-wide setting, no contact data).
