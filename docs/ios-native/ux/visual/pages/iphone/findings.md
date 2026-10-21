# Visual findings: iPhone boards, round 1

Boards: PH-Home, PH-Thread, PH-Inbox, PH-Computer (810x882, two states), PH-Spaces. Viewport 393x852 unless noted. Screenshots are in `shots/` (scratch, not committed); audits are in `audit.json`; the second opinions are in `second-opinion.json` (both models ran). Found by: [own] my reading of the screenshot; [muse] Meta MUSE Wonder; [argon] Gemini 4 Argon. "Verified" means I checked the claim against the screenshot or the DOM.

Audit summary: no page scroll, no horizontal overflow, no target under 44 pt except the Team/Private segments on PH-Computer (36 pt high). Off-scale spacing values: Home and Spaces 6, 7, 9, 10, 14, 18; Thread 3, 6, 10, 14; Inbox 6, 10, 14. Six font sizes on Home, Spaces, Thread and Inbox. The audit's "Team contrast 1.02" and "100% dead space" on PH-Spaces are false positives (a transparent background read as the page color; a scrim).

## Findings

| id | level | board | element | problem | norm violated | evidence | severity | found by | verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| V-iphone-R1-1 | page | PH-Spaces | Title "Personal", checked "Personal" row, content behind | Title and checkmark already say Personal, but the Inbox count 42, Finance, Legal and Northwind's activity behind the menu are unchanged. The user cannot tell whether the switch happened or the data is stale. | H5, I6, C3 | PH-Spaces.png vs PH-Home.png (same rows, title differs) | P1 | own, muse, argon | yes |
| V-iphone-R1-2 | page | PH-Home, PH-Computer | Home Pages and Activity lists; Computer board | The Team Computer has no door on Home (Pages lists Finance, Legal, Cap table, Data room, Artifacts) and none is drawn in the thread header. A user on Home cannot find where to watch or take control. | I6, I5, L7 | PH-Home.png; grep of PH-Home and PH-Thread boards finds no Computer | P1 | argon, own | yes |
| V-iphone-R1-3 | group | PH-Computer | "In control" header: X pill and Release pill | Two exits with different meanings (X closes the viewer, Release gives control back) and X sits where the Watching X was. A habitual tap could leave a live session still held, or end it. | I3, I1 | PH-Computer.png right panel | P1 | muse, own | yes |
| V-iphone-R1-4 | group | PH-Computer | Take control (bottom, full width) vs Release (top right) | The same toggle moves from the thumb zone to the far corner, the status pill moves from right to left, and Team/Private disappears. Releasing one-handed needs a reach and a search. | H5, I4, L5 | PH-Computer.png both panels | P1 | argon, muse, own | yes |
| V-iphone-R1-5 | page | PH-Computer | Remote screen card | The shared screen is a 365x440 pt box in portrait with about 190 pt of empty gradient under it. No zoom, fit-width or full-screen control is drawn, so reading and clicking a desktop page is unrealistic. | D2, I4, P1 | PH-Computer.png; audit deadSpace 393x170 on both panels | P2 | muse, argon, own | yes |
| V-iphone-R1-6 | component | PH-Computer | "Watching" and "In control" pills | Status is drawn as a glass pill identical to the buttons around it, so it looks tappable. It does not say who is driving or who else is watching. | I1, C3 | PH-Computer.png | P2 | muse, own | yes |
| V-iphone-R1-7 | group | PH-Computer | Team / Private segmented control | The two words are unexplained to a first-time user, and the control vanishes in control mode so the sharing scope cannot be checked. The segments are 36 pt high. | C1, I4, I6 | audit: Team 64x36, Private 74x36 | P2 | muse, own | yes |
| V-iphone-R1-8 | page | PH-Computer | Header | No title or name says which computer or which agent is at it. | I6, C3 | PH-Computer.png | P2 | own, argon | yes |
| V-iphone-R1-9 | layout | PH-Thread, PH-Computer | Glass groups | Thread has four (back, title, actions, composer); Computer Watching has four and In control has five (X, status, keyboard, Release, key bar). The rule is at most three. | Design-system glass rule | PH-Thread.png, PH-Computer.png | P2 | muse, argon, own | yes |
| V-iphone-R1-10 | component | PH-Computer | Key bar | Esc, Tab, Ctrl and arrows only, under a macOS-style window. No Cmd, Shift, Enter or Delete; text entry needs the separate keyboard icon. Keys measure at least 44 pt (Argon's 42 pt claim is wrong). | P1, I8 | PH-Computer.png; touch-target audit passes | P3 | muse, own | partly (width claim rejected) |
| V-iphone-R1-11 | page | PH-Thread | Draft card | The Send decision is shown without Ana's original message or the sending account. The user typed the instruction, so the context is partly there, but "Thursday" has no date. | I3, I6 | PH-Thread.png | P2 | muse, argon, own | yes |
| V-iphone-R1-12 | component | PH-Thread | Save / Send | "Save" is unexplained (saved where?). There is no Edit or Discard, so fixing one word means retyping an instruction. Save and Send are adjacent and similar in weight; Send is irreversible. | I3, C1 | PH-Thread.png | P2 | muse, argon, own | yes |
| V-iphone-R1-13 | component | PH-Thread | "Inbox agent is working" | The line sits directly under a finished draft that "I have not sent", so it is unclear whether the draft is final. | C3 | PH-Thread.png | P2 | muse, argon, own | yes |
| V-iphone-R1-14 | component | PH-Thread | Right pill: document and checklist icons | Two icon-only controls with no label or visible meaning. | A2, I6 | PH-Thread.png | P2 | muse, own | yes |
| V-iphone-R1-15 | component | PH-Thread | Message order | "Searched mail, 12 results" appears after "Here is a draft", so the tool step reads as happening after the result. | C3 | PH-Thread.png | P3 | own | yes |
| V-iphone-R1-16 | page | PH-Thread | Empty band above the first bubble | About 330 pt of empty space above the thread. Normal for a bottom-anchored chat, but it is where the original email could go (see V-iphone-R1-11). | D2 | PH-Thread.png | P3 | muse, argon, own | yes |
| V-iphone-R1-17 | page | PH-Home | Section order | Pages (five rows) come before Activity, where the one approval waits, and Personnel (Chief, the default chat) is below the fold with its second row faded out. The founder's two daily jobs, approve and talk to a bot, sit lowest. | H2, L7, I5 | PH-Home.png | P2 | muse, own | yes |
| V-iphone-R1-18 | component | PH-Home | Inbox card "3 need reply" and "42" | Two unlabeled numbers in one card; 42 is larger and reads as the count that matters. | C1, H2 | PH-Home.png | P2 | muse, own | yes |
| V-iphone-R1-19 | component | PH-Home, PH-Spaces | Finance row "[N] mo" | A literal template placeholder is visible. Legal shows a bare "2" with no unit, and the other Pages rows show nothing. | C1, H5 | PH-Home.png | P2 | muse, argon, own | yes |
| V-iphone-R1-20 | group | PH-Home | Activity and Personnel | Finance agent and Inbox agent appear in both lists with the same avatar. It is unclear whether a tap opens the work or the chat. | C2 | PH-Home.png | P2 | muse, own | yes |
| V-iphone-R1-21 | component | PH-Home | Activity status "Approve" | "Approve" is a verb styled like the passive "Working" and "Done" statuses (dot plus gray word), with no pill or chevron to show it needs a tap. | I1, C3 | PH-Home.png | P2 | argon, own | yes |
| V-iphone-R1-22 | page | PH-Inbox, PH-Home | Ana Ruiz row | Home says the reply to Ana is ready to send; the Ana row in Inbox has no draft cue. | H5, C3 | PH-Home.png vs PH-Inbox.png | P2 | argon, own | yes |
| V-iphone-R1-23 | group | PH-Inbox | Section headers vs rows | Headers and dividers start at x 16, row text at x 36. | H6, L4 | PH-Inbox.png; audit alignment | P2 | argon, own | yes |
| V-iphone-R1-24 | component | PH-Inbox | Chips "Needs attention" and "Junk" | The neutral gray chip carries the urgent word and the warning-yellow chip carries "Junk". "Needs attention" also sits next to "Needs reply" in the section header, two near-identical names. Junk mail with an unread dot sits in Today. | H4, C1 | PH-Inbox.png | P2 | muse, own | yes |
| V-iphone-R1-25 | component | PH-Inbox | Subject and preview in one line | Subject and snippet are joined by a dash and end mid-word. Rows 1 and 3 run to the edge with no visible ellipsis. | D1, C4 | PH-Inbox.png | P3 | muse, own | partly (clip seen, DOM check inconclusive) |
| V-iphone-R1-26 | component | PH-Inbox | Swiped "Weekly" row | The sender name is cut off on the left in this state, the row is 85 pt tall against 60 pt for a plain two-line row, and the Archive block is square. No Undo is drawn here. | I8, D3 | PH-Inbox.png | P3 | muse, argon, own | yes |
| V-iphone-R1-27 | component | PH-Inbox | Unread dot | The dot is level with the subject line, not the sender. | H6 | PH-Inbox.png | P3 | argon, own | yes |
| V-iphone-R1-28 | component | PH-Inbox | Large title "Inbox" | The title top is about 10 pt under the glass buttons; tight. | D3 | PH-Inbox.png | P3 | own | yes |
| V-iphone-R1-29 | component | PH-Inbox | Filter icon in the search pill | The sliders icon is ambiguous (filter or sort) and shows no active state. | A2, I8 | PH-Inbox.png | P3 | muse, own | yes |
| V-iphone-R1-30 | component | PH-Spaces | Menu | Weak scrim, so Finance "[N] mo" and Legal "2" stay legible beside the menu. The Space settings icon is a sliders glyph. A thick gray divider band separates the groups. | H4, A2 | PH-Spaces.png | P3 | muse, argon, own | yes |
| V-iphone-R1-31 | component | PH-Home | Inbox card | No trailing chevron, unlike the Pages rows. The "+" is the prominent action but unlabeled. | I1, A2 | PH-Home.png | P3 | argon, muse, own | yes |
| V-iphone-R1-32 | layout | PH-Home, PH-Spaces, PH-Thread, PH-Inbox | Spacing and type scale | Off-scale gaps (6, 7, 9, 10, 14, 18) and six font sizes on Home. | D3, H3 | audit.json | P3 | own | yes |

Rejected: Muse's "no bottom navigation" (P1/P2). The README states the tab bar is not adopted, and the Home hub plus back chevrons is the chosen pattern. Muse's "Thread has half-empty screen is P2" is lowered to P3 because bottom-anchored chat is normal.

## Excellent as is

- PH-Thread: the draft card has one prominent action (Send) next to a quiet secondary, in the thumb zone. [own, muse]
- PH-Home Activity: status uses a dot plus a word, never color alone. [own, muse]
- PH-Computer: each state has one labeled prominent action and a dot plus word status. [own, muse]
- PH-Spaces: the menu groups switching above New space and Space settings with the current space checked, matching iOS menus. [own, muse]
- PH-Inbox: "Needs reply" is its own first section. [own, muse]
- Avatars: shipped shapes and colors are used for Chief, Finance agent and Inbox agent. [own, argon]
- Home, Inbox and Thread headers use three or fewer glass groups at the top. [own]
