# J5 proposal A (minimal): add one permissions row, keep Account as the preferences home

Problem: "Allowed without asking" (the tools an agent may run without a prompt) is a row at the bottom of the AI data sharing page (PG-B-Settings, frame "AI data sharing"). Language, Appearance and Hide amounts are only in Account (PG-B-Account, frame "Account"). Server has a row in Settings and another in Account, plus the sign-in links. On PH-Pages the Settings frame differs from PG-B-Settings: it has "Archived agents", no Server row, and the profile and Account sit under the list.

## Design
- PG-B-Settings root: add a row "Allowed without asking" with the count "3" directly under "AI data sharing". Remove the "Allowed without asking" row from the end of the AI data sharing page, so the list lives in one place.
- PG-B-Account: delete the "Server" row. Server stays in the Settings root (and in the signed-out "Use a custom server" links). Update the Account note that said the row matches Settings.
- Language, Appearance and Hide amounts stay in Account.
- PH-Pages Settings frame: add the same rows so it matches PG-B-Settings.

## Cost
Smallest edit: two boards plus the PH-Pages frame. SwiftUI: one more NavigationLink. No new screens.

## Weakness
It does not move Language, Appearance or Hide amounts (RED-R3-19, V-account-R3-9). A person looking for Appearance still opens Settings and finds nothing, and Account keeps mixing identity with preferences.
