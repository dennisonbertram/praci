# STORY-022: Away from the keyboard: OS notification and phone push

Verdict: **convoluted** as the code stands today, **minimal** after one small fix. A laptop OS notification click does not open anything (it only focuses the window), and a phone tap lands on an empty agent thread. Both are dead ends for the job "answer Devin".

Evidence used: `docs/devin/ux-paths/catalog.md` (STORY-022, GAP-02, 05, 07, 11, 40), `apps/web/src/lib/notification-delivery.ts`, `apps/mobile/lib/notification-open.ts`, `packages/adapters/src/notify-user.ts`, `apps/web/src/lib/use-sidebar-glance.ts`. No page, push or device was run.

## Friction Scorecard

| Measure | Laptop path (planned, today's code) | Phone path | Ideal |
|---|---|---|---|
| Actions to be answering in Devin | 4: click banner (window focuses on the old page), find the sidebar "Devin" row, click it, find the session row and open it, then answer | Not reachable: tap opens the Devin agent thread, with no session list; she must type "What is Devin stuck on?" and click an "Open in Devin" link: 4 to 5 | 2: tap or click the notification, answer in Devin |
| Decisions | Which page am I on, where is Devin, which row | Do I ask the agent, or open Devin myself | 0 |
| Re-entry | She returns to the page she left, then navigates | Opens a thread, possibly empty | none |
| Dead ends | Banner click does nothing useful (`shown.onclick = () => window.focus()` in `notification-delivery.ts`, measured by reading) | Thread with no list; mobile has no Devin page (GAP-07) | none |
| Duplicates | Laptop banner and phone push both fire; the banner is not "shown", so the 30 s phone push is not skipped (GAP-40) | | one, at most |

Measured vs suspected: the banner click and the 30 s delay come from code and catalog and were read, not run. The mobile misparse of `/app/devin` as bot id `devin` follows from the regex in `notificationOpenTarget` (`/^\/app\/(?:(g)\/)?([^/]+)\/?$/`): `/app/devin` matches with `botId` `devin`. I verified the regex by reading it; I did not run it.

## Take-away Pass

- **OS banner**: keep, but it must act on a click. Today its click handler ignores the notification link, so the banner informs and then strands her (GAP-11).
- **Phone push**: keep as the fallback. It is the only signal if the laptop is closed. Its tap target is wrong for this job today.
- **30 s phone delay**: keep. It exists so a laptop toast or banner can suppress the push. But a banner does not suppress it (only toast or seen does). Clicking the banner should mark the notification seen, so the phone push is skipped if she acts within 30 s. Leaving GAP-40 alone is fine; this click fix covers the common case where she does act.
- **Sidebar dot**: only matters if she misses both banner and push. Not part of the away path once the banner click works.
- **Page row**: not needed on this path when the link goes to the Devin session.

## The Simpler Version

Should the notification link straight to the Devin session? For the away user, yes, and more strongly than in STORY-021: there is nothing for her to scan, and she has no reason to see a Rakazo page.

Laptop:

1. Click the OS banner ("Devin has a question").
2. The Devin session opens in the browser; she answers.

Phone:

1. Tap the push.
2. The Devin session opens in the phone browser or Devin app; she answers.

Changes:

1. **Banner click opens the notification link.** Replace `window.focus()` with: focus, mark seen (so the phone push is skipped), then open the link (external via the opener, as in STORY-021). One handler change in `notification-delivery.ts`; this also fixes GAP-11 for every other notification, which currently has the same dead click.
2. **Phone tap opens the Devin session.** `notificationOpenTarget` returns only in-app routes today, so a Devin URL gives `null`. Add one case: a push carrying an external `https` link opens with `Linking.openURL`. This replaces the weaker plan in GAP-07 (put the Devin agent's `botId` in the push), which lands on an agent thread with no list. Fallback only if the session URL cannot be built (GAP-19): keep the `botId` approach.
3. **Do not add a Devin screen to mobile.** The catalog and the plan already say mobile is not getting one; a direct link makes one unnecessary.
4. **Leave the duplicate buzz (GAP-40) alone** as the catalog suggests, since mark-seen on click handles most real cases.

Risks I cannot settle from the code: whether a browser allows opening a new tab from a Notification click (generally allowed because the click is a user gesture, but untested here); how Electron's opener behaves from a Notification click; and whether the Devin session URL can be built from the session id (GAP-19, unverified).

## Clarity Issues

- Banner title "Devin needs you" shows Rakazo as the app, so she may think Rakazo needs something. Suggested: title `Devin has a question`, body `<session title>: <question>`. The OS banner has only room for these two fields.
- When the question text is unavailable (GAP-01), use the body `<session title> is waiting for your answer`, not an empty body.
- Phone: the push text must stand alone, since she may read it on a lock screen and decide to answer later. The session title plus question does that; do not shorten to "Devin needs you".
- Hide-money masking applies to the toast and OS text (`maskCurrencyWhenHidden`); the catalog found no issue for Devin text. No change.
