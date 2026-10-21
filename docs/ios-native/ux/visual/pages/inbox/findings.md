# Visual findings: inbox boards, round 1

Boards: PG-A-Compose, PG-A-Cleanup, PG-A-InboxMessage, Sheet (outer Inbox), Split (inner sidebar + Inbox). Each judged at its own size (466x678 per outer frame, 890x626 inner). Evidence files: `shots/<Board>.png`, `audit.json`, `second-opinion.json` (muse-wonder and gemini-4-argon both ran). Tags: [own], [muse], [argon]. Every external claim was checked against the screenshot or board source; rejected claims are listed at the end.

Persona: a founder triaging mail in short sessions, replying briefly, and clearing newsletter clutter in bulk.

## Findings

| id | level | board | element | problem | norm violated | evidence | severity | found by | verified |
|---|---|---|---|---|---|---|---|---|---|
| V-inbox-R1-1 | group | Sheet (vs Split) | "Acme Payroll: Payment could not be scheduled" row | The one urgent item (payroll failed) sits under "Other mail today" with only an unread dot. Split shows a "Needs attention" tag for it; the outer display drops the tag. The founder triaging on the outer display can scroll past it. | C3 status in words, H2 weight matches importance, H5 consistency | Sheet.png rows 4-5; Split.png row "Needs attention" | P1 | own, muse, argon | yes |
| V-inbox-R1-2 | group | Sheet, Split, PG-A-Cleanup | Entry point to Cleanup | Cleanup is reachable only in PG-A-Cleanup frame 1, behind a fourth "More" icon that Sheet and Split do not have, and the menu holds that one item. The bulk-clear journey has no visible start on the two main Inbox boards and costs two taps (More, Cleanup). | I6 recognition, I5 Hick (no single-item menus), H5 | Sheet.png strip has 3 icons; Cleanup frame 1 has 4; Split strip has eye/star/filter/compose | P1 | own, muse, argon | yes |
| V-inbox-R1-3 | component | Sheet | Second dot before the preview line | Each unread row shows an 8 px unread dot and a 6 px dot before the preview. Both are white, so the second dot carries no information. In Split the same meaning is a text tag. | C3 not color alone, C2 | Sheet.png "Acme Payroll" and "Example Weekly" rows; source `labelColor` | P2 | own, argon | yes |
| V-inbox-R1-4 | screen | Sheet | Row actions | No swipe archive or reply is drawn. Triage means open, tap Archive, go back: three taps per message. | P1 category pattern (iOS Mail), I4 frequent actions near the work | Sheet.png rows | P2 | own | yes |
| V-inbox-R1-5 | screen | PG-A-InboxMessage | Reply and the single prominent button | Reply is an unlabeled icon in the glass strip with equal weight to Archive. The only prominent (light, filled) control is the "Ask Inbox agent" bubble, which is not the next step when reading mail. | H1 one primary action, H2 | InboxMessage.png | P2 | own, muse, argon | yes |
| V-inbox-R1-6 | group | PG-A-InboxMessage, PG-A-Compose | Reply, Reply all, Forward | Message view offers only Reply. Forward or Reply all needs: Reply, tap title, pick. Three taps and the title is not marked as a menu until you notice its chevron. | I4, I6, P1 (Mail: reply button opens Reply / Reply all / Forward) | InboxMessage.png strip; Compose frames 2-3 | P2 | own, argon, muse | yes |
| V-inbox-R1-7 | screen | PG-A-InboxMessage | Archive feedback | Archive in the strip has no drawn result (no undo, no return to list). Cleanup has Undo; single archive does not. | I3 undo for list-removing actions | InboxMessage.png; no sibling frame | P2 | own, muse | yes |
| V-inbox-R1-8 | component | PG-A-InboxMessage | Body text and attachment rows | Body is 15 px on a reading surface (iOS default 17 pt). Attachment rows measure 38 pt tall (target 44) and show no chevron or download cue, so tap result is unclear. | D1, I4, I1 | geometry check: rows 368x38; audit font sizes | P2 | own, muse | yes |
| V-inbox-R1-9 | screen | PG-A-Compose | Keyboard state | No frame shows the keyboard although a caret is in the body. Send sits bottom-left in the strip and the board does not prove it stays visible above the keyboard. | L2 primary action visible | Compose.png all 3 frames | P2 | own, muse | yes |
| V-inbox-R1-10 | component | PG-A-Compose | Close (X) with a typed draft | Tapping X with text typed has no drawn outcome (save draft, discard, confirm). Typed work can be lost. | I3 | Compose frame 1, `aria-label="Cancel"` | P2 | own, muse | yes |
| V-inbox-R1-11 | component | PG-A-Cleanup | "Spam 0" and "Skip inbox 3" in the bulk menu | "Spam 0" looks as tappable as the others yet would act on nothing. "Skip inbox" is mail-filter jargon and does not say it applies to future mail. | C1 plain labels, I8 disabled with reason | Cleanup frame 3 | P2 | own, muse, argon | yes |
| V-inbox-R1-12 | component | PG-A-Cleanup | "Archive 3" count unit | The button counts senders; the Done frame counts 101 conversations. Before tapping, the founder cannot see that 101 messages will be archived. | C1, C2 one concept one name, I3 | Cleanup frames 2 and 4 (48+31+22 = 101) | P2 | own, argon, muse | yes |
| V-inbox-R1-13 | screen | PG-A-Cleanup | Missing states | No "nothing selected" (button disabled), no in-progress, no failure, and Undo cannot reverse an Unsubscribe; the Done frame shows only the archive result and does not offer the two remaining senders. | I8 states complete, I3 | Cleanup frames 2-4 | P2 | own, muse, argon | yes |
| V-inbox-R1-14 | group | Split | Two search fields | "Search" in the sidebar and "Search mail" beside the Inbox title sit side by side with different implied scopes; the "+" next to the first has no visible meaning. | C2, I5 | Split.png | P2 | own, muse, argon | yes |
| V-inbox-R1-15 | group | Split (vs Sheet) | Right strip: eye, star, filter, compose | The eye is "Hide amounts" (a finance control) and the star "Important only"; neither is recognizable as a mail action. Sheet's strip is search/filter/compose, so the same screen differs by display. | A2, C1, H5 | Split source aria-labels | P2 | own, muse, argon | yes |
| V-inbox-R1-16 | component | Split | Tag colors | "Junk" is amber and draws the eye; "Needs attention" (payment failed) is gray. Color weight is inverted relative to importance. | H4, H2 | Split.png rows 3 and 5 | P2 | own | yes |
| V-inbox-R1-17 | component | Split | "Finance [N] mo" and "Inbox 42" | Visible placeholder text in the sidebar (deliberate per DS-03 but reads as unfinished). "Inbox 42" does not match Needs reply 3 + Other mail today 24. | C4, C2 | Split.png sidebar | P3 | own, muse, argon | yes |
| V-inbox-R1-18 | component | PG-A-Cleanup | Menu repeats the primary action | The menu's first item "Archive 3" duplicates the main button. | C2 | Cleanup frame 3 | P3 | own | yes |
| V-inbox-R1-19 | layout | Sheet vs PG-A-Cleanup frame 1 | Same Inbox drawn two ways | Cleanup frame 1 has no section headers, no preview line, no unread dots. Title size also varies: Inbox 28 (Sheet), 26 (Split), Cleanup and message titles 22. | H5, H3 | audit type sizes | P3 | own | yes |
| V-inbox-R1-20 | component | PG-A-InboxMessage | "to me" header | Does not reveal other recipients, so Reply vs Reply all is a guess; sender is not tappable for details. | I6 | InboxMessage.png | P3 | own, muse | yes |
| V-inbox-R1-21 | component | PG-A-Compose | Quote chip "..." and chevrons | The quoted-text chip is about 24 pt tall and unlabeled; Cc/Bcc is collapsed, so Reply all recipients are hidden before sending. | I4, I3 | Compose frames 2-3 | P3 | own, muse, argon | yes |
| V-inbox-R1-22 | screen | PG-A-Cleanup | No context line | Cleanup has no subtitle saying how senders are ranked (by count here). A first-time user must infer it. | C4 (inverse: needed context), I6 | Cleanup frame 2 | P3 | own | partly |

Spacing and type from `audit.json`: off-scale gaps (6, 10, 14) appear on every board, near-duplicates 10/12/14. No board has page scroll, offscreen primary action, overlap or low contrast. Split's two `<input>` are 20 px high inside a 40 pt pill, so the pill is the target and this is not a finding.

## Excellent as is

- Cleanup arithmetic: 48 + 31 + 22 = 101 matches the Done frame, and Undo is offered for bulk archive.
- Cleanup split button: one filled primary at thumb height with a secondary chevron.
- Compose headers (From, To, Cc/Bcc, Subject) are clean hairline rows; the attachment chip with size and remove is clear.
- Sheet's "Needs reply 3" section separates what needs the founder from other mail; row layout (sender, time, subject, preview) is easy to scan.
- Message header (avatar, name, date) is compact and the body reads with good line height.
- Strip pattern (camera pill, time, back, glass group) is the same on all outer boards.

## Second-opinion claims rejected or reduced

- muse: Send "unlabeled, reads as scroll to top" (P1). Rejected: up-arrow in a filled circle is the Messages convention and `aria-label="Send"` exists; kept only the keyboard concern (V-9).
- muse: sender checkboxes about 20 pt. Reduced: circles are 24 pt inside a 60 pt tappable row; not a finding.
- muse: attachment remove X below 44 pt in Compose. Accepted as P3 only (V-21 group), because the chip is the secondary target.
- argon: header rows consume ~170 pt in Reply. Not accepted; the rows are 46 pt each and the body still has most of the screen.
