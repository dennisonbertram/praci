# Brief: Praci iOS home and creation boards (round 2)

Praci is a planned native SwiftUI iPhone app for founders. A founder runs a small team of AI bots ("agents") in spaces, chats with them, approves their work (payments, drafts), and opens pages such as Inbox, Finance, Legal and Cap table. There is no Swift code yet; these are static dark-mode design boards for the iPhone Duo outer display (466x678 pt, a narrow side strip with avatar, bell, search and New).

Persona: a first-time founder, non-technical, on a phone between meetings. Wants to know in one glance what needs them, reach a bot in one tap, and set up a model, bot, group or space without help.

Design rules: glass only on floating nav and controls; solid content; at most three glass groups; exactly one prominent action per view; minimal copy; product name "Praci".

Boards and the step each serves (each board is a grid of labeled states):
- PG-A-Home (and Main, the same Home at one size): what needs me now, open a bot or page, create via New.
- PG-A-Activity: see everything the agents are doing, open the one that needs approval.
- PG-A-HomeNoModel: first run, connect a model, then message Chief.
- PG-B-Spaces: switch space, rename, delete a space.
- PG-B-NewBot, PG-B-NewGroup, PG-B-NewSpace: create a bot (name, role, color), a group (name, 2 to 6 members), a space (name), including dimmed, creating and error states.

Judge: does the user know where they are, what to do next, and can they get there in the fewest taps; are states complete; is it consistent across siblings.
