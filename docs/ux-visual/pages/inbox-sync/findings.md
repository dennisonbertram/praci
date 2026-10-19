# Inbox sync-problem states — findings

Surfaces: healthy Inbox, rate-limited (no cache), Try again pressed, still limited after Try again, reconnect (no cache), cached mail plus notice (simulated by wrapping `fetch` so `inbox/list` returned `failedAccounts`/`rateLimitedAccounts`; rows and notice are the real components). Viewports 1440x900, 768x1024, 375x812. Mock demo stack only.

Totals: 13 findings — P0 0, P1 1, P2 6, P3 6.

Limits: the demo API stopped answering for several minutes late in the run. `768x1024-retrying-late` and `375x812-retrying-carryover` are retry shots, not settled ones; there is no settled 768 after-retry shot and no idle 375 rate-limited shot. Not tested: typing in Search on a failed empty state, hover tooltips, screen-reader announcements, recovery without Try again, Reconnect Gmail (starts OAuth). No state has page scroll or horizontal overflow at any width.

## Verdict per viewport and state

| State | 1440x900 | 768x1024 | 375x812 |
|---|---|---|---|
| healthy | Good. Rows dense, consent card above the list. | Good. | Good. Rows wrap to two lines cleanly. |
| rate-limited, no cache | Clear and calm, one bright action. Copy and button both say "Try again" (INB-6). | Same layout; sidebar takes 41% of the width (INB-12). | Not captured cleanly; layout in `375x812-after-retry` is fine. |
| Try again pressed | Label replaced by a small dark spinner on a dimmed pill; nothing else changes for 11 s or more (INB-1, INB-2). | Same; still spinning 13 s later. | Same. |
| still limited after Try again | Pixel-identical to the first failure (#161, INB-3). | Not captured settled. | Identical to the first failure. |
| reconnect, no cache | Same pattern, different title and button; consistent. | Fine. | Fits; button 131x32. |
| cached mail plus notice (simulated) | One red line and a small outline button above the consent card; reads as an error, not "this list is old" (INB-4, INB-5). | Line wraps; button right-aligned. | Line wraps; button 28 px high. |

## Findings

Evidence: measured (DOM or layout audit), observed (screenshot or interaction), suspected (code or inference). Found by: [own], [muse] meta/muse-wonder, [argon] google/gemini-4-argon.

| id | level | element | problem | norm | evidence | sev | found by | verified |
|---|---|---|---|---|---|---|---|---|
| INB-1 | component | Try again button | `disabled={retrying}` drops focus to `BODY` during and after the retry; the next Tab restarts at "Skip to content". | I7, A2 | measured (DOM probe, 1440) | P1 | own | yes |
| INB-2 | component | Retrying state | Label-less spinner for 11.4 s (1440) and over 13 s (768); copy above unchanged; spinner dark on a dimmed pill and `aria-hidden`, so assistive tech hears no status. Width stays 81.7 px, no shift. | I2, C3, A1 | measured; `1440x900-retrying.png`, `375x812-retrying.png` | P2 | own, muse, argon | yes |
| INB-3 | page | After a failed retry | Page ends exactly as it started; the alert text is unchanged so a screen reader likely hears nothing (suspected). Visible half is #161. | I2, C3 | `1440x900-rate-limited.png` vs `1440x900-after-retry.png` | P2 | own, muse, argon | visual yes, AT no |
| INB-4 | group | Notice above cached rows | Doesn't say the rows may be old, since when, or which of the two accounts failed (`syncErrorText` returns one string). | C3, I3, H5 | simulated `1440x900-banner-cached.png`, `375x812-banner-cached.png` | P2 | own, muse, argon | yes |
| INB-5 | component | Notice colour | Throttle is destructive red above cached mail but neutral grey with no cache; reconnect-with-cache is red too. Destructive is reserved for destructive meaning. | H4, H5 | `1440x900-banner-cached.png` vs `1440x900-rate-limited.png`; `text-destructive` in `Inbox.tsx` | P2 | own, muse, argon | yes |
| INB-6 | component | "Try again in a few seconds." above an enabled Try again | Says wait while the only action invites clicking now; the click then blocks 11 s or more. "Try again" appears twice; "limiting requests" is developer wording. | C2, C4, C1, I3 | observed; duration measured | P2 | own, muse, argon | yes |
| INB-7 | component | Button touch size | Empty-state button 81.7x32 and notice button 76.6x28 (`size="sm"`) at 375; below 44x44. | I4 | measured; `375x812-banner-cached.png` | P2 | own, muse, argon | yes |
| INB-8 | group | Reconnect vs rate-limit wording | Reconnect title states the cause, rate-limit title the symptom; "Sign in again" in text vs "Reconnect Gmail" on the button; no account named. | C1, H5 | `1440x900-reconnect.png` vs `1440x900-rate-limited.png` | P3 | own, muse, argon | yes |
| INB-9 | group | Notice above the consent card | The 28 px notice sits above a larger consent card with a bright Allow button, which outweighs the failure; notice pushes the list down 44 px (jump not timed). | H1, H2, L5 | observed; measured height 28 | P3 | own, muse, argon | partly |
| INB-10 | page | Search, filter and compose on a failed empty state | Stay enabled (disabled only with zero accounts); behaviour when typing not exercised. | I1, I3 | `Inbox.tsx` | P3 | own, muse, argon | no |
| INB-11 | layout | Sidebar | No mark on the Inbox nav item when mail is failing; a founder on another page has no hint. May be deliberate. | C3 | `1440x900-reconnect.png` | P3 | argon, own | yes |
| INB-12 | layout | 768 permanent sidebar | Sidebar is 316 px (41%); Inbox header wraps and Search drops to a second row. App shell, not Inbox-specific. | L6, L7 | measured; `768x1024-rate-limited.png` | P3 | own, muse, argon | yes |
| INB-13 | component | Focus ring on Try again | Computed ring 2.5 px at 42% alpha blue, possibly under 3:1 on the dark page (ratio not computed); script-set focus showed no ring. | A1, I7 | computed style | P3 | own | partly |

Likely sources (verified with `git ls-files`): `apps/web/src/pages/Inbox.tsx` (INB-1–5, 7–10, 13); `apps/web/src/lib/inbox-sync-error.ts` (INB-4, 6, 8); `apps/web/src/components/PageEmptyState.tsx` (INB-6, 8); `packages/ui-web/src/components/ui/button.tsx` (INB-7, 13); `packages/ui-web/src/components/ui/spinner.tsx` (INB-2); app shell (INB-11, 12).

Overlap: #161 covers the visible half of INB-3. #103 (light-theme status contrast) not repeated.

## Second opinions

Accepted after checking: cached list not marked stale; red vs grey for one condition; copy says wait while the button is live; no feedback after a failed retry; touch size; sidebar width at 768; no shell-level indicator.

Rejected or downgraded: [muse] "cached state mistaken for live mail, P0" → P2, the notice sits above the rows. [muse] "reconnect gets the weakest signal" → the real issue is INB-5. [argon] "red Try again text is low contrast" → measured about 6:1.

## Excellent as is

- Reconnect and rate-limit share one pattern (icon, title, one line, one button) and read as siblings.
- The empty state has one bright object, the action.
- Retry swaps the button's contents without moving anything (81.7 px idle and busy).
- Accessible name stays "Try again" with `aria-busy`; the alert text is a live region.
- No horizontal overflow or page scroll in any failed state.
- Cached mail stays visible when a sync fails.
- Reconnect, which retrying can't fix, offers Reconnect Gmail and no Try again.
