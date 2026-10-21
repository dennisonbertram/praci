# ux-visual: mobile frames (round 2)

**Screens:** Granola `#screen-mobile` and Wispr Flow `#screen-mobile`, all 15 states, in light and dark at 1440x900.

**Method:** the mockup's timers were frozen before each capture. The frames were compared with the real mobile code:

- `apps/mobile/components/settings-group.tsx`
- `apps/mobile/app/(settings)/integrations.tsx`
- `apps/mobile/app/(settings)/voice.tsx`
- `TodoCard` in `apps/mobile/app/inbox.tsx`

**Second opinions:** MUSE Wonder and Gemini 4 Argon, in `second-opinion.json`.

**Counts:** there are no P0 findings, 3 P1, 12 P2 and 5 P3. Both external models rated M-4 and M-9 as P0; we kept P1, because nothing is lost.

| id | level | element | problem | norm | evidence | sev | found by | verified | target |
|---|---|---|---|---|---|---|---|---|---|
| M-1 | group | Granola footer, Key rejected | The "Business plan" hint shows only in Empty; a rejected key removes it | C3, I3 | key-empty vs key-rejected | P1 | own, argon | yes | mockup |
| M-2 | comp | "Business plan" footer | Fragment with no verb; mobile has no key link | C1 | key-empty | P2 | own, argon | yes | plan, mockup |
| M-3 | comp | Secondary text | Contrast is 3.44:1 and 3.08:1 in light; amber "Today" is 3.64:1 | A1 | audit.json | P2 | own, muse | measured | mockup |
| M-4 | group | Needs reconnect | A healthy "Synced 42" sits above a stale error, and the second group has no header | C3, I3 | key-reconnect | P1 | own, muse, argon | yes | mockup |
| M-5 | comp | "From:" prefix | Contradicts plan S5 and the real `TodoCard` | H5 | inbox-todos | P2 | own | yes | mockup |
| M-6 | comp | To-do row tap | A tap anywhere on the row completes it, with no undo; Reminders uses the circle only | I3 | interaction | P2 | all | yes | plan |
| M-7 | screen | Inbox after all done | An orphan "TO DO" header remains | I8 | inbox-all-done | P2 | own | yes | mockup, plan |
| M-8 | comp | Syncing and Connecting | No spinner; Syncing reads like an empty list | I2 | key-connecting, inbox-syncing | P2 | all | yes | mockup |
| M-9 | group | Wispr Connected | No active marker, and "Connected" takes the checkmark's slot | I6, H5 | wispr connected, voice.tsx | P1 | all | yes | mockup |
| M-10 | comp | Consent footer | Removed while Verifying and when Connected | I3 | wispr verifying | P2 | own, argon | yes | mockup |
| M-11 | comp | "Could not connect this voice provider" | Does not separate a rejected key from a network failure | I3 | wispr rejected | P2 | all | yes | plan |
| M-12 | group | Consistency with the real app | The real app uses title-case 13 pt headers, rows of 52 pt or more and a NativeActionButton | H5, H1 | settings-group.tsx | P2 | own | code | plan, mockup |
| M-13 | layout | Granola group position | Placement in the real searchable catalog is not drawn | L7 | key-empty | P2 | own | partly | plan |
| M-14 | comp | Connect with an unchanged rejected key | Connect stays enabled and repeats the same failure | I3 | key-rejected | P3 | own, muse | yes | mockup |
| M-15 | comp | Back button | 40x40, not focusable; outline none | I4, I7 | audit.json | P3 | own, muse | measured | mockup |
| M-16 | screen | No Typing state | The keyboard would cover Connect at y=734 | L2, I8 | key states | P2 | own, muse | yes | mockup |
| M-17 | comp | Placeholder as the only label | Acceptable because the group has a header | A2 | key states | P3 | own | yes | none |
| M-18 | comp | Slack row | No chevron | I1 | key-empty | P3 | all | yes | mockup |
| M-19 | comp | Wispr checkmark before the key verifies | The real `chooseProvider` does the same; plan question | I6 | wispr key | P2 | muse, own | yes | plan |
| M-20 | comp | "2 more" row | No disclosure cue | I1 | inbox-todos | P3 | muse | yes | mockup |

**External claims rejected:**

- Muse's "Connect mail" upsell, already decided by FX-14.
- A paste or clear button on a native SecureField.
- Muse's "consent after the action": the sentence is already above Connect.
- Argon's missing Inbox navigation chrome: the mockup abbreviates it.
- Argon's wrapped to-do row: cosmetic only.

**Excellent as is:**

- The inset grouped list with a glass back button.
- One status row and a red Disconnect row.
- A dimmed Connect that enables on input.
- Distinct wording for a rejected key and an unreachable Granola.
- Flow as one more row in the providers list, with an exact consent sentence.
- The zero-account Inbox layout.
- The dark theme.
- Rows of 62 pt or taller.
