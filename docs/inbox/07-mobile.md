# 07 — Inbox on mobile (Expo) and desktop

## Goal

Give mobile users the same Inbox the web page has (item 4): one list of mail across
connected accounts, a To do section, and a way to ask the Inbox agent. Mobile uses native
iOS controls and a pushed screen for the agent instead of a side panel.

**Desktop needs no change in this item.** Electron loads the web app
(`apps/desktop/src/main.ts` calls `loadURL` on the web origin), so the `/app/inbox` route
and sidebar row (items 4 and 6) and the agent panel (item 6) ship to desktop
automatically. The one desktop difference, hiding the native Google connect entry, is in
item 1 PR 2d.

## Screens and files

| File | Change |
| --- | --- |
| `apps/mobile/app/_layout.tsx` | Register `inbox` with `glassHeaderOptions(t("Inbox"))` and `inbox-message` with a plain title, next to `artifacts`. |
| `apps/mobile/app/index.tsx` | One "Inbox" row pinned at the top of the bot list (`ListHeaderComponent`), above the bots. It pushes `/inbox`. |
| `apps/mobile/app/inbox.tsx` | New. Inbox list screen. |
| `apps/mobile/app/inbox-message.tsx` | New. Message detail screen. |
| `apps/mobile/components/sandboxed-html-preview.tsx` | Add two optional props: `scripts` (default `true`, so artifacts are unchanged) and `onOpenLink`. |
| `apps/mobile/lib/mail-inbox.ts` | New. Typed `rpc` wrappers for `inbox.list`, `inbox.refresh`, `inbox.get`, `inbox.agent`, `inbox.todos.list` and `inbox.todos.setDone`. Sections come from `groupInbox` in `packages/core` (item 4), the same function web uses. |
| `apps/mobile/lib/locales/{de,ru,zh}.ts` | Translations for the new strings. `lib/i18n.test.ts` fails when a translation is missing. |

**Naming:** `lib/inbox.ts`, `lib/inbox-render.test.tsx` and `lib/inbox-retention.ts`
already exist. They refer to the home bot list, not mail. New mail code uses the
`mail-inbox` prefix so the two do not get confused. The route `/inbox` is free.

**Entry point:** the home screen header already has three native items (Activity,
Artifacts, Create) plus a search bar, so a fourth button would crowd it. A row at the top
of the bot list matches the web sidebar, where Inbox sits above the bot roster. The row
has no unread count in v1. Item 4's `inbox.unreadCount` is one indexed query and never
calls the mail provider, so adding it later is cheap.

### Inbox list (`app/inbox.tsx`)

- **Account picker.** It is shown only when two or more mail accounts are connected.
  - Up to three accounts: the existing `NativeSegmentedControl`, a SwiftUI segmented
    `Picker` from `@expo/ui` on iOS and pills on Android, with "All" plus one segment per
    account, in the list header.
  - More than three accounts: the existing `MenuPicker`, a native menu, because segments
    become unreadable at that width.
  - Labels use the account `label` from `inbox.list` (`Connection.displayName`).
  - With one account there is nothing to choose, so the picker is not shown.
- **Sections.** A `SectionList` with To do, Needs reply, Today and Earlier, in the same
  order as the web page. Empty sections are hidden.
- **To do rows.** Each row has a check symbol (SF Symbol `circle` /
  `checkmark.circle.fill` through `NativeSymbol`) that calls `inbox.todos.setDone` (item 5).
  The row is removed optimistically and comes back if the call fails.
- **Mail rows.** Each row shows sender, subject, snippet and time. The time uses the
  existing `formatThreadTime`. Tapping a row pushes `/inbox-message?messageId=…`
  (the cached row id; the server finds the account from it).
- **Refresh.** Native pull to refresh with `RefreshControl`, using the same props as
  `artifacts.tsx`. On focus (`useFocusEffect`) and on pull, the screen calls `inbox.list`,
  then `inbox.refresh`, then `inbox.list` again, the same sequence as web. The server-side
  60-second throttle makes repeated focus refreshes cheap. While `inbox.list` returns
  `triagePending: true`, the screen refetches `inbox.list` and `inbox.todos.list` with the
  same bounded schedule as web (item 5: every 5 seconds, at most 6 times), stopping when the
  screen loses focus.
- **Inbox agent.** A native header item set with `unstable_headerRightItems` on iOS,
  using the SF Symbol `bubble.left`. Its accessibility label is the agent bot's name, or
  "Inbox agent" when `inbox.list` returned `agent: null`. It pushes
  `/thread?botId=<botId>&name=<name>`, the same thread screen every bot uses, so the chat
  looks identical to every other bot's chat. When `agent` is null, the tap first calls
  `inbox.agent` (item 3's only creation path) and pushes the bot it returns. Android uses the
  `HeaderButton` fallback that `index.tsx` already uses.

### Message detail (`app/inbox-message.tsx`)

- The screen calls `inbox.get({ messageId })`. The header title is the subject. The
  from, to and date lines are plain `Text` above the body.
- **HTML body.** `SandboxedHtmlPreview` is the only HTML renderer in mobile; it is
  currently used for artifacts. It is safe for email:
  - It runs with no shared cookies or storage, and navigation is blocked.
  - The core CSP (`withSandboxedArtifactCsp`) allows only `img-src data:`, so remote
    images and tracking pixels are blocked.
  - Email is rendered with `scripts={false}`.
  - The `onShouldStartLoadWithRequest` handler still returns false for every
    navigation away from the document (deny-only, as today). It calls `onOpenLink`
    only when the request is a positively identified user tap: `navigationType ===
    "click"` (iOS only) and an `http:` or `https:` URL. `onOpenLink` opens it with
    `expo-web-browser`, which mobile already depends on. Every other navigation,
    including a `<meta http-equiv="refresh">` in the email, which works without
    JavaScript, is blocked and opens nothing.
  - Android reports `navigationType: "other"` for every request
    (react-native-webview 13.16.1), so a tap cannot be told apart from an automatic
    navigation. Links in email therefore do not open on Android in v1 (accepted,
    safe degradation). Revisit with a `postMessage` click bridge if users miss it;
    that needs scripts, which email rendering keeps off.
- **Plain-text body.** When a message has no HTML part, the body is selectable `Text`.
- **Remote images load.** The user asked for emails to load with their images, and web
  already does this. Email mode (`email` on `SandboxedHtmlPreview`) uses a CSP that
  allows `img-src data: https:` for email only; artifacts keep the data:-only policy.
  JavaScript stays off. Inline `cid:` images need nothing extra: `inbox.get` embeds them
  as `data:` URLs on the server. The remote-images preference
  (`lib/remote-images-preference.ts`) still covers markdown images in chat only.
- **Ask about this message.** A header item pushes the Inbox agent thread, the same as
  on the list screen. The message is not passed as context; v1 does not prefill the
  composer.

## Native components chosen

- **Account picker:** `NativeSegmentedControl` (`@expo/ui` SwiftUI `Picker`, segmented
  style) for up to three accounts, and `MenuPicker` for more.
- **Header actions:** native header items (`unstable_headerRightItems`), with the
  `HeaderButton` fallback on Android.
- **Refresh:** `RefreshControl`.
- **Large title and search placement:** `glassHeaderOptions`, as on the artifacts screen.
- **Errors:** `Alert.alert` for a failed to-do completion. A load error is shown as
  inline text, as on the artifacts screen.
- **No custom pills, sheets or side panel.**

## Data flow

1. The screens call the item 4 and item 5 oRPC procedures through `rpc<T>()` in
   `lib/api.ts`. This is the same client every mobile screen uses, and it already handles
   session, space, and AI-consent prompts. The server scopes every call to the session's
   space and user. Mobile adds no new endpoints. Response types come from
   `packages/contracts/src/inbox.ts`.
2. There is no disk cache in v1. The screen keeps the last result in state, reloads on
   focus and on pull to refresh, and uses the generation-counter guard from
   `artifacts.tsx` so a slow response for a previous account cannot overwrite the
   current one.
3. `inbox.list` returns `agent` (`{ botId, name }` or null) and `accounts` (empty when no
   mail account is connected), so one call drives the agent header item and the empty
   state. To-dos come from `inbox.todos.list`, called in parallel; when its `enabled` is
   false, the To do and Needs reply sections are hidden, as on web.
4. If `accounts` is empty, the screen shows the empty state (below) and makes no further
   calls.

## Copy

Every string is passed through `t()`.

| String | Where | Why it is needed |
| --- | --- | --- |
| "Inbox" | Home row and screen title | It names the destination. It is the same word as on web. |
| "All" | First segment | It selects the combined view. It matches the web tab. |
| "To do", "Needs reply", "Today", "Earlier" | Section headers | The same headers as the web page. Without them the grouping cannot be read. |
| "Connect mail" | The only content of the no-account state | A blank screen gives the user nothing to do. The button pushes the existing `/integrations` settings screen. It is the same string as web (item 4). No explanatory text is added. |
| "Inbox agent" | Accessibility label of the agent header item, only before the agent exists | The icon button needs a name; once the bot exists its own name is used. |
| "No mail" | Accounts are connected but the list is empty | It tells the user the empty list is the real result and not a failed load. |
| "Could not load mail." | Inline error on load failure | The artifacts screen uses the same pattern ("Could not load artifacts."). |

Once the agent exists, the header item uses the bot's own name as its accessibility label. The to-do check control's accessibility label is the to-do title.

## Tests

- **Mobile unit tests** use Vitest, under `apps/mobile/lib`, and run in CI through the
  root `pnpm test`.
- **Add `lib/mail-inbox-screen.test.tsx`.** It follows the pattern in
  `lib/integrations-screen.test.tsx`: render the screen with jsdom, mock `expo-router`
  and `./api`. It covers:
  - the no-account state, where the button pushes `/integrations`;
  - the account picker, which is hidden with one account and appears with two;
  - completing a to-do, where the row comes back if the RPC rejects;
  - the agent header item, which pushes `/thread` with the agent's `botId`, and with
    `agent: null` calls `inbox.agent` first.
- **Section grouping.** No mobile test; `groupInbox` is tested in `packages/core` (item 4).
- **A small `SandboxedHtmlPreview` test:** with `scripts={false}`, `javaScriptEnabled`
  is false; a request with `navigationType: "click"` and an https URL returns false and
  calls `onOpenLink`; requests with `navigationType: "other"` (a meta refresh, or any
  Android request) or a non-http(s) URL return false and do not call it; without
  `onOpenLink`, behavior is unchanged from today.
- **Maestro** (`.maestro/smoke.yaml`, `e2e/ios-screenshots`) is opt-in and local only,
  not CI. Optionally add an `ios-screenshots` flow for the inbox list.
- **What the PR must state.** CI cannot capture the native header items, the SwiftUI
  segmented picker, or WebView rendering. Per AGENTS.md, the PR has to say so and must
  not link a web screenshot.

## Dependencies

- **Item 4 (Inbox cache, RPCs and page): hard dependency.** Mobile uses `inbox.list`
  (accounts, rows, agent), `inbox.refresh`, `inbox.get` (HTML or text, rendered in the
  sandbox), and `groupInbox` from `packages/core`.
- **Item 5 (triage and to-dos): hard dependency for the To do section.** Mobile uses
  `inbox.todos.list` and `inbox.todos.setDone`, and the `priority`/`needsReply` fields.
- **Item 3 (Inbox agent):** `inbox.agent`, and the agent being an ordinary bot so that
  `/thread?botId=` works unchanged.
- **Item 1 PR 2d (connecting Gmail on mobile):** mobile hides the native Google
  connector in v1 (accepted) and connects Gmail through Composio or Pipedream on the
  existing `/integrations` screen. Google accounts connected on web or desktop work on
  mobile, because accounts belong to the user on the server.

## PR breakdown

1. **Mobile inbox list.**
   - The home row, the `inbox` route registration, `app/inbox.tsx`, and
     `lib/mail-inbox.ts`.
   - Locale entries.
   - Screen test.
   - The agent header item, which is small enough to include here.
2. **Mobile message detail.**
   - `app/inbox-message.tsx`.
   - The `scripts` and `onOpenLink` props on `SandboxedHtmlPreview`.
   - Locale entries.
   - The test for the preview props.

Both PRs merge after item 4 and item 5 PR 3 land. Neither PR changes desktop.
