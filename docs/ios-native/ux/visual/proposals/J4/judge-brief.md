# Judge brief: J4 Home order of Inbox, Pages and Personnel

Product: Praci, a planned native SwiftUI iPhone app for founders (chat with agents, plus pages such as Inbox, Finance, Legal). Boards are static mockups. Rules: glass only on floating nav; solid content; one tinted prominent action per view; prefer native iOS controls; minimal copy.

Problem: on the standard iPhone Home (393x852) the Inbox row ("3 need reply") sits in the PAGES card below the Personnel list and is cut off at the fold. The Duo sidebar (Split) orders Pages before Personnel, which disagrees with phone Home (Personnel before Pages). Personnel is sorted by recency (decided). Persona: a founder opening the app to see what needs them, then replying to mail or chatting with an agent.

Current phone order: Activity card (3 rows), Personnel (4 agents, 54 px rows), Pages card (Inbox, Finance, Legal, Cap table, Data room, Team computer; 44 px rows).

Proposals:
A. Move Pages above Personnel on every surface. Inbox stays first in Pages.
B. Replace the Pages card with a wrapping strip of chips (icon, name, count) above Personnel. Inbox first chip shows "3". Row subtitles such as "6 mo runway" are dropped.
C. Pinned smart-list row (Things Inbox / Apple Mail Inboxes / Linear Inbox): one Inbox row under the Activity card, above Personnel, removed from Pages. Same order everywhere: Activity, Inbox, Personnel, Pages.

Score each proposal 1-5 on: (1) Inbox visible without scrolling on phone and Duo outer display, and one consistent order across Home, Main, Split [x3]; (2) simplicity [x2]; (3) consistency with system patterns [x2]; (4) usability [x2]; (5) visual quality [x2]; (6) effort and risk in SwiftUI [x1]. Return a winner, an optional graft, and a short defense.
