# Judge brief: J3 Scope of missing inner, laptop and standard-iPhone boards

Praci is a planned native SwiftUI iPhone app (no Swift code yet; the design boards are the spec). Poses: Duo outer display 466x678 (side strip), inner display 890x626 (1/3 + 2/3 flat, 1/2 + 1/2 half-folded, nothing interactive at x 435 to 455), laptop pose 626x890 (view top, controls bottom), standard iPhone 393x852. Rules: glass only for floating controls; at most three glass groups plus one tinted prominent action per view. Persona: a founder triaging mail with an Inbox agent and checking Finance.

Problem: most screens are drawn only for the outer display. Missing: Reply composer, Archive result, Inbox zero and Cleanup on the inner display (high/medium); Finance 1/3 + 2/3 and 1/2 + 1/2; where "Ask [page] agent" opens on inner; an agent thread with draft, chips and a queued message beside the Personnel sidebar; laptop poses for Artifact, Agent page, Agent list; standard iPhone boards for Artifacts, Settings, Account, Finance and sheets. The rules boards already hold a 12-step generation recipe and one rule card per page with inner, half-folded and laptop lines.

Option A (minimal): no new frames. Add rule lines only: Ask-agent destination, remove "folders" from the Inbox story, 393 pt rule, laptop-capable list.
Option B (draw every pose): a drawn frame for every page in every pose (about 30 frames and 6 new boards).
Option C (adaptive split view, as Apple Mail, Messages and Settings do with NavigationSplitView): one derivation recipe per layout family (List + detail, Live view + controls, Form/sheet, Thread) plus one drawn exemplar per behaviour that is not derivable: inner Reply, After Archive, Inbox zero and Cleanup frames; Finance 1/3 + 2/3 and half-folded with agent thread, chips and a queued bubble; one new PH-Pages board with Finance and Settings at 393 pt; recipe text states sheets and the other pages follow.

Score each option 1-5 on: meets acceptance, simplicity, consistency, usability, visual quality, effort and risk (5 = small and safe). Return a winner, an optional graft, and a short defense.
