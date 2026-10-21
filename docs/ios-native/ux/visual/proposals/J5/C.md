# J5 proposal C (convention): Apple Settings pattern, one grouped list with simple controls inline

Pattern named: iOS Settings app (and Apple Mail's Settings in the Settings app). One inset grouped list; a profile header at the top opens Account; a control that is only a switch or a short choice sits in the list as a switch or a menu row; a detail page exists only when there is a list to manage. Things 3 and Linear follow the same rule: Preferences are flat and short, and identity lives behind the profile row.

## Design
Settings root, top to bottom (PG-B-Settings frame "Settings", mirrored on PH-Pages):
1. Profile row "Sam Rivera / Account" (unchanged position on PG-B-Settings; PH-Pages moves it from the bottom to the top).
2. Models, Voice, Integrations.
3. AI data sharing, **Allowed without asking (3)**. The list leaves the AI data sharing page, which keeps only its three toggles.
4. **Hide amounts** (switch), **Appearance** (value System, opens a native menu: System, Light, Dark), **Language** (value English; opens the iOS Settings page for Praci, which is where iOS keeps per-app language).
5. Server (value Default; the only Server row in the app after sign-in) and Archived bots.

Account keeps only identity: name, email, Change password, Sign out, Delete account. Its Server, Hide amounts, Language and Appearance rows are deleted, and its note about Server is removed. PH-Pages Settings becomes the same list, and "Archived agents" is replaced by the label PG-B-Settings uses. Hide amounts here is the same flag as the eye on Finance; no new copy is added.

## Cost
Rows move, one new row, no new pages. Root grows to 10 rows plus the profile row; it scrolls on the 466 pt strip, which is normal for a Settings list. SwiftUI: List with Section, Toggle with @AppStorage, Picker with .menu style, a Button calling UIApplication.open with openSettingsURLString.

## Weakness
Root is longer than today. Language leaves the app for iOS Settings; if the product wants an in-app picker it is a standard pushed list, and nothing else in this proposal changes.
