# Investors and Fundraising plan

## Summary

The Cap Table page becomes **Investors**: the cap table (from Carta, a Google Sheet,
or a table the founder types in), investor and board contacts, investor updates with
a reminder, an investor portal behind a per-investor link, and investor audit
requests as action items the agent pre-fills. A new **Fundraising** page runs a SAFE
round: the round, a pipeline of prospects, and the SAFEs (native, or synced read-only
from Mercury). One new page agent, the **Investors agent**, does the drafting and
answers questions on both pages; the Carta and Mercury agents stay connectors.
Contacts stays its own page and remains the general address book (it exists on main
since #465/#496); Investors shows only the investor, board and auditor contacts, with
their portal state, and Fundraising shows prospects.
Approved design: [mockup.html](mockup.html) (a view menu at the top lists every state;
the URL hash picks one, for example `mockup.html#safe-dialog`). Evidence: [research.md](research.md).
UX pass that shaped this revision: [ux-flow/report.md](ux-flow/report.md) and the
plan gaps in [ux-paths/catalog.md](ux-paths/catalog.md).

Web and desktop ship first. The Investors agent is an ordinary bot, so its chat and
its notifications already reach the mobile app; the pages and the portal do not (see
each slice's mobile line).

## User stories

From the framing (confirmed 2026-10-20). An early founder, pre-seed to Series A,
often without a lawyer or CFO:

1. **Sees who owns what** without Carta: from Carta when connected, from a Google
   Sheet they already keep, or from a table they type in. Holders, security, shares
   or amount, SAFEs unconverted, fully diluted percent.
2. **Reviews a drafted investor update instead of writing one**: the agent drafts
   from Finance (cash, burn, runway), the cap table and past updates; the founder
   edits and sends from their own mailbox; a monthly or quarterly reminder keeps the
   cadence.
3. **Gives investors a portal**: a link, no Rakazo account, showing the updates sent
   to investors and only the documents shared with that investor.
4. **Handles audit requests from a pre-filled draft**: the request (email or DocuSign
   notice) is filed in the Data room, listed as an action item on Investors, and the
   agent drafts the answer. The founder signs and submits.
5. **Keeps the board in touch**: board members are contacts; a board update is drafted
   and sent the same way as an investor update.
6. **Runs a SAFE round on Fundraising**: pipeline of prospects by stage, SAFEs tracked
   from Mercury's SAFE flow when Mercury is connected, otherwise a native SAFE with a
   filled cover summary and the official YC form, and Mercury deposits matched to
   SAFEs where that can be seen.

## Decisions (founder, 2026-10-20)

1. **Sidebar: Cap Table becomes Investors** (cap table, updates, audits, board).
   **Fundraising is a separate page.**
2. **Portal is a link, no account.** An investor contact with portal access sees
   every update sent or posted to the investors audience (including ones sent before
   the contact was added) and only the Data room documents shared with them. Board
   updates never appear. Investors never get a Rakazo account or a space membership.
3. **SAFEs: Mercury preferred.** Track Mercury SAFE requests and deposits read-only.
   Without Mercury, fill the YC post-money SAFE and the founder sends it for
   signature themselves.
4. **Audits: the agent drafts, the founder signs and submits.** Nothing is signed or
   confirmed on the founder's behalf.
5. **Portal link model.** Every send, Resend or copied link mints a new token for
   that contact, carried in the URL fragment (`/portal/open#<token>`) so it never
   reaches a server request line or proxy log. The landing page reads the fragment
   with JavaScript; only the POST from its Open button starts the session, and the
   page then removes the fragment. A contact can hold several live tokens; each
   expires 90 days after it was issued, so every email the investor keeps still
   works until then. A link opens a portal session, a separate random value in a
   `PortalSession` row. Revoke deletes all of the contact's tokens and sessions and
   sets `Contact.portalBlockedAt`: every link and every open session
   refuse at once; Unblock restores nothing, a new link must be sent.
   Trade-off, accepted: a forwarded link works for whoever holds it until expiry or
   revoke; the founder sees "Opened" dates per contact.
6. **One message per investor.** An update goes out as one email per recipient, each
   carrying their own link, never one Bcc message. Gmail's daily sending limits are
   an assumption to confirm (see Assumptions).
7. **No board reminder.** "Message the board" on the Board tab is the board path; one
   Reminder menu sets the investor update cadence.

8. **Mercury is the only record of a Mercury SAFE** (founder, 2026-10-21). Rakazo
   never creates, edits or converts a SAFE row for a SAFE sent through Mercury; it
   marks the prospect "Waiting for Mercury" and attaches the Mercury SAFE to the contact
   on sync (rule in the Glossary).
9. **Commitments belong to their round** (founder, 2026-10-21). A Committed prospect
   counts toward the round that was open when the stage was saved; after that round
   closes it counts in no later round until it is marked Committed again.
10. **No public link-recovery form** (founder, 2026-10-21). An investor whose link
    lapsed asks the founder, who uses Resend link; every update email carries a fresh
    link.
11. **Rakazo creates post-money cap SAFEs only** (founder, 2026-10-21). Discount or MFN
    SAFEs are made outside Rakazo (for example in Mercury) and arrive through sync.
12. **Ownership bar, not the donut** (founder, 2026-10-21). The approved bar replaces
    `OwnershipDonut` on Investors; the donut component and its story are removed in slice 3.
13. **Delete asks first when a contact has linked data** (founder, 2026-10-21). Plain
    contacts keep main's Delete with Undo; a contact with portal access, shares, a stage,
    SAFEs or audit items asks first and names what will be removed.
14. **The Investors agent is created when Investors or Fundraising first opens**
    (founder, 2026-10-21), because the update reminder and audit intake need it to exist.
15. **The Investors agent is blocked over Photon**, like Finance and Legal (founder,
    2026-10-21), since it reads cap table, financial and investor data
    (`messaging-policy.ts`, slice 2).

16. **Keep one-step Undo after a cap table source switch** (founder, 2026-10-21): the
    snapshot keeps the previous table in one column and Undo restores it once.
17. **Keep Post to portal** (founder, 2026-10-21): the no-Gmail path stays.
18. **Action items and counting** (founder, 2026-10-21): a drafted update stays an action
    item until sent or deleted; a Mercury SAFE not attached to a prospect in a round counts in
    no round bar; a signed SAFE's flip to investor is never reversed automatically.
19. **One audit in two threads shows as two rows** (founder, 2026-10-21); the founder
    dismisses one.

Standing constraints: no hosted vendor required (Carta, Google, Mercury, Gmail are
optional adapters); every row scoped to space and user; email goes out only on the
founder's click; minimal copy; a story per component; mobile parity or an explicit
degrade; no real figures in the repo.

## Glossary (one name per concept)

- **Contact**: the person record (`Contact`). Main already has the kinds investor,
  auditor, customer, vendor, partner, advisor, legal and other; this plan adds board
  and prospect. "Holder" is only the cap table column; "prospect" is a contact with
  a stage.
- **Update**: an `InvestorUpdate` row with an audience (investors or board). Never
  "note" or "board update" in the UI.
- **Committed**: a pipeline stage only. On the round bar, money promised but not yet
  signed is **Pending**: committed prospects of the open round with no SAFE, plus Draft
  and Sent SAFEs, at their amount. Every SAFE counts exactly once (the SAFE counting rule below).
  SAFE money that is signed is **Signed**; paid is **Funded**.
- **SAFE counting rule** (the one place it is written; every other section refers
  here). Mercury is the only record of a Mercury SAFE: Rakazo creates no native SAFE
  for one (a synced `Safe` row is a read-only cache of Mercury's record) and never edits one (status, dates, terms and amount come from Mercury on
  sync; the Mark actions exist on native SAFEs only). Status of a Mercury SAFE: Canceled
  when `canceledAt` is set; else Funded when `paidAt`; else Signed when both signature
  dates are set; else Expired when `expiresAt` has passed; else Sent (a Mercury SAFE
  exists only once it was sent). Canceled and Expired count zero; Draft, Sent, Signed and
  Funded are the **active** statuses. With Mercury connected, Send SAFE on a Committed
  prospect opens Mercury's SAFE page and sets `Contact.mercurySentAt`; the prospect
  shows **Waiting for Mercury**, stays in the pipeline and keeps counting in Pending at
  its check size. On sync, a new Mercury SAFE whose investor email, trimmed and compared
  without case, equals a prospect's email attaches to that contact (`Safe.contactId`);
  emails are unique per owner, so at most one contact matches. The prospect leaves the
  pipeline, its check size stops counting, and the SAFE counts by its Mercury status.
  A Mercury SAFE with no matching contact is listed with its status and offers
  **Assign to contact** (a picker of prospects and investors) but is in no round bar:
  a SAFE counts in a round only through the `roundId` of the contact it is attached to,
  so a SAFE attached to an existing investor with no round, or not attached, counts in no
  round. Assigning attaches it and removes that prospect's check size from Pending. Attaching clears the contact's
  `mercurySentAt`. An attached Mercury row's menu is Open and **Unassign**, which
  detaches the SAFE (to fix a wrong match: Unassign, then Assign to contact): the
  contact keeps its kind and stage, and its check size counts again if it is still a
  Committed prospect. A contact that flipped to investor on Signed stays an investor;
  the founder edits the kind if that was wrong. **Disconnecting
  Mercury changes nothing about these rows**: they stay as last synced, labelled "from
  Mercury", read-only (Open, Assign to contact, Unassign), with no native conversion and no
  Delete; reconnecting refreshes the same rows by their owner-scoped `externalId`, so each
  counts once. A prospect Waiting for Mercury stays in that state, whether Mercury is
  connected or not, until a SAFE attaches or the founder chooses **Not sent** (clears
  `mercurySentAt` and restores the normal prospect row); its row menu has **Open
  Mercury** (reopens the SAFE page), Not sent, Passed and Edit prospect, and no Move to,
  so a Waiting prospect never leaves Committed and its check size always counts, and it
  never gets the native Send SAFE while waiting. Native SAFEs (no Mercury) are unchanged:
  a Draft or Sent native SAFE counts at its amount and the prospect has left the
  pipeline (a prospect whose only SAFE is canceled or deleted before it was signed returns
  to the pipeline; once Signed the contact is an investor and stays out). The one way to count the same money twice is an email mismatch: the
  prospect's check size counts, while the unmatched Mercury SAFE is in no round bar, so the
  round bar cannot double count. Both rows say so
  (the prospect reads "Waiting for Mercury", the SAFE offers "Assign to contact"),
  assigning fixes it, and Unassign undoes a wrong choice. Rakazo does not guess a match
  by name or amount. A SAFE with no contact (an existing investor's, say) simply counts
  in its list row and keeps Assign to contact in its menu.
- **Update status**: exactly Draft, Sending, Sent, Partly sent (some recipient
  failed or has an Unknown outcome) and Posted (on the portal, each investor contact
  with an email, not revoked, told by a portal notice that carries a fresh link). One word per state on
  every surface.
- **Portal access** (investor contacts only; board and auditor contacts have none): a contact of kind investor who has a live link token or session,
  or has been sent an update or portal notice, and is not blocked (revoked). Used for
  the unticked-investors line and the portal list; Post to portal does not require it,
  since the notice itself mints access.
- **Awaiting deposit**: the one phrase for a signed, unpaid SAFE.
- **Share** (a Data room document, which gives one contact portal access to it) and
  **Revoke** (portal access). Investor updates are not shared per contact: every
  update sent or posted to the investors audience is visible to every investor contact
  with portal access. "Open" is the only row action verb; the chip carries the state.

## What exists today (verified against the code at base revision 128599932)

- Page `apps/web/src/pages/CapTable.tsx` (`CapTablePage`), mounted
  in `apps/web/src/pages/Shell.tsx` (`capTableMode`, `sidebar-cap-table`, hidden-pages
  key `cap-table`, `appPages` id `cap-table`, the `pages` list of `SidebarPagesGroup`),
  route `/app/cap-table/*` in `apps/web/src/App.tsx`. Stories `CapTable.stories.tsx`,
  tests `CapTable.test.tsx`, e2e `apps/web/e2e/cap-table.spec.ts` and
  `carta-agent.spec.ts`. Documents live in the Data room folder
  `["Finance", "Cap Table"]` (`CAP_TABLE_FOLDER`), listed by the read-only
  `components/data-room/FolderDocuments.tsx` (newest 10; Name, Type, Added; renders
  nothing when the folder is empty). Today the page is one table that joins Carta
  holders and contacts by email (`joinRows`), with kind tabs All, Shareholders,
  Investors, Options, Auditors, Other, search, a Security filter, sort, a
  `Summary` of figures and the `OwnershipDonut` (`components/cap-table/`, with
  legend). It draws the unallocated pool as the row "Unallocated pool".
- **Contacts page (main, #465, #482, #496, #518, #537).** `apps/web/src/pages/Contacts.tsx`
  at `/app/contacts` (`sidebar-contacts`, hidden-pages key `contacts`): search, a Kind
  filter, add, edit, delete. Shared with Cap table: `components/ContactDialog.tsx`
  (`ContactDialog`, `contactKindNames`, `contactAddLabels`, `ContactPrefill`; a
  duplicate email is reported under Email with an "Open <name>" button; Delete has no
  confirm), `lib/use-contact-notices.ts` (`useContactNotices`: toasts through
  `enqueueNotificationToast`, Undo for a deleted contact, the just-saved row highlight
  `SAVED_ROW_CLASS`). Undo restores a contact with `contacts.save` from its name,
  email, organization, kind and notes only. Shared page chrome: `PageHeader`
  (wraps meta and actions at narrow widths), `AskBotButton`, `SearchField`,
  `PickFilter`.
- Contracts `packages/contracts/src/carta.ts`: `CapTableSnapshotInputSchema`
  (companyName, asOf, fullyDilutedShares, amountRaisedUsd, optionPoolAvailable,
  latest409a, shareClasses, holders) and `CapTableStateSchema`. One row per space and
  user in `CapTableSnapshot` (`packages/db/src/cap-table.ts`). RPC `carta.agent`,
  `carta.capTable`, `carta.refresh`, `contacts.list|save|delete`, declared in
  `packages/contracts/src/rpc.ts` and implemented in `apps/api/src/router.ts` (where
  this plan's "`rpc.ts` and `router.ts`" edits go).
- Carta agent `apps/api/src/carta-agent.ts` (`ensureCartaAgent`, `startCartaSync`,
  `onMcpServerConnected`, spawn key `carta-agent:<userId>`). It is the Carta
  server's integration agent (`integrationAgentSpawnKeyForServer`) and, like every
  integration agent, never reads the Data room (`botCanReadDataRoom` in
  `packages/contracts/src/integration-agent.ts`). Contact tools are no longer
  Carta-only: `contacts_list`, `contacts_add`, `contacts_save`
  (`CONTACT_ONLY_TOOL_NAMES`, gate `contactToolsAllowed`, which is now
  `mailToolsAllowed`) are offered to every agent on an owner-started run. Only
  `cap_table_read` and `cap_table_update` (`CAP_TABLE_TOOL_NAMES`) stay Carta-only,
  through `capTableToolsAllowed` in `packages/adapters/src/contact-tools.ts`; the
  executor gates both sets with `contactsEnabled` and `capTableEnabled`.
  `contacts_add` calls `addContactIfNew` (`packages/db/src/contacts.ts`): it never
  changes an existing contact (same email, or same name and organization without an
  email), answers `alreadySaved`, and records the adding agent in `Contact.botId`.
  `contacts_save` changes a contact and follows the normal approval settings (no
  forced ask; 0729d2d15). `financeToolsAllowed` (`finance-tools.ts`) is widened to
  the Carta key. Skills `carta-investor-update`, `carta-audit-response` in
  `builtin-skills.ts`. `isCartaMailSend` in `approval-ask.ts` makes `mail_send` always
  ask for the Carta and Inbox agents.
- `Contact`: `kind` is a string column validated by `ContactKindSchema`
  (investor, auditor, customer, vendor, partner, advisor, legal, other; default
  investor), unique on (spaceId, userId, email). `botId` (the agent that added it) is
  returned as `addedBy`. `writeContact` is private to `packages/db/src/contacts.ts`;
  `saveContact` (update or create) and `addContactIfNew` are its exports.
- Data room: `add_to_data_room` and `fileMailAttachment` in `data-room-tools.ts`
  (dedup by sha256: filing the same bytes again returns `created: false`); auto
  filing in `mail-attachment-filing.ts`: the mail sync calls
  `enqueueMailAttachmentFiling(deps, scope, newIds, now)` (`mail-sync.ts`, which also
  queues meeting digests after a sync, behind an optional `digestReady` dependency) with the
  ids it inserted, which filters with `isAutoFileMessage` and queues one
  `mailAttachmentsJob` per message; `runMailAttachmentFiling` (job `mail.attachments`
  in `background-job-handlers.ts`) files qualifying attachments. Files are streamed to
  signed-in users by `GET /api/data-room/items/:id/content` (`apps/api/src/data-room.ts`).
- `CachedMailMessage` has `threadId`, `subject`, `snippet`, `fromAddress`,
  `fromSelf`, `receivedAt`, so a sent reply in a thread is visible to the server once
  the sync cached it.
- Mail: `mail_send` and `mail_draft` (`mail-tools.ts`) are text only. The Inbox
  composer sends through RPC `inbox.compose.send` (`apps/api/src/inbox-compose.ts`;
  `ComposeFieldsSchema`: one From connection, to, cc, bcc, subject, body), recorded in
  `ComposeSend`.
- Routines: `Routine` table (`timezone`, default `UTC`; `notify`, default true);
  `apps/api/src/legal-agent.ts` `ensureLegalRoutine` seeds one routine per agent under
  an advisory lock with `timezone: "UTC"` and `notify: false`, and enqueues
  `routineWakeupJob`. `notify_user` (`notify-user.ts`) downgrades every notification
  of a routine with `notify` off to `info`, which never toasts or reaches a phone.
  The routine editor defaults a new routine to the account time zone
  (`accountTimezone`, `User.timezone`, #492).
- Page agents: Legal, Data room, Devin and Finance panels in Shell share one
  `agentPanel` descriptor (`name`, `testId`, `open`, `collapse`, `create`, `creating`,
  `error`, `suggestions`), a `findXAgent` helper in `apps/web/src/lib/`, an intro in
  `components/PageAgentIntro.tsx` (`pageAgentKind`), a colour in
  `packages/contracts/src/agent-colors.ts`, and these spawn-key checks: `bots.create`
  reserved prefixes (`apps/api/src/router.ts`), `botUsesConnectorTools`
  (`packages/core/src/connection-access.ts`), `autoGroupFolderName`
  (`packages/contracts/src/sidebar-folders.ts`). Legal, Data room and Devin create the
  agent on the first Ask; Carta auto-creates (`useAutoCreateCartaAgent`) and has its own
  `cartaPanelState`.
- Mercury: `getSafeRequest`, `getSafeRequests` are in `MERCURY_READS` (integration
  agent only, `packages/contracts/src/integration-agent.ts`);
  `FINANCE_READ_TOOLS.mercury` (`packages/contracts/src/finance.ts`) excludes them and
  the finance sync (`finance-sync.ts`, `FinanceSyncDeps.callToolFor`, built by
  `createFinanceCallToolFor` in `finance-call-tool.ts`) calls only that list.
  `devin-call-tool.ts` (`createDevinCallTool`, wired in `apps/api/src/app.ts`) is the
  existing example of a second, narrower allowlisted caller. Mercury's API has no
  SAFE-create call. No code reads SAFEs yet.
- Google: `drive_read` (`drive-tools.ts`) exports a Google Sheet as CSV through the
  Drive API (first tab; 100k character cap). No Sheets API use.
- Auth: better-auth 1.7.7 (`packages/auth/src/index.ts`), no magic-link plugin.
  `TransactionalEmailProvider` sends verification and reset mail. `requestSession`
  in `apps/api/src/app.ts` maps a session to an actor through `requireMembership`;
  no external principal, no public page.
- Notifications: `defaultNotificationSurface` (`notify-user.ts`) maps the Carta agent
  to the `cap-table` badge; `unseen[key]` in Shell (`useSidebarGlance`,
  `apps/web/src/lib/use-sidebar-glance.ts`) counts unseen notifications per surface,
  and its `surfaceOfPath` lists the page keys that mark a surface seen.
- Hide amounts (`apps/web/src/lib/hide-amounts-preference.ts`) is one browser
  preference, shared by every component that formats an amount.
- Doc generation: no DOCX or PDF writer installed. `@1984vc/cap-table` not installed.
- Mobile (`apps/mobile/app`): Inbox and Artifacts screens exist; no Finance, Legal,
  Cap table, Contacts or Data room screens.
- Demo stack (`pnpm demo:up`, `packages/testkit/src/cli/demo/seed.ts`): seeds a mock
  Carta server (`demoCarta`), a mock cap table (`DEMO_CAP_TABLE`), demo contacts through
  `contacts/save`, and the Carta agent through `carta/agent`. The seed calls the RPC
  names this plan renames.

Corrections to the internal map: `hiddenPages` is a `TEXT[]` column on `user`
(migration `20261212010000_user_hidden_pages`). The Carta agent already runs on the
integration-agent mechanism (migration `20261028000000_carta_integration_agent`).
There are no Carta evals in `packages/testkit`.

## Design

### Data model

All new rows carry `spaceId` and `userId` (cascade on both), and every query filters
on both. Money is integer cents (`BigInt`); shares are integers.

- **`CapTableSnapshot`** gains a `source` column (`carta` | `sheet` | `native`, default
  `carta`, so old rows read as Carta); every write names the source it expects and is
  refused when the row's source differs (one conditional update, so a late write from
  another source cannot land). `data` gains `sourceRef: { driveFileId, name } | null`. A `previous Json?` column holds
  one version back (`{ source, sourceRef, data }`), written by Change source and cleared by
  Undo or by the next change, so the table before a switch can be restored once.
  Native rows use a security from Common, Preferred, Option, Other and any name
  copied from the previous table (for example Seed Preferred); **no SAFE security**: a
  typed-in SAFE is a `Safe` row, shown on Investors from there. The option pool has one
  stored representation, the snapshot's `optionPoolAvailable`: the "Unallocated
  pool" row is drawn from it and is never also a holder row (the typed-in
  editor edits that field).
- **`Contact`** gains `stage` (target, intro, meeting, diligence, committed, passed;
  null for non-prospects), `checkSizeCents`, `nextStep`, and the
  portal fields `portalLinkSentAt`, `portalLastSeenAt`, `portalBlockedAt`; the
  `ContactSchema` and `ContactSaveInputSchema` in `packages/contracts/src/contacts.ts`
  carry them (the schema already has `addedBy` and `notes`). `ContactKindSchema` keeps
  its eight kinds from main and gains `prospect` and `board`; `contactKindNames` and
  `contactAddLabels` in `ContactDialog.tsx` are `Record<ContactKind, string>`, so both
  need the two new entries, and the Contacts page's Kind filter and the dialog's Kind
  select then list Prospect and Board too. A contact's kind flips to
  investor when its SAFE derives to Signed, only for a prospect; board, auditor and
  other contacts keep their kind; `stage` is kept. Also `mercurySentAt?` (when Send SAFE opened Mercury; null when
  not waiting) and `roundId?` (the round open when the prospect's stage was last saved
  as Committed; null otherwise).
- **`Safe`**: `source` (`native` | `mercury`), `externalId` (Mercury id), unique on
  (`spaceId`, `userId`, `source`, `externalId`) so two users, or two spaces, that see the
  same Mercury id each get their own row; `contactId?`, `roundId?` (each must belong to
  the same space and user as the SAFE, checked on every write), `investorName`,
  `investorEmail?`, `amountCents`, `valuationType`, `capCents?`, `discountPercent?`,
  `mfn`, `proRata`, `governingState?`, `investmentDate?`, `expiresAt?`, `canceledAt?`,
  `sentAt?` (native only), `signedByOwnerAt?`, `signedByInvestorAt?`, `paidAt?`,
  `documentUrl?`, `financeTransactionId?` (a transaction links to at most one SAFE, and
  belongs to the same owner). A Mercury row is a read-only cache of Mercury's record, not a
  Rakazo SAFE. A native SAFE is always the one supported YC form: a
  post-money valuation cap, no discount, no MFN (`valuationType` post-money cap;
  `discountPercent` null; `mfn` false); `proRata` records the separate YC side letter.
  The other fields hold imported Mercury terms as Mercury sent them. A Mercury row's
  `contactId` is set by the attach rule in the Glossary (email on sync, or Assign to
  contact), never by creating a second row (Unassign only changes `contactId`). A
  Mercury row's `roundId` is the attached prospect's `roundId`, or null: a SAFE
  first synced while a round is open is not put in that round. Status is derived,
  never stored (`packages/core/src/safes.ts`).
- **`FundraiseRound`**: `name`, `targetCents`, `capCents`, `closedAt?`. A round is
  open while `closedAt` is null; one open round per space and user (a partial unique
  index on that column); a closed round reopens from its menu when no other round is
  open. Edit round changes the round and the cap of new native SAFEs only; existing
  SAFEs keep the terms they were created with. A native SAFE created in the dialog gets
  the open round's `roundId`; a SAFE needs no round. Commitments belong to a round: a
  Committed prospect counts in Pending only while its `roundId` is the open round. A
  Committed prospect left from a closed round stays in the pipeline, counts nowhere, and
  joins the next round when the founder saves its Committed stage again in Edit
  prospect.
- **`InvestorUpdate`**: `audience` (`investors` | `board`), `subject`, `period`
  (YYYY-MM or YYYY-Qn), `body` (markdown), `status` (`draft` | `sending` | `sent` | `posted`; "Partly sent" is derived: sent
  with a failed or unknown delivery; "Post to portal" without Gmail ends in `posted`; its
  deliveries hold only the portal notices), `recipientContactIds String[]`, `fromConnectionId?`, `deliveries Json`
  (per contact, a list of attempts; attempt n has the key `<updateId>:<contactId>:<n>`,
  which is the `clientId` of its `ComposeSend` row, and the send outcome and Gmail message
  id are read from that row, not copied into a second record; "unknown" is the
  `ComposeSend` state of an attempt with no recorded result; a failed portal notice is
  recorded the same way), `sentAt?`. A sent or posted update
  is read-only.
- **`InvestorShare`**: which Data room documents a contact sees. `contactId` and
  `dataRoomItemId`; unique per pair; cascade from contact and item. "Share" on a
  document creates one row per chosen contact. Updates have no share rows: the portal
  lists every `sent` or `posted` update with audience `investors` to a contact of
  kind investor with portal access who is not blocked.
- **`InvestorPortalToken`**: `contactId` (cascade), `tokenHash` (sha256 hex, unique),
  `expiresAt`. Only hashes are stored; the plain token exists in the
  email or the copy-link dialog it was minted for. Revoke deletes the contact's rows.
- **`PortalSession`**: `contactId` (cascade), `tokenHash` (sha256 hex of a random
  session token, unique), `expiresAt` (30 days after creation, fixed). The
  cookie holds the random session token, never a contact id. Revoke, block and an
  email change delete all of the contact's link tokens and sessions.
- **`AuditRequest`**: created by the intake job the moment the mail arrives, so it is
  visible even if drafting never starts. `fund` (the subject line until the agent
  corrects it), `asOf?` (date), `asOfMatched` (false when the statement had to use
  current holdings), `dueDate?`, `status` (`open` | `drafted` | `done` | `dismissed`),
  `dataRoomItemId?`, `mailThreadId?` (unique per space and user when set), `connectionId?`,
  `draftRef?` (Gmail draft id), `senderKnown` (sender is an Auditor contact), `notes`,
  `draftStartedAt?`, `draftedAt?`, `doneAt?`, `lastMailAt`. Rows the agent adds for a
  request that did not arrive by mail have no thread; `audit_request_upsert` returns the
  existing open row with the same normalized fund name and `asOf` instead of adding one.

Removed from the first draft: the board routine, the audit-season routine, the SAFE security in the
editor, per-row edit versions, `lastContactAt`, `reviewedAt`. Not added: vesting, priced rounds, OCF, consents, minutes, e-signature.

### Agent: a new Investors agent; Carta and Mercury agents stay connectors

**Decision: add an Investors agent (`investors-agent:<userId>`) on the Legal agent
pattern; do not generalize the Carta agent.** `botCanReadDataRoom` keeps every
integration agent (Carta included) away from the Data room, which audits and portal
documents need; the Investors page must work with no Carta at all (today the Carta
agent exists only after Carta connects, `useAutoCreateCartaAgent`); the Legal agent
already shows the shape (`ensureLegalAgent`, fixed tool list in
`packages/contracts/src/legal.ts`, no MCP tools), and the Data room agent
(`apps/api/src/data-room-agent.ts`) is a second example of a page agent with its own
panel in Shell.

Tools (`INVESTORS_AGENT_BUILTIN_TOOLS` in `packages/contracts/src/investors.ts`):
`cap_table_read` (now also returns SAFEs), `cap_table_update` (from slice 4), `contacts_*`,
`fundraising_read` (new, read-only: the open round, prospects with stage and check size,
SAFEs with derived status and deposit match), `investor_update_draft` (new, one tool:
`history` lists recent sent updates with their bodies, `get` and `save` read and edit one
existing draft by id and refuse a sent or posted update, `create` adds a draft),
`audit_request_upsert` (new), `finance_overview`, `finance_breakdown`, `search_data_room`,
`read_data_room_item`, `read_spreadsheet`, `mail_search`, `mail_grep`, `mail_get`,
`mail_draft`, `drive_search`, `drive_read`, `message_bot`, `notify_user`. The list grows
slice by slice: each slice adds a tool to `INVESTORS_AGENT_BUILTIN_TOOLS` only when it can
execute it (slice 2 ships the list without the three new tools and without
`cap_table_update`). Each new tool is registered in four places by the slice that introduces
it: its definition in `builtinAgentTools` (`packages/adapters/src/builtin-tools.ts`), its
name in `BUILTIN_TOOL_NAMES` (`packages/contracts/src/builtin-tools.ts`), an `investorsEnabled`
gate option and name set in the executor's `selectBuiltinToolsForRun` filter plus its
dispatch branch next to the contact tools (`packages/adapters/src/executor.ts`), and the
spawn key's fixed list. It never
gets `mail_send` (updates go out from the page on the founder's click; audit replies
are Gmail drafts the founder sends), no Mercury tools (SAFE and deposit questions are
answered from the synced rows through `fundraising_read`), and `cap_table_update`
only writes while the snapshot's source is `sheet` (the database refuses any other write). It cannot change a pipeline stage; it says so and points
to the row.

`contacts_add` already does what this plan needs (main, `addContactIfNew`): on an
email that already has a contact it returns that contact unchanged, with
`alreadySaved`, and never changes its kind; the earlier idea of filling its empty
fields is dropped. Every agent has `contacts_*` on an owner-started run, so the
Investors agent needs no gate change for them and the contact tools are not
Carta-specific. The Carta agent keeps
`cap_table_update`, `contacts_add` and its sync prompt; its
instructions drop the update and audit duties and add one line: for updates, audits
or the portal, tell the user to ask the Investors agent. It stays in Bots with its
history and is listed with the integration agents, but the sidebar shows it only
while it has recent history; the Investors page never links to it. The two skills move to the Investors agent as `investor-update` (writes the row
through `investor_update_draft`; no Gmail draft any more) and `audit-response`.
Gates to widen: `capTableToolsAllowed` (`contact-tools.ts`) so the Investors key passes the
cap table gate (the executor gates `CAP_TABLE_TOOL_NAMES` as a whole; the fixed list is what
keeps `cap_table_update` away from the agent until slice 4), `financeToolsAllowed`, `defaultNotificationSurface` (surface `investors`).
The new spawn key is also added to `bots.create`'s reserved prefixes (`router.ts`),
`botUsesConnectorTools` (`connection-access.ts`, so it gets no Composio tools),
`autoGroupFolderName` (`sidebar-folders.ts`, Workspace folder), `pageAgentKind`
and `PageAgentIntro`, and `agent-colors.ts`. Ask on Investors and on Fundraising opens
this one agent through the Shell `agentPanel` descriptor that Legal and Data room use
(not `cartaPanelState`, which is for Carta's connected state); one collapsed-panel
preference serves both pages. The agent is created when either page first opens
(`investors.agent`, idempotent; Investors from slice 2, Fundraising from slice 8), not on the
first Ask as Legal and Data room do, because the monthly routine needs it to exist without a
click. Audit intake does not need it: the intake job files the request row on arrival, and
the agent drafts only when it exists; otherwise the row stays New with a Draft reply button
that creates the agent.

One routine, seeded by `ensureInvestorsAgent` under an advisory lock (the
`ensureLegalRoutine` pattern): **"Investor update draft"**, monthly on the 1st at
09:00 in the account time zone (`User.timezone`; UTC when none is saved), active, with
`notify: true` (`ensureLegalRoutine` sets `notify: false`, which would turn the
notification below into a sidebar dot with no toast or phone push). It runs `@investor-update` for the last
period and saves a draft row only when there is at least one investor contact with an
email (otherwise no draft and no notification); it sends no email. A draft is saved on
the 1st for the previous period, so a row reads "Drafted Oct 1". The Reminder menu on Investors
(Monthly, Quarterly, Off) rewrites `crons` and `active` (quarterly: the 1st of
January, April, July, October); Off leaves a pending draft alone; there is no
catch-up. Board and audit routines do not exist; the routine editor on the agent
stays available for anything else.

**Notifications.** The Investors agent notifies twice only: "October update ready"
when the routine saved a draft, and "Audit request from <fund>" when an audit draft
is ready. The Investors sidebar badge counts unseen notifications from the Investors
agent (the existing `unseen["investors"]` mechanism, which needs `investors` added
to `surfaceOfPath` in `use-sidebar-glance.ts`), not open action items. Both
notifications use importance `attention` so they toast and reach a phone. Mercury
sync changes and pipeline next steps never notify; Fundraising has no badge. On
mobile both notifications open the agent chat.

### Cap table sources

One snapshot per space and user (today's scope). The source is chosen once and shown
as one line in the header, "<Source> · as of <date>", with a menu: Refresh (Carta or
sheet only, dispatched by `investors.refresh`), Change source, and Undo only right after a
switch. Carta's own states
("Reading Carta…", "Reconnect Carta", needs a model) use the same line. Rules:

- **One writer per source, enforced by the database.** `source` is a column on the
  snapshot row. Every write names the source it expects (`expectedSource`) and is refused
  by one conditional update when the row's source differs. Carta sync and the Carta agent
  write as `carta`, the sheet-read run as `sheet`, the table editor as `native`. So a Carta
  read already running when the founder switches, or a Carta-agent turn later, cannot
  overwrite a Sheet or typed-in table, and a late sheet result after a switch back is
  refused. `onMcpServerConnected` starts a Carta read only when there is no snapshot or the
  source is already Carta.
- **Change source takes effect at once and keeps the data.** The RPC copies the row's
  `source`, `sourceRef` and `data` into `previous`, then sets the new `source` (and
  `sourceRef` for a sheet), creating a row with an empty table when there is none. The table
  shown stays the old data until the new source writes. Typed in therefore starts from a copy
  of the table shown, which the founder edits instead of retyping. **Undo** (`investors.undoSource`)
  restores `previous` once (source, sourceRef and data) and clears it; because it changes
  `source` back, a result still arriving from the source that was undone is refused. Undo is
  offered only until the next change. No confirm dialog.
- **Typed-in table** (`source: native`): always editable in place, saved on blur as the
  whole table with the `updatedAt` it was loaded from; a save from a stale copy is refused,
  and the table then reloads and shows "Changed elsewhere". A network error or a
  validation failure shows "Not saved" with a Retry button in the card header and the
  typed rows stay as typed. A long holder name wraps in its field, one blank row sits at the
  bottom (a row left blank is ignored), security defaults to Common (Common, Preferred,
  Option, Other, plus names copied from the previous table, which the legend keeps),
  company name defaults to the space name, as-of is the last edit. Every holder row has a
  menu with Delete holder (Add as contact when no contact has that name; the pool row has
  none). A non-numeric or negative Shares or Invested value is outlined and not saved; two
  holders may share a name. The pool is one row, "Unallocated pool", counted in fully
  diluted. A holder is linked to the contact with the same name, and Add as contact asks
  for an email and creates one (kind investor).
- **Google Sheet** (`source: sheet`): picked with the Drive picker in its single-file
  mode (one Google Sheet, returned without importing it; see slice 4). The API sets the
  source, then queues one Investors agent run (trigger `routine`, the `startCartaSync`
  pattern with its advisory lock) whose prompt names the file id and tells the agent to
  read it with `drive_read` and call `cap_table_update` with the exact figures. The guarantee
  is narrower than "never partial": the agent is told to stop without saving when
  `drive_read` reports `truncated: true` or when any row cannot be read, and the writer
  refuses an update unless the snapshot's source is `sheet`, the update names that file id,
  and it has at least one holder. Rakazo cannot detect a row the agent silently omits from a
  complete read; the page shows the figures as read, with the source line naming the sheet.
  The page shows "Reading sheet…" while the run is active (also for the very first read)
  and, when the latest sheet-read run ended without a newer snapshot (computed from the
  run's `createdAt` and the snapshot's `updatedAt`), keeps the old table, adds "Last read
  failed · Try again" to the menu and shows the line in the warning color. With no
  snapshot yet, a failed first read shows no source line, one sentence, "The sheet could not
  be read.", with Try again and Type it in under it. Drive exports the first tab only.
- **Carta** (`source: carta`): unchanged sync through the Carta agent.

Fully diluted math is pure (`packages/core/src/cap-table.ts`) and has one rule used
on both pages. The **holdings** are every snapshot row with a known share count, plus
the pool (`optionPoolAvailable`); they are 100%: percent per row, rounding adjusted so
the column and the bar sum to exactly 100.0. **Source data is never completed or
forced.** A figure the source did not give stays "—" (a null share count or invested
amount is not zero). When the rows do not add up to the source's `fullyDilutedShares`,
the Fully diluted figure shows the source's number and the percent column shows "—"
instead of percentages that would not reconcile; the agent can explain the gap from
`cap_table_read`. A snapshot holder whose security is "SAFE" (Carta or a sheet) is shown
as a plain row with its amount as read; it is outside the 100% and outside the at-cap
sum, and is not turned into a `Safe` row. **SAFEs are never inside that 100%.**
Unconverted `Safe` rows (status Sent, Signed or Funded) are listed under one group row,
"SAFEs, if converted at cap", with their own percent (amount ÷ cap); the group row shows
their sum ("5.0%"). Mercury SAFEs with a discount or MFN and no cap show "—" and add
nothing. **Draft SAFEs appear in the Fundraising list and count only in the round bar (as
Pending); they are in no cap-table figure**: not the at-cap group, not Equity raised. The
Draft chip and muted amount say so. Rakazo does not deduplicate a snapshot SAFE row against
a `Safe` row: an email identifies a contact, not one instrument, so both show. Equity raised is the sum of
the Invested column for every source; Carta's own `amountRaisedUsd` is not shown. Hide amounts is the existing single browser
setting and covers editor inputs, action items and draft text.

### Pages

**Tap targets.** On a phone every tappable element is at least 44 px tall (the arrow-only back button also 44 px wide): buttons,
row menu items in popovers, source and Mercury buttons, chips, text links such as
"Passed 1 ›", "Show done", "Find in Finance", "Assign to contact", "Different terms" and "YC documents ›" (real padding, not a negative margin), form inputs and the rows that
hold a checkbox or radio. Row menus are popovers that flip above or scroll when there is no room below (the mockup's absolutely placed menus can clip at the bottom of a page; the real ones do not). On desktop a text link is at least 24 px tall. Individual
sections below do not repeat this.

**Investors** (`/app/investors`, `apps/web/src/pages/Investors.tsx`, built from the
existing `CapTable.tsx` parts). Header: title, source line with its menu (a button,
at least 32 px), Hide amounts, Add contact, Ask (an outline button; no filled button
in the header). The header is main's `PageHeader` and the Ask button is `AskBotButton`
(an outline button; its accessible name is "Ask Investors agent"). Below
900 px `PageHeader` puts the source line under the title and moves the actions to
their own right-aligned line when they do not fit, and the Shell already collapses
the sidebar behind its menu button; the mockup's single phone row with a "+" and an
icon-only Ask is therefore a design target, not something main provides: slice 1 keeps
`PageHeader` as it is and the narrow header is checked against it (see the founder
decision in the review record). Empty view: the same
header with Ask, then three equal buttons in this order: Connect Carta, Use a Google
Sheet, Type it in. None is filled because the plan cannot know which source the
founder has. The source line reads "Carta · as of <date>", "Sheet · as of <date>",
"Typed in · as of <date>" or "Reading sheet…" (during the first read, with no
snapshot yet, the page body is the one line "Reading <sheet name>…" and no buttons); after a failed read it keeps the
label of the data shown, in the warning color. Sections, in order:

1. **Action items** (only when any exist; a bordered block; the one filled button on
   the page is the Draft ready row's **Open draft**): audit requests in due-date
   order, then newest (New, Draft ready, with the due date, "Sender not in Auditors"
   and, once a draft exists and the holdings could not be dated, "Holdings as of
   today, not <date>") and the routine's update draft until it is opened
   (the draft stays here until it is sent or deleted).
   One button per row; the chip carries the state. The audit button is **Open draft**
   when a draft exists (opens the Gmail draft in a new tab) and **Open** when New
   (opens the filed request, or the mail thread in Inbox when nothing was filed, for
   example a DocuSign notice); the update row's **Open** opens the editor. Audit rows
   have a menu: Mark done, Dismiss. A row closes only when the founder chooses
   Mark done or Dismiss; sending the reply does not close it. **Show done** is a text button in the Updates header (list-wide,
   so not in a row menu); it lists done and dismissed rows and becomes Hide done.
   With no open items the block is absent; **Show done** stays available in the Updates
   header while any done or dismissed request exists, so history is reachable after the
   last request closes. A request whose mail thread has a newer message than its draft
   shows the chip "New mail". An audit row that has no draft shows **Draft reply** (it
   creates the agent when needed). SAFE items live on Fundraising.
2. **Cap table**: two figures (Fully diluted; **Equity raised**: equity only, no SAFE
   money, equal to the sum of the Invested column of the holdings; built on the
   existing `Summary`/`Figure` parts), the ownership
   bar (four tones plus a hatched pool; segments separated by a gap; it replaces the
   existing `OwnershipDonut`, decision 12), the holdings
   table with the pool row and 409A as a meta line when known, the "SAFEs, if
   converted at cap" group (its heading links to Fundraising), and the in-place editor
   for the native source (autosave, "Saved" or "Not saved" with Retry in the card
   header; SAFE rows stay below the editor because they come from Safe rows, not
   the snapshot). A holder row's "…" menu holds Add as contact (or Open contact; main's
   `ContactDialog` with a `ContactPrefill`, and the existing email join) for
   Carta and sheet sources and Delete holder for the typed-in source; Options and the
   pool have no menu in read-only sources; a SAFE row's menu opens it on Fundraising.
   On a phone each row is the holder with its percent, and a muted line "Security ·
   shares · invested" (a SAFE row shows its amount); in the editor each typed-in row
   is stacked as label and value pairs (Security, Shares, Invested), every value full
   width so no digit or class name is clipped, and the pool row has only its shares.
3. **Updates**: every update, drafts included (a routine draft is here and in Action items until it is sent or deleted), with one status word per row: Draft,
   Sending, Sent, Partly sent or Posted. A Sending row appears the moment Send is
   pressed, with Open and a disabled menu (no Delete while it runs), and flips to its
   final word by itself. A Partly sent row names the problem recipient
   in its sub-line, "<name> failed" or "<name>: delivery unknown" (never "failed" for an Unknown
   recipient; with several, "<n> failed" or "<n> deliveries unknown", failed first), and has Retry, so a failure is visible
   without opening the editor; its row menu adds Mark delivered when an Unknown recipient remains. New update; the Reminder choice (Monthly, Quarterly,
   Off, current one ticked) lives in the header "…" menu next to New update. A sent,
   partly sent or posted update is read-only (Open shows it without a footer button);
   its row menu offers Duplicate (new draft) and Delete (confirm; removes the portal
   copy); a draft's menu has Delete only. A sent update appears at the top of the list
   as Sent and leaves Action items. Toasts go through `enqueueNotificationToast` (the app toaster main's contact Undo already uses). After Send a toast reads "Sent to <n>"; after Post to portal it reads "Posted · <n> notified" and a Posted row heads the list. Retry on a Partly sent row asks "May already be delivered. Send again?" first when any recipient to retry is Unknown, and retries failed recipients directly otherwise. Mark delivered (row menu and editor footer) records every Unknown recipient as Sent; when no Failed recipient remains the update becomes Sent, otherwise it stays Partly sent.
4. **Contacts**: tabs Investors, Board, Auditors. This is the portal view of the
   people an investor relationship involves, not the address book: prospects appear
   only on Fundraising until their kind changes, and every other kind (customer,
   vendor, partner, advisor, legal, other) stays on the Contacts page, which
   already lists, searches, adds, edits and deletes every contact. The section reuses
   `ContactDialog`, `useContactNotices` (saved-row highlight, toasts) and
   `contactAddLabels`; it adds only the Portal column and the portal menu items.
   Portal column: "—", "Invited <date>" (the
   date of the latest send, resend or portal notice, so it moves on every one), "Opened <date>"
   (`portalLastSeenAt`), "Revoked", or after Unblock "Unblocked · send a link" until a
   link goes out. The Portal column and menu items apply to the Investors tab only;
   board and auditor contacts have no portal access. Row menu: Resend link (an investor
   contact with an email; with no email provider it opens
   the copy-link dialog), Copy link (mints a link and shows it once; the only route for a
   contact with no email) and Revoke (any
   contact with portal access), Unblock when revoked, and Edit and Delete for every
   contact. Revoke needs no confirm (Unblock reverses the block, not the links: a new
   link must be sent); changing a contact's email ends their tokens and sessions and
   shows "—"; changing a contact's kind away from investor does the same and also removes its
   document shares, so no access is left that this section cannot show. Add contact is the shared contact dialog: Name,
   Email (optional), Organization (optional), Notes, Kind (defaults to the active tab); an
   email that already belongs to a contact is reported under Email with main's "Open
   <name>" button instead of adding one (a prospect opens on Fundraising). The dialog's
   Carta-only hint ("do not change Carta", the `fromCapTable` prop) shows only while the
   source is Carta. Delete uses main's behavior (no confirm, an Undo toast) for a
   contact that has nothing beyond name, email, organization, kind and notes. Main's Undo
   re-creates the contact from those five fields, so it cannot bring back portal links,
   document shares, a stage, a check size or SAFE and audit links; a contact that has
   any of those asks to confirm first, naming what will be removed, and then deletes with no
   Undo. The check is one `contacts.linked` RPC (`packages/db/src/contacts.ts`) used by the
   shared `ContactDialog`, so deleting from the Contacts page asks the same question; each
   slice that adds a kind of link (6 portal and shares, 7 audit items, 8 stage, 9 SAFEs)
   extends it. Sent updates
   keep their delivery records, and audit and SAFE rows keep their text with no contact
   link. The Board tab has Message the board,
   shown once a board contact exists. A contact has one kind. Tabs are buttons; the
   active one uses the sidebar accent fill.
5. **Documents**: the existing `FolderDocuments` for `["Finance", "Cap Table"]`
   (folder name kept so existing files stay), unchanged and read-only (Name, Type, Added,
   newest 10, nothing shown when empty). Sharing is not here: slice 6 adds **Share with
   investors** to the Data room's own document actions (`ItemMenu.tsx`, `ItemDialogs.tsx`),
   which reach every document, not only ten. The Share dialog lists the investor contacts: those who already have the file show Unshare, the others a
   checkbox, and "Email them a link" is ticked (every newly ticked contact gets a
   new link, so one who already has a link is told about the document). Its button
   is Share; there is no second confirm for sensitive files, since the dialog names
   the file and the people.

**Update editor** (`/app/investors/updates/:id`, a page inside the shell with the
sidebar visible; no full-screen overlay; on a phone labels sit above fields and the
body fills the screen): Subject (default
"<Company> · <Period> update"; the email subject is exactly this field), To (shown only with Gmail connected, because it controls email only: a list of the audience's contacts, one row each with a checkbox, all ticked;
a contact without an email is greyed, unticked and says "no email"; no ad-hoc
addresses; a revoked contact is greyed, unticked and says "revoked", and is never
emailed), Body (stored as markdown but shown rendered: headings bold, bullets with a
dot; the portal and the email show the same body), From (only when
more than one Gmail account). Autosave on change. Draft with agent appears while the
body is empty; the agent asks its highlights, lowlights and asks question in its
chat only when the founder opens the chat, otherwise it drafts with TBD. Leftover
"TBD" is highlighted in the body (the editor reuses the installed compose editor,
`useComposeEditor` in `apps/web/src/components/compose/RichTextEditor.tsx`, not a new contenteditable) and Send asks once, in the button row: "1 TBD left. Send anyway?" with
Keep editing and Send anyway; the Send label never shows the count. One primary
button: with Gmail, **Send** (emails each recipient their own message with their
link and marks the row sent); without Gmail, **Post to portal** (the update ends as
Posted and shows on the portal to every investor contact with portal access; each
investor contact with an email who is not revoked or blocked, including one never sent a link, gets a short
portal notice with a freshly minted link through the `TransactionalEmailProvider` on a best-effort
basis, then the toast "Posted · <n> notified"; with no email provider configured nobody is
notified and the founder uses Resend link or Copy link on a contact; there is no notice retry) with Connect Gmail as the
secondary action. The To list is hidden without Gmail. With Gmail, when an unticked
investor contact has portal access (see Glossary), one line under the list reads "Unticked investors
still see this on the portal."; nothing else explains it. A board update without Gmail
has no Post to portal (board updates never reach the portal): its one button is
"Connect Gmail to send". Connecting Gmail later does not email a Posted update; to email
it, Duplicate it and Send, then Delete the original so the portal lists it once. Send is idempotent per update
and runs in the API process, detached from the request (no background job): the status
flips to sending in a transaction, then the send loop sends one recipient at a time under the attempt key `<updateId>:<contactId>:<n>`,
recording the attempt before the message goes out and the result after. Send again on a
Failed or Unknown recipient, confirmed by the founder, starts attempt n+1 with a new
`ComposeSend` row; the earlier attempt keeps its Unknown or Failed outcome, and no
attempt is ever started automatically. A recipient
row shows Sent, Sending or Failed with a Retry button (its slot is reserved so rows
do not shift), the header chip reads Sending, the button reads "Sending" and is
disabled, and a second click does nothing. If the process restarts, nothing resumes by itself: an update left in sending with no
activity for 10 minutes is shown as Partly sent, recipients with a recorded result keep it,
recipients never attempted show Failed with Retry, and a recipient attempted with no recorded
result is shown as "Unknown — check Sent mail" with Retry, which asks once "May already
be delivered. Send again?" (buttons Send again and Mark delivered, and a close icon that leaves the update as it was); it is never resent automatically,
since a duplicate email is worse than a click. Send again stays the filled button on purpose: both defaults carry a risk (a duplicate email, or an investor who never got the update), and Send again is the action that completes delivery. A recipient counts as resolved when it is Sent, Failed or Unknown. When every recipient has resolved with a Failed or Unknown one among them, the chip
reads Partly sent, the footer reads "<n> of <m> sent" with one filled Done button, and
Retry (failed and Unknown recipients) stays on the row and on the update's row in Updates; Retry on the Updates row asks "May already be delivered. Send again?" for Unknown recipients only. While an Unknown recipient remains, the footer also has a secondary "Mark delivered" (Partly sent footer and the resend question; the question has no Cancel button), which records Unknown recipients as Sent and clears Partly sent when nothing failed.
Send returns to Investors. Only a draft can be edited; a sent, partly sent or posted
update is read-only, and Duplicate on its Updates row starts a new draft. The footer
is pinned, so Send stays visible on a short screen. With no recipient ticked the
button is disabled. If Draft with agent fails, the body stays
empty and a toast reports it. Audience is fixed
by how the update was started: New update means investors; Message the board on the
Board tab opens the editor with audience board and the board contacts. Board
updates are plain text email and never appear on the portal. Several drafts
may be open at once; a board draft is written from past board and investor updates.

**Fundraising** (`/app/fundraising`, `apps/web/src/pages/Fundraising.tsx`). Header:
title, Mercury line (the same button-with-menu pattern as the Investors source line:
"Mercury · 5 min ago" with Refresh, or Connect Mercury, or "Sync failed" whose menu
has Refresh and Reconnect), Hide amounts, Add prospect, Ask (outline). At most one
button on the page is filled: the Committed-stage row's Send SAFE, except that Start a
round is the filled one (and Send SAFE outline) when there is no open round. Narrow
layout as on Investors. Pipeline and SAFEs always show, with or without an open
round. Sections:

1. **Attention** (only when any exist, with or without an open round; the same
   bordered block as Action items): SAFEs signed and awaiting deposit (button **Mark
   funded**, which asks for the date, beside a "Find in Finance" link) and SAFEs sent
   and unsigned for 14 days (button **Mark signed**). "Awaiting deposit" and the
   Finance link appear here only; the SAFE row shows its date and the Signed chip. The predicate `needsAttention` in
   `packages/core/src/safes.ts` is the only source.
2. **Round**: name with its cap and terms under it, a "…" menu (Edit round, Close
   round; there is no Close round button), and the bar Funded · Signed · Pending ·
   Target (Funded and Signed from SAFEs with those statuses; Pending is the check
   size of Committed-stage prospects of the open round that have no SAFE yet (including those Waiting for Mercury) plus the Sent SAFEs and the
   native-dialog Drafts of the round at their amount. Every SAFE counts exactly once (SAFE counting rule in the Glossary). The bar stays put when Send SAFE opens Mercury; the segments always add up to the legend; the bar scales to the
   larger of target and total, and a zero target shows no Target figure). The
   round-bar total and the Pipeline's check sizes use the same rule on both pages.
   Close round confirms only when a SAFE is signed and unpaid ("Harbor Angels' $50,000
   SAFE is signed and unpaid."). A closed round stays as one card ("Closed <date> ·
   funded <amount>", a menu with Reopen, and the filled Start a round button); the
   Pipeline and SAFEs below it stay, signed-unpaid SAFEs keep their Attention row and
   Mark funded, and its SAFEs keep their round. With no round the card holds only
   Start a round; the dialog asks for name (no default), target and post-money cap. Add prospect and Send SAFE work with no round (Send SAFE then opens with the
   terms expanded). Edit round is the same dialog with a Save button.
3. **Pipeline**: prospects grouped under stage headings (no chip per row). Each row
   has the name, a sub-line with the next step, a right-aligned
   check-size column ("—" when unknown), and the row menu inline at every width. Add
   prospect is the contact dialog with kind prospect, an optional email and a Stage
   field; stage moves ("Move to" a stage, any direction) and Edit prospect are in the
   row menu; Passed is a collapsed button that expands in place. Amounts sit in a
   fixed column and the row button in its own slot after it. A prospect added with an
   email that already belongs to a contact opens that contact in the dialog instead of
   failing (emails are unique per owner, so there is exactly one). A Committed row shows **Send SAFE**; while the prospect has an
   active SAFE the row leaves the pipeline and the SAFE row shows its status;
   deleting, canceling or expiring the last such SAFE returns the row to the pipeline at its old
   stage. With Mercury, Send SAFE keeps the row, replaces the button with the sub-line
   "Waiting for Mercury · <date>" and adds **Open Mercury**, **Not sent**, Passed and Edit prospect to the row menu and no Move to (Glossary).
4. **SAFEs**: every SAFE with investor, amount, status chip (Draft, Sent, Signed,
   Funded, Expired, Canceled), date; no sum in the card header (the round bar is
   the one summary); cap and source only when they differ from the round or the
   page source. A native Draft row has a muted amount. A Mercury row with no contact shows **Assign to contact** in its sub-line (a dialog with a picker of prospects and investors and the button Assign). The card is as tall as its rows, not stretched to the
   pipeline. Row menu: Open (cover summary
   for every row; the Mercury document when there is one) and only the next valid
   Mark action for the row's status (Draft: Mark sent; Sent: Mark signed; Signed: Mark
   funded; Funded: none), each with the date (a small dialog with a date field; native rows
   only: a Mercury row's status comes from Mercury alone), Assign to contact (only on a Mercury row with no contact), Unassign (only on a Mercury row with a contact; to fix a wrong match, Unassign then Assign to contact), Cancel SAFE (native, not Funded; sets Canceled; an Expired
   SAFE only comes from Mercury), Delete (confirm; native only). Rows are ordered by
   status (Funded, Signed, Sent, Draft), then date.

**Send SAFE** is one button. With Mercury connected it opens Mercury's SAFE page in
the browser (Mercury's API cannot create a SAFE), sets `Contact.mercurySentAt` and
creates no SAFE row: the prospect stays in the pipeline as "Waiting for Mercury" and
keeps counting at its check size (counting rule and Not sent in the Glossary). It
requires the prospect's email: when it is missing, Send SAFE first asks for it in a small dialog
("Investor email", then Send SAFE), because the email is how the next sync attaches the
Mercury SAFE (Add prospect hints "Used to match the SAFE"). It is refused for a prospect that has a
active SAFE (Draft, Sent, Signed or Funded), so it works again once every SAFE on the contact is Canceled or Expired (attaching
cleared `mercurySentAt`, so a cancel-and-recreate starts clean). A waiting prospect has no Send
SAFE button; Open Mercury in its menu returns to Mercury. Without
Mercury it opens the native dialog prefilled from the round
(investor, amount, date; the terms line reads "Post-money cap $10M" from the
round, and "Different terms" discloses cap, pro rata and governing state; the native
SAFE is always the YC post-money valuation-cap form, so the dialog has no discount or
MFN field); the dialog's button is **Send SAFE**, matching its title, and opens the cover
summary (terms list, a link to YC's documents page, Print, and **Mark sent**, which
asks for no date and records today). The label stays **Send SAFE** because it starts the
sending; the founder sends the document themselves (decision 3). Dialogs fit a 390 px
screen (width at most the viewport minus 32 px), their primary button is at least 44
px tall on a phone, and its label names the action ("Add prospect", "Start a
round", "Send SAFE").

**Portal** (`/portal/*`, `apps/web/src/pages/portal/`): no Shell, no app session.
`/portal/open` (token in the URL fragment) is the landing page: an Open button and no
company name (no server call is made until the button is pressed); the button posts the
token, the server sets the cookie, the page removes the fragment and goes to `/portal/home`
(company name, the newest update in full, earlier updates as rows under "Earlier
updates" that expand in place, the shared documents with Download, Sign out in a
footer line; with no update or document yet, "Nothing shared yet."; controls, Download
included, are at least 44 px tall on a phone). A dead link (expired, revoked, unknown)
shows "This link no longer works." and nothing else (an expired cookie lands here too);
the founder sends a new link with Resend or Copy link. There is no public request form
in this plan (cut after review: it needed per-address and per-IP abuse controls and
indistinguishable answers for known, unknown, blocked and throttled addresses). `/portal`
is the same page without the sentence. The update
email subject is the editor's Subject, then the update body, then one link line, "View online
and past updates", carrying that contact's link, drawn as a button-style link at least 44 px tall. The portal
shows nothing else: no cap table, no contacts, no agent.

### Portal security

The only external principal in the system, kept narrow.

- **Request hygiene.** The portal does not inherit the protections of `/rpc`, so the
  mount sets its own: `mountApiRequestBodyLimits` (`apps/api/src/request-body-limit.ts`) gains `/api/portal/*` with a small limit
  (it covers only auth, local-settings RPC and `/rpc/*` today); a middleware sets
  `cache-control: private, no-store` on every `/api/portal/*` response (the app's
  `no-store` loop covers `/api/auth/*` and `/rpc/*` only), not just downloads; the
  state-changing POSTs (open, sign-out) refuse a request whose `Origin` is present and is
  not the web origin (`isTrustedOrigin`).
- **Principal.** A portal request resolves to `{ spaceId, userId, contactId }` from
  the cookie; it is never an `Actor`, never reaches `/rpc`, never touches
  `requireMembership`. The routes are a separate Hono mount
  (`apps/api/src/investor-portal.ts`, `mountInvestorPortal`, next to
  `mountDataRoomRoutes`) with their own `authenticatePortal`.
- **Token.** 32 random bytes (`node:crypto` `randomBytes`), base64url in the link
  fragment, sha256 hex in an `InvestorPortalToken` row (the `MessagingLinkCode`
  precedent in `packages/db/src/messaging.ts`). Every send, Resend and copy-link mints
  a new token, so the plain link can be built when needed without storing it; the
  contact's older tokens keep working until each expires 90 days after it was issued
  (decision 5). Each mint also sets `Contact.portalLinkSentAt`. Expired rows are
  deleted on the next mint.
- **Landing page.** `GET /portal/open` is a static page; the token is in the URL
  fragment, which browsers never send, so it is absent from server logs, proxy logs
  and `Referer`. The page's script reads the fragment and POSTs the token from the Open button to
  `/api/portal/open`, then `history.replaceState` removes the fragment. The POST sets
  `rakazo_portal=<session token>` as `HttpOnly; Secure; SameSite=Lax;
  Path=/api/portal; Max-Age=30 days`, creates a `PortalSession` row (sha256 of a
  fresh 32-byte random token, 30 days), and records `portalLastSeenAt`.
  The cookie holds that random session token, never a contact id and never the
  90-day link token. Each portal request hashes the cookie, loads the session and its
  contact, and refuses a blocked contact; so Revoke, a block or
  an email change take effect on the next request because their sessions are
  deleted. Scanners and
  unfurlers that only GET see no token and burn nothing. Expired, blocked or unknown
  → 401 and the dead-link page.
- **Why not better-auth's magic-link plugin.** It signs in a better-auth `User` and
  auto-creates one for an unknown email (1.7.x docs via Context7), so the investor
  would get an account; decision 2 forbids that. Its hashed-token storage pattern is
  copied, not the plugin.
- **Tenancy.** Every portal query joins through the contact: an update is visible
  only when it is `sent` or `posted`, its audience is `investors`, and the contact is
  of kind investor, not blocked, with a live session (so a contact added later sees
  earlier updates); a document is streamed only with an `InvestorShare` row, through `artifacts.getStream` with the Data room content route's
  download headers (attachment disposition, `nosniff`, sandbox CSP, `no-store`); the
  share row is checked, scoped to the same space and user as the contact, before any
  call reaches artifact storage.
  Removing a share hides the item on the next request; deleting the Data room item
  cascades the share. One email at several companies gets one link per contact in
  the request email; opening a second company's link replaces the cookie.
- **Revoke and expiry.** Revoke deletes the contact's `InvestorPortalToken` and
  `PortalSession` rows and sets `portalBlockedAt`; the link exchange and every portal
  request refuse a blocked contact. **These operations are serialized on the contact.**
  Minting a token, the exchange (check the token, then insert the session), Revoke,
  Unblock and an email change each run in one database transaction that first locks the
  contact row; the exchange rechecks the token row and `portalBlockedAt` after the lock and
  before it inserts the session, so a session can never be created after Revoke or an
  email change deleted its token, and Unblock cannot revive one. The email-change deletion
  lives in the shared contact write (`writeContact` in `packages/db/src/contacts.ts`), so
  every path that changes an email (the `contacts.save` RPC; the agent's `contacts_save`
  cannot change an email, because it looks the contact up by the submitted email and writes
  that same address, but it can change the kind) invalidates
  access (`addContactIfNew` never changes an existing contact; a kind change away from
  investor also ends access and removes the shares, see Contacts); Unblock clears the block and
  restores nothing (old links and cookies stay dead; Resend mints a new link).
  Deleting the contact cascades the shares, tokens and sessions. Changing a contact's
  email deletes their tokens and sessions (a different person may own the address).
  Expiry is each token's `expiresAt` and each session's `expiresAt`. A
  quarterly cadence outlasts a 90-day link by a few days, so every update send mints a
  fresh link (decision 5); an investor with only an old email asks the founder, who uses
  Resend.
- **No public endpoint besides open.** With the request form and the company preview cut,
  the only unauthenticated portal route is the Open POST, which needs a valid token; there
  is nothing to enumerate and no per-address or per-IP limiter to build.
- **Issuing.** Links are issued by an investor update send, a Post to portal notice, a document share,
  Resend on an investor contact with an email, or Copy link (so a contact added after the last
  update can be sent a link and see earlier updates). The share dialog pre-ticks
  "Email them a link". With no `TransactionalEmailProvider`, the founder sees the new
  link once, in the copy-link dialog, to paste. The update email subject is the
  editor's Subject, sent from the founder's Gmail. Resend and document-share
  emails come from the instance's `TransactionalEmailProvider` (subject
  "<Company> · your link"), not the founder's Gmail. Board emails are plain text with
  no link.
- **Investors never become members.** No `User`, `Session`, `Member` or
  `SpaceMember` row is created; the postgres test asserts it.

### SAFE math and documents

Post-money ownership only, hand-rolled in `packages/core/src/safes.ts`
(`amount / cap`; combined dilution as the sum; no share counts). No priced-round conversion, no pool top-up, no
`@1984vc/cap-table`. The YC form is not modified or bundled (license unverified):
every SAFE row has a printable **cover summary** (`SafeCoverSummary`) listing the
terms with a link to YC's documents page; filling the DOCX is a follow-up.

### Mercury SAFEs

`packages/adapters/src/safe-sync.ts` `syncSafesForUser` reuses the finance sync's
`callToolFor` shape on the user's Mercury server, calling `getSafeRequests` (paged).
The finance caller rejects any tool outside `FINANCE_READ_TOOLS` (`finance-call-tool.ts`),
so this slice adds `SAFE_READ_TOOLS.mercury = ["getSafeRequests", "getSafeRequest"]` in
`packages/contracts/src/finance.ts` **and** a narrow `safeCallToolFor` in the same adapter,
built like the finance one but allowing only that list, wired in the API composition root
(`apps/api/src/app.ts`, beside `financeCallToolFor` and `devinCallTool`;
`createDevinCallTool` in `devin-call-tool.ts` is the existing narrow-caller example,
including its `isError` handling).
Rows upsert by (`spaceId`, `userId`, `source`, `externalId`). A new row gets its
`contactId` only by the Glossary rule (matching email, then Assign to contact); an
existing row keeps its contact and `roundId`. A changed prospect email affects only SAFEs
that sync afterwards. Status derives from Mercury's fields as the Glossary lists them
(the API has no sent date; a Mercury SAFE that is not canceled, paid, signed or expired is
Sent). Sync overwrites the row's Mercury fields every time; the founder edits none of
them. **Deposit matching** is best effort: a `FinanceTransaction` is linked only when
exactly one candidate qualifies (USD, classification financing, a deposit, `amountCents`
equal to `investmentAmount`, `postedAt` within 5 days of `paidAt`, and not already linked to
another SAFE); with none or several it links nothing and never picks among equal
amounts. Mercury's SAFE object carries no transaction id, so a miss is normal and the row
still reads Funded when `paidAt` is set. Sync runs on page open with the finance sync's
15-minute throttle and claim token; Refresh forces it. A malformed row is reported in the
header line ("2 SAFEs could not be read"), never written. **Removing the Mercury server
changes no row**: cached rows stay as last synced (the Glossary rule), pending hand-offs
stay until matched or cleared with Not sent, and reconnecting refreshes the same rows.
Nothing is written to Mercury.

### Audits

Intake runs on arrival, from the mail sync, not from a routine:

1. **Hook.** In `mail-sync.ts`, next to `enqueueMailAttachmentFiling`, a new
   `enqueueAuditIntake(deps, scope, newIds, now)` (`packages/adapters/src/audit-intake.ts`;
   `mail-sync.ts` now also queues meeting digests after a sync behind an optional
   `digestReady` dependency, the same shape for an optional call here)
   loads the inserted `CachedMailMessage` rows (subject, snippet, fromAddress,
   threadId, fromSelf, isSpam), keeps received, non-spam ones whose subject or
   snippet matches audit, confirmation, 409A or DocuSign and that also have a document
   attachment, come from an Auditor contact, or come from a DocuSign sender (vendor
   receipts and newsletters do not start anything), and queues one
   `auditIntakeJob(scope, messageId)` per match. The job follows the `mail.attachments`
   precedent exactly: the payload type in `BackgroundJobPayloads`
   (`packages/adapter-kit/src/types.ts`), its `payloadSchemas` entry and `auditIntakeJob`
   helper (`packages/adapter-kit/src/background-jobs.ts`, replace key
   `audit.intake:<connectionId>:<messageId>`), and a handler in
   `createBackgroundJobHandlers` (`packages/adapters/src/background-job-handlers.ts`)
   that needs only `prisma`, `jobs`, `mail` and `artifacts`, which the API
   (`apps/api/src/app.ts`) and the worker (`apps/worker/src/index.ts`) already pass, so
   neither composition changes. It does not depend on the Data room auto-file setting,
   so a DocuSign notice with no attachment is still picked up.
2. **Job.** `runAuditIntake` files the message's document attachments with
   `fileMailAttachment` (sha256 dedup, so a file the auto-filing job already stored
   returns the existing item) and looks up whether the sender is an Auditor contact.
   A message in a thread that already has a row only updates that row's `lastMailAt` (the
   row then shows "New mail"; a done or dismissed row is never reopened). Otherwise it
   creates the `AuditRequest` row (`open`, `fund` = the subject, `asOf` empty), so the
   request is visible on Investors even if nothing else works. It then starts one Investors
   agent drafting run (trigger `routine`, the `startCartaSync` pattern; the run-starting
   helper lives in `audit-intake.ts` so the job and the `investors.audits.draft` RPC both
   use it) whose prompt carries the row id, message id, thread id, the filed item ids and
   `senderKnown`, but only when the Investors agent exists and fewer than 10 drafting runs
   have started for this user today (counted from `draftStartedAt` under an advisory lock).
   Request eleven, a missing agent, or a run that fails leaves the row New with
   **Draft reply** on it; that button calls `investors.audits.draft`, which ensures the agent
   and starts the run. The agent never calls `add_to_data_room` for these.
3. **Draft.** The `audit-response` skill reads the message and the filed item,
   extracts fund, as-of date, due date and asks; calls `audit_request_upsert` with the row
   id (it corrects `fund`, `asOf` and `dueDate` on that row; with no id it returns the existing
   open row with the same normalized fund and `asOf`, or adds one for a request that did not
   arrive by mail); builds the holdings
   statement for that fund from `cap_table_read` (shares or SAFE amount, security,
   date; `asOfMatched: false` when it had to use current holdings, which the row
   shows as "Holdings as of today, not <date>"), finds the requested documents with
   `search_data_room`, drafts the reply with `mail_draft` in the thread with a "still
   needed from you" list, and moves the row to `drafted` with the draft id. Then one
   notification, "Audit request from <fund>". DocuSign: unchanged from the Carta plan
   (body only, numbers to compare, no "sign it" verdict without figures). Two mails about
   the same audit in different threads give two rows; the founder dismisses one.
4. **Close.** The founder closes a request: Mark done and Dismiss are in the row menu.
   Nothing closes or reopens a row automatically: a sent reply, including a short holding
   reply or a thank-you, is not evidence that the audit is answered, and a request-cycle
   identity that could tell them apart is not worth building for this plan. Dismissed rows
   are hidden and keep their thread key, so a reminder does not resurrect them; "Show done"
   lists history. Requests that arrive outside Gmail: ask the agent (`@audit-response` with
   the details) which calls the same upsert. No Add form.

`mail_draft` writes text only: a reply with no thread becomes a new message to the
sender, and with no Gmail connection the agent says it cannot draft and the row stays
New. Nothing is signed or submitted by the agent. Computer-use filling of auditor
portals is a follow-up.

## Slices

Each slice is one PR. A slice's tests and hand test must pass on a base that contains
only its listed prerequisites, so none of them may refer to a later slice. The slices are
merged in number order; the prerequisite list is the true dependency and number order is
only the merge order. Files that more than one slice edits are **shared**: each slice
owns the lines it introduces, and the lead merges the shared files in slice order, each
slice re-reading the lines it edits on top of the earlier ones. A delegated agent gets
only a slice's new modules (a new file with its test) and never edits a shared file. The
shared files, with the slices that edit them:

- `schema.prisma` (each slice adds its own models and fields, one migration folder per
  slice; nothing is added early), `rpc.ts`, `router.ts` and `router.test.ts` (each slice
  adds its own namespace members: `investors.*` in 2 to 7, `fundraising.*` in 8 to 10).
- `Investors.tsx`, its test and stories (1, 3, 4, 5, 6, 7, 9); `Fundraising.tsx`, its test
  and stories (8, 9, 10); `App.tsx` (1, 6, 8); `Shell.tsx` (1, 2, 8); `app.ts` (6, 10).
- `contact-tools.ts` (2, 9); `packages/db/src/contacts.ts` (6, 8, 9);
  `packages/contracts/src/contacts.ts`, `ContactDialog.tsx` and `use-contact-notices.ts`
  (5, 6, 8; slices 7 and 9 extend `contacts.linked` in `contacts.ts`).
- `executor.ts` (2, 5, 7, 8), `packages/adapters/src/builtin-tools.ts` and
  `packages/contracts/src/builtin-tools.ts` (5, 7, 8: each registers its own tool),
  `builtin-skills.ts` and `investor-tools.ts` (5, 7), `fundraising-tools.ts` (8, 9),
  `carta-agent.ts` (2, 3, 5, 7), `investors-agent.ts` (2, 5),
  `packages/contracts/src/investors.ts` (2, 5, 7, 8: the tool list grows with each tool).
- `investor-send.ts` and `UpdateEditor.tsx` (5, 6); `packages/contracts/src/fundraising.ts`
  (8, 9, 10); `packages/db/src/fundraising.ts` (8, 10); `packages/db/src/safes.ts` (9, 10).
- `notify-user.ts` (1, 2); `packages/testkit/src/cli/demo/seed.ts` (2, 3).

Background jobs and agent tools have exactly one owning slice. Only slice 7 adds a
background job (`audit.intake`: `types.ts`, `background-jobs.ts`, `background-job-handlers.ts`,
`mail-sync.ts`); update sending needs none (see the Update editor). Each new agent tool is
registered by its slice in `builtin-tools.ts` (adapters), `BUILTIN_TOOL_NAMES` (contracts),
the executor gate and dispatch, and `INVESTORS_AGENT_BUILTIN_TOOLS`: `investor_update_draft`
in 5, `audit_request_upsert` in 7, `fundraising_read` in 8, and `cap_table_update` is
added to the Investors list in 4.

Main changes fast in `Shell.tsx`, `executor.ts` and the contact files: each slice starts by
rebasing and re-reading the lines it edits. After copy changes, run
`pnpm --filter @rakazo/web intl:extract`. After adding components run `pnpm design-system`.

**Verification commands** (all run from the repository root). Unit and component tests:
`pnpm vitest run <files>`. A `*.postgres.test.ts` file skips itself unless
`VERIFY_DATABASE=1` and `DATABASE_URL` are set, so a green `vitest run` proves nothing for
it: run `pnpm test:integration` (starts Postgres in Docker and runs every
`*.postgres.test.ts`, including new ones). End-to-end specs: `pnpm test:e2e --spec=e2e/<name>.spec.ts`
(the harness starts Postgres, the API and the web app and runs headless Chromium; plain
`pnpm --filter @rakazo/web e2e` starts only Vite and fails on signup). Never run the desktop
Electron suite locally. Stories: `pnpm design-system:check`, and in `apps/web`
`build-storybook` then `node .storybook/smoke.mjs storybook-static <filter>`.

**Hand test starting state.** Every slice is also tested by hand before merge: from the
slice's worktree run `DEMO_SLOT=<n> pnpm demo:up` (a free slot), use the slice's behavior
through the web UI or real HTTP as a founder, look at the result, and stop it with
`DEMO_SLOT=<n> pnpm demo:down`. What the demo seeds (`packages/testkit/src/cli/demo/seed.ts`):
a company, the Chief bot, **two connected Gmail emulator accounts** (sends are emulated and
never leave the stack; an address at the demo bounce domain fails on purpose), Mercury and
Brex **already connected** with canned read tools that include no SAFE tool, a Carta server
with a mock cap table (none when the stack starts without a model), Finance data, Data room
documents and demo contacts. It has **no Google Drive**. A check that needs "not connected"
begins by disconnecting that integration in Integrations. The PR says what was exercised
and what the demo cannot provide.

### 1. Rename Cap Table to Investors

- **Goal.** `/app/investors`, sidebar "Investors", redirect, hidden-page key
  migration; nothing else changes.
- **Owned files.** `apps/web/src/pages/CapTable.tsx` → `Investors.tsx` (+ stories,
  tests), `App.tsx` (route; `<Navigate>` from `/app/cap-table/*` keeping the query,
  with `kind=shareholder|options` mapped to no filter), `Shell.tsx` (`investorsMode`,
  `sidebar-investors`, hidden key `investors` in the `pages` list of `SidebarPagesGroup`
  and in `appPages`, with keywords "cap table, equity, ownership, Carta"),
  `apps/web/src/lib/use-sidebar-glance.ts` (`surfaceOfPath` lists `investors`), the links
  to `/app/cap-table` in `components/integrations/IntegrationsHome.tsx` and
  `McpDetail.tsx` (label "Open Cap table" becomes "Open Investors") and their tests
  (`IntegrationsHome.test.tsx` lines asserting the old link and label, `McpDetail.test.tsx`),
  `apps/api/src/onboarding.ts`, `apps/web/e2e/shell-layout.spec.ts` (route list),
  `apps/web/e2e/carta-agent.spec.ts` (the "Open Cap table" assertion),
  `packages/adapters/src/notify-user.ts` (Carta's surface becomes `investors`), migration
  `<ts>_investors_hidden_page`
  (`UPDATE "user" SET "hiddenPages" = array_replace("hiddenPages", 'cap-table', 'investors')`),
  `apps/web/e2e/investors.spec.ts` (renamed), one note atop
  `docs/ux-paths/captable/catalog.md`.
- **Prerequisites.** None.
- **Behavior.** Sidebar row "Investors" (`sidebar-investors`); `/app/cap-table?kind=auditor`
  lands on `/app/investors?kind=auditor`; a hidden `cap-table` becomes a hidden
  `investors`, still reachable by URL and cross-links; the Carta agent's badge lands
  on Investors; Data room folder unchanged; the first visit after the rename shows
  nothing extra (the label change is self-explaining).
- **Tests first.** `packages/db/src/investors-hidden-page-migration.postgres.test.ts`
  (runs the SQL in a scratch schema like `carta-migration.postgres.test.ts`),
  `Investors.test.tsx` (the existing cases under the new name; it mounts the page directly,
  so it does not test the route), `IntegrationsHome.test.tsx`, `McpDetail.test.tsx`,
  `notify-user.test.ts`. The redirect and kind mapping are asserted in
  `apps/web/src/App.test.tsx` (mounts the real routes) and in the e2e spec.
- **Regression test.** `apps/web/e2e/investors.spec.ts` (screenshot `investors`; includes the
  redirect).
- **Verify.** `pnpm vitest run apps/web/src/App.test.tsx apps/web/src/pages/Investors.test.tsx apps/web/src/components/integrations/IntegrationsHome.test.tsx apps/web/src/components/integrations/McpDetail.test.tsx packages/adapters/src/notify-user.test.ts`;
  `pnpm test:integration` (the migration test);
  `pnpm test:e2e --spec=e2e/investors.spec.ts`.
- **Hand test.** Demo as seeded: sidebar row, redirect, hide and reload, Carta table shows.
- **Mobile.** No screen before or after.

### 2. Investors agent

- **Goal.** The agent behind Ask on the Investors page, created idempotently on first
  visit. Its routine, the moved skills and the three new tools arrive with the slices that
  need them (5, 7, 8); Fundraising's Ask and first-open creation arrive in 8.
- **Owned files.** `packages/contracts/src/investors.ts` (`investorsAgentSpawnKey`,
  `isInvestorsAgentSpawnKey`, `INVESTORS_AGENT_BUILTIN_TOOLS` with only tools that exist
  today and without `cap_table_update`, `INVESTOR_UPDATE_ROUTINE_NAME`),
  `apps/api/src/investors-agent.ts` (`ensureInvestorsAgent`, instructions), `rpc.ts` and
  `router.ts` (`investors.agent`), `bots.create` reserved
  prefix, `connection-access.ts` (`botUsesConnectorTools`), `sidebar-folders.ts`
  (`autoGroupFolderName`), `contact-tools.ts` (`capTableToolsAllowed` widened to the
  Investors key; `contacts_*` need no change) and `finance-tools.ts` (gate widened),
  `executor.ts` (fixed tool list for the spawn key, like `legalOnly`), `notify-user.ts`
  (the Investors spawn key maps to surface `investors`; otherwise it defaults to `thread`),
  `approval-ask.ts` (`isCartaMailSend` true for the Investors key, defensive),
  `carta-agent.ts` (the hand-off line only; the update and audit duties are dropped in
  slices 5 and 7), `Shell.tsx` (an `agentPanel` for `/app/investors`, like Legal and Data
  room; one collapsed preference; the Carta agent is no longer the page's panel;
  needs-model state as today), `lib/investors-agent.ts` (`findInvestorsAgent`),
  `PageAgentIntro.tsx` (`pageAgentKind` and starter questions), `agent-colors.ts`
  (`investors`), the demo seed (`carta/agent` stays; `investors/agent` added); the sidebar
  lists the Carta agent only while it has recent history. Also `messaging-policy.ts` (block
  the Investors agent over Photon, decision 15) and its test.
- **Prerequisites.** 1.
- **Behavior.** Opening Investors creates "Investors agent" once; Ask opens it (also in
  the empty view); on an owner-started run it reads the Data room, Finance and contacts;
  it has no `mail_send`, no MCP servers, no Composio tools; `bots.create` refuses the
  prefix; the Carta agent, asked for an update, points to the Investors agent. No routine,
  Reminder menu or skill ships here.
- **Tests first.** `apps/api/src/investors-agent.test.ts` (idempotent), an executor test
  that runs an Investors-agent turn and asserts the offered tool list contains the fixed
  tools and none of `mail_send`, `cap_table_update`, any MCP server tool or any Composio
  tool, `contact-tools.test.ts`, `finance-tools.test.ts`, `notify-user.test.ts`,
  `Investors.test.tsx` (Ask shows the panel without Carta).
- **Regression test.** `apps/web/e2e/investors-agent.spec.ts` (Ask opens the chat
  with no Carta server; screenshot `investors-agent`).
- **Verify.** `pnpm vitest run apps/api/src/investors-agent.test.ts packages/adapters/src/executor.test.ts packages/adapters/src/contact-tools.test.ts packages/adapters/src/finance-tools.test.ts packages/adapters/src/notify-user.test.ts apps/web/src/pages/Investors.test.tsx`;
  `pnpm test:e2e --spec=e2e/investors-agent.spec.ts`.
- **Hand test.** Demo as seeded: reload and see one "Investors agent" in Bots, Ask, ask
  "who owns what" and read the answer from the mock cap table (needs a model; without one
  say so). To see Ask with no Carta, disconnect Carta in Integrations first.
- **Mobile.** Ships: the chat works as for the Legal agent.

### 3. Cap table sources: typed-in table, source line, math

- **Goal.** A founder without Carta types holders in; one source line; the source is a
  database-enforced writer rule.
- **Owned files.** `packages/contracts/src/carta.ts` (`sourceRef`, security names, holder
  ids), `packages/core/src/cap-table.ts` (pure math), `schema.prisma` (`source` and
  `previous` columns on `CapTableSnapshot`), `packages/db/src/cap-table.ts` (conditional write by
  `expectedSource`, whole-table save with `updatedAt` check, `changeSource`, `undoSource`),
  `saveCapTableSnapshot` takes the expected source from the update's own `source` field
  (default `carta`, so the Carta agent's `cap_table_update` calls are unchanged and
  `contact-tools.ts` needs no edit here), `apps/api/src/carta-agent.ts`
  (`onMcpServerConnected` respects the source; Carta sync writes as `carta`), `rpc.ts` and
  `router.ts` (`investors.capTable` replaces `carta.capTable`, `carta.refresh` becomes
  `investors.refresh` dispatching to Carta; `investors.capTableSave`,
  `investors.changeSource`, `investors.undoSource`) with `router.test.ts` migrated from the `carta.*` names,
  `CapTable.stories.tsx` → `Investors.stories.tsx`, `Investors.tsx` (source line and menu,
  `CapTableEditor` component with story: row menu with Delete holder, labeled phone inputs,
  "Not saved" with Retry, "Changed elsewhere"; two figures, 409A meta line), empty view
  (header with Ask; two equal buttons Connect Carta and Type it in; slice 4 adds Use a
  Google Sheet), phone row layout. The page's
  existing parts are reused, not rewritten: `Summary`/`Figure`, `joinRows` (kept for the
  holder-to-contact link; its contact-only rows, the `CAP_TABLE_KINDS` loop, leave the
  holdings table and move to a Contacts section added in this slice, so no contact
  disappears from the page: tabs Investors and Auditors, name and organization, the
  row menu Edit and Delete; the Board tab arrives in slice 5 and the Portal column in
  slice 6; the Shareholders, Options and Other tabs go away with the merged table), `ContactDialog` with
  `ContactPrefill`, `useContactNotices`, `SearchField`, `PickFilter`, sort. The pool row
  keeps main's label "Unallocated pool" (the mockup used "Option pool (unallocated)" and
  is updated). The `OwnershipDonut` is replaced by the approved bar (delete the component
  with its story and test when nothing else uses it). `packages/testkit/src/cli/demo/seed.ts`
  keeps seeding the mock cap table.
- **Prerequisites.** 1.
- **Behavior.** As in "Cap table sources": in-place editing with autosave and defaults,
  pool row, linking by contact name and Add as contact, a failed save keeping the typed rows
  with "Not saved" and Retry, a stale table reloading with "Changed elsewhere", Change
  source at once with the data kept, Undo only after a switch, Carta sync stopping when another source is chosen,
  percent and bar from `packages/core`, Raised excludes SAFE money.
- **Tests first.** `packages/core/src/cap-table.test.ts` (pool in the denominator and stored once, a snapshot
  SAFE holder outside the 100%, null shares or invested kept as "—", percent column "—" when
  the rows do not add up to the source's `fullyDilutedShares`, rounding sums to 100,
  zero-money table), `packages/db/src/cap-table.postgres.test.ts` (extend the existing file:
  old rows read as carta; a write that expects another source than the row's is refused,
  including a Carta write after a switch to native and a late sheet write after a switch
  back; a stale whole-table save refused; switching typed-in to Carta then Undo returns the
  typed rows once, and a second Undo does nothing), `apps/api/src/carta-agent.test.ts` (no sync when
  source is native), `Investors.test.tsx` (edit, autosave, Not saved and Retry keeps the
  typed rows, Changed elsewhere, Delete holder; holdings sum to 100.0 and SAFEs sit outside it).
- **Regression test.** `apps/web/e2e/investors.spec.ts` gains a typed-in case
  (screenshot `investors-native`).
- **Verify.** `pnpm vitest run packages/core/src/cap-table.test.ts apps/api/src/carta-agent.test.ts apps/api/src/router.test.ts apps/web/src/pages/Investors.test.tsx`;
  `pnpm test:integration` (cap-table.postgres.test.ts);
  `pnpm test:e2e --spec=e2e/investors.spec.ts`.
- **Hand test.** Demo as seeded (Carta table shown): Change source, Type it in, edit a
  holder and blur, reload and see it saved; enter a negative number and see it outlined and
  not saved; edit the same table in a second tab and see "Changed elsewhere"; Undo
  returns the typed table; check the phone width.
- **Mobile.** Degrades: no screen.

### 4. Google Sheet as cap table source

- **Goal.** A sheet the founder keeps becomes the cap table.
- **Owned files.** `apps/web/src/components/data-room/ImportFromDrive.tsx` (+ its story and
  test: a single-file mode on `DrivePicker` that lets the founder pick one Google Sheet and
  returns `{ id, name }` without calling `dataRoom.importDrive`; the existing import
  behavior is unchanged and tested), `apps/api/src/investors-sheet-sync.ts`
  (`startSheetRead`, `sheetReadState`), `rpc.ts` and `router.ts` (`investors.useSheet`;
  `investors.refresh` dispatches to it; `investors.capTable` returns `reading` and
  `lastReadFailed`), `packages/contracts/src/investors.ts` (`cap_table_update` added to
  `INVESTORS_AGENT_BUILTIN_TOOLS`), `packages/db/src/cap-table.ts` (the sheet write checks
  the file id and a non-empty holder list), `Investors.tsx` (Use a Google Sheet button,
  "Reading sheet…", "Last read failed", Connect Google Drive when no connection).
- **Prerequisites.** 2, 3.
- **Behavior.** As in "Cap table sources"; one read at a time; a failed read leaves
  the old table and shows the failure in the header line. The completeness guarantee is the
  narrowed one stated there.
- **Tests first.** `apps/api/src/investors-sheet-sync.test.ts` (one run at a time, prompt
  names the file id, failed state from run vs snapshot times), `cap-table.postgres.test.ts`
  (a sheet write for another file id or with no holders is refused, and a write while the
  source is not `sheet` is refused), `ImportFromDrive.test.tsx` (single-file mode returns
  the sheet and imports nothing; import mode unchanged), `Investors.test.tsx` (reading and
  failed states).
- **Regression test.** The web test; the e2e harness has no Drive.
- **Verify.** `pnpm vitest run apps/api/src/investors-sheet-sync.test.ts apps/web/src/components/data-room/ImportFromDrive.test.tsx apps/web/src/pages/Investors.test.tsx`; `pnpm test:integration`.
- **Hand test.** The demo has no Google Drive: choose Use a Google Sheet and confirm Connect
  Google Drive appears and the table is unchanged. The picker, the read and the truncated
  case need the manual check with a real Drive.
- **Mobile.** Degrades: no picker.

### 5. Updates and board

- **Goal.** Draft, edit and send an update to investors or the board; keep history;
  the monthly draft lands as an action item.
- **Owned files.** `schema.prisma` (`InvestorUpdate`; `Contact` kind board), `packages/contracts/src/contacts.ts` (the
  board kind), `ContactDialog.tsx` (`contactKindNames`, `contactAddLabels` get Board; the
  Investors Contacts section gets its Board tab), `packages/db/src/investor-updates.ts`,
  `packages/contracts/src/investors.ts` (schemas; `investor_update_draft` added to the
  tool list), `rpc.ts` and `router.ts`
  (`investors.updates.list|get|save|send|retry|markDelivered|duplicate|delete`,
  `investors.reminder`), `apps/api/src/investor-send.ts` (the send loop, started by
  `updates.send` in the API process: per-recipient send through the Inbox composer's
  `inboxComposeSend` under an idempotency key, deliveries, stale-sending display; no
  background job, so nothing is added to `types.ts`, `background-jobs.ts` or the worker),
  `packages/adapters/src/investor-tools.ts` (`investor_update_draft`: `history`, `get`,
  `save`, `create`), its registration in `packages/adapters/src/builtin-tools.ts`,
  `packages/contracts/src/builtin-tools.ts` and `executor.ts` (gate option, name set,
  dispatch), `builtin-skills.ts` (`investor-update`, moved from the Carta agent: reads past
  updates through `history`, falls back to Gmail Sent; takes an audience; the Gmail-draft step
  is removed), `apps/api/src/investors-agent.ts` (`ensureInvestorsRoutine`: the monthly
  routine), `carta-agent.ts` (drop the update duty),
  `apps/web/src/pages/investors/UpdateEditor.tsx` (+ story, test), the nested route for
  `/app/investors/updates/:id` (registered inside the Investors route in `App.tsx`),
  `apps/web/src/components/investors/ActionItems.tsx` (+ story; the Action items block, here
  with the unreviewed update draft; slice 7 adds audit rows), `Investors.tsx` (Updates section
  listing every draft with one status word, Mark delivered, Retry on a Partly sent row and a
  row menu (Duplicate, Delete), Board tab with Message the board, the "Sent to <n>" toast,
  the Reminder menu).
- **Prerequisites.** 2, 3.
- **Behavior.** As in "Update editor", for the Gmail path: Send, Retry, Mark delivered,
  the routine draft and the Reminder menu. Post to portal, the per-recipient link, Posted
  rows, portal notices and revoked recipients arrive in slice 6 with the portal; until then,
  without Gmail the one button is "Connect Gmail to send" for both audiences. The agent can
  read past updates and open and edit an existing draft (never a sent one), which is how the
  phone workflow works.
- **Tests first.** `packages/db/src/investor-updates.postgres.test.ts` (scope, deliveries),
  `apps/api/src/investors-agent.test.ts` (one routine, reminder rewrite incl. quarterly crons),
  `builtin-skills.test.ts`, `apps/api/src/investor-send.test.ts` (one message per
  recipient, a failed recipient recorded and retried, second Send is a no-op, an update
  stuck in sending past 10 minutes reads Partly sent, an attempt with no result shows as
  Unknown and is not resent), `packages/adapters/src/investor-tools.test.ts` (history, get,
  save a draft, refusing a sent update), `executor.test.ts` (the tool is offered to the
  Investors agent and to no other bot), `UpdateEditor.test.tsx` (TBD
  prompt once, a sent update read-only, audience fixes recipients, recipient without email
  greyed and unticked, failed recipient Retry, Unknown outcome with the once-only resend
  question that starts a new attempt with its own `ComposeSend` row and keeps the Unknown one,
  To list hidden without Gmail, board without Gmail offers only Connect Gmail to send, an
  Unknown recipient makes the update Partly sent, Retry on its Updates row asks the resend
  question, Mark delivered records it Sent and clears Partly sent when nothing failed, Partly
  sent chip and Done footer, a Sending row in Updates, a draft stays in Action items until
  sent or deleted).
- **Regression test.** `apps/web/e2e/investors-updates.spec.ts` (mock
  `**/rpc/investors/**` like `legal.spec.ts`; screenshot `investors-update`).
- **Verify.** `pnpm vitest run apps/api/src/investor-send.test.ts apps/api/src/investors-agent.test.ts packages/adapters/src/investor-tools.test.ts packages/adapters/src/builtin-skills.test.ts packages/adapters/src/executor.test.ts apps/web/src/pages/investors/UpdateEditor.test.tsx`;
  `pnpm test:integration` (investor-updates.postgres.test.ts);
  `pnpm test:e2e --spec=e2e/investors-updates.spec.ts`.
- **Hand test.** Demo as seeded (two Gmail emulator accounts connected, so the From picker
  shows and Send works against the emulator): add a board contact, New update, Draft with
  agent, edit, Send to two investors and see "Sent to 2"; send to an address at the demo bounce
  domain and see Failed with Retry; Message the board; change the Reminder and see the
  routine schedule change. To see "Connect Gmail to send", disconnect both Gmail accounts in
  Integrations first. Real Gmail sending, Unknown outcomes after a restart and the
  `history` of real sent mail need the manual check.
- **Mobile.** Degrades: the draft notification opens the agent chat, where the
  founder reads and adjusts the draft through `investor_update_draft` (`get`, `save`);
  sending is web and desktop.

### 6. Investor portal

- **Goal.** Decisions 2, 5 and 6: per-contact link, landing page, sessions, blocked
  state, document shares and investor-audience updates as the only content; Post to
  portal and its notices, which need the portal to exist; the shared linked-contact delete
  confirmation (decision 13).
- **Owned files.** `schema.prisma` (`InvestorShare` for documents, `InvestorPortalToken`,
  `PortalSession`; `Contact` portal columns), `components/data-room/ItemMenu.tsx` and
  `ItemDialogs.tsx` (+ stories, tests: "Share with investors" on any document and the Share
  dialog with Unshare; `FolderDocuments.tsx` is not changed),
  `packages/db/src/investor-portal.ts` (mint a token per send, resolve by hash,
  create and resolve sessions in locked contact transactions, revoke and block, document
  share queries, the update visibility query), `packages/db/src/contacts.ts` (`writeContact`
  deletes the contact's tokens and sessions when the email changes, and also the shares
  and tokens when the kind changes away from investor, under the same lock; `writeContact`
  is private, reached through `saveContact`, and `addContactIfNew` only creates; also the
  new `contacts.linked` function), `packages/contracts/src/contacts.ts` (portal output
  fields as read-only; deletion-impact output), `rpc.ts`/`router.ts` (`contacts.linked`),
  `ContactDialog.tsx` and `use-contact-notices.ts` (ask before deleting a contact with
  linked data, no Undo for it; applies on the Contacts page too),
  `apps/api/src/request-body-limit.ts` (`/api/portal/*`), `apps/api/src/app.ts` (portal
  no-store middleware; one mount line),
  `apps/api/src/investor-portal.ts` (`mountInvestorPortal`: open page, open, me, updates,
  documents, document content, sign-out),
  `apps/api/src/investor-send.ts` (a new token and link per recipient on every send; the
  portal notices of Post to portal), `rpc.ts` and
  `router.ts` (`investors.updates.post`, `investors.share`, `investors.unshare`,
  `investors.portalResend`, `investors.portalRevoke`, `investors.portalUnblock`),
  `apps/web/src/pages/portal/PortalOpen.tsx`, `PortalHome.tsx`, `PortalDead.tsx`
  (+ stories, tests; `PortalOpen` reads the fragment, posts and clears it),
  `UpdateEditor.tsx` (Post to portal, revoked recipients greyed, the unticked-investor line),
  `App.tsx` (`/portal/*`), `Investors.tsx` (Portal column, contact row menu with
  Resend, Revoke, Unblock, Edit, Delete, the copy-link dialog).
- **Prerequisites.** 5.
- **Behavior.** As in "Portal security" and "Portal", plus Post to portal as in "Update
  editor" (Posted rows, one best-effort notice per investor contact with an email who is not
  revoked, the toast "Posted · <n> notified"). Portal principals are investor contacts only.
- **Tests first.** `packages/db/src/investor-portal.postgres.test.ts` (contact A
  never lists B's document shares or another space's updates; a board update is never
  listed; a contact added after an update lists it; a draft is not listed; blocked
  contact refused everywhere; expired token refused; a second send mints a second
  working token and the first still works until expiry; revoke deletes every token
  and session and sets `portalBlockedAt`; revoke ends a live session; unblock does
  not revive an old cookie; an email change through the `contacts.save` RPC ends sessions,
  and a kind change away from investor (also through `contacts_save`) ends tokens, sessions
  and shares; only hashes are stored;
  the cookie value is not a contact id; no user or membership rows; same space, different
  owner: contact A never sees owner B's shares or updates; an exchange racing Revoke, and
  one racing an email change, never leaves a live session, including after a later
  Unblock; Post to portal notices go to investor contacts with an email, not revoked, and to
  nobody else; `contacts.linked` names tokens and shares), `apps/api/src/investor-portal.test.ts` (GET open does not set a cookie and its
  request line and logs carry no token because it is in the fragment; POST sets the
  cookie with the flags; every `/api/portal/*` response is `private, no-store`; an oversized
  body is refused; a POST with a foreign `Origin` is refused; 401 without cookie; content
  route refuses an unshared item, and a document request without a share never reaches
  artifact storage (assert the storage mock is not called)), `PortalHome.test.tsx`,
  `PortalOpen.test.tsx` (fragment read and cleared, dead link page with only its
  sentence, no company name on the landing page), `PortalHome.test.tsx` also covers
  the empty state and the earlier-updates rows, `UpdateEditor.test.tsx` (Post to portal
  instead of Send without Gmail, revoked recipient greyed and unticked, the unticked-investor
  line), `ItemDialogs.test.tsx` (Share and Unshare), `ContactDialog.test.tsx` (delete asks first
  with linked data, plain contact keeps Undo). The portal footer and toast text are asserted in
  these component tests, and the absence of the token from request lines in the API test and the
  e2e spec; proxy logs are not testable here and rest on the fragment design.
- **Regression test.** `apps/web/e2e/investor-portal.spec.ts` (founder sends an
  update, the Gmail emulator at `/__e2e/gmail` holds the sent message and its link (the
  transactional notices of Post to portal are read from `/__e2e/emails`), the landing
  page then home shows that update only; revoke makes the link dead; screenshots
  `investor-portal`, `investor-portal-open`).
- **Verify.** `pnpm vitest run apps/api/src/investor-portal.test.ts apps/web/src/pages/portal/PortalHome.test.tsx apps/web/src/pages/portal/PortalOpen.test.tsx apps/web/src/pages/investors/UpdateEditor.test.tsx apps/web/src/components/data-room/ItemDialogs.test.tsx apps/web/src/components/ContactDialog.test.tsx`;
  `pnpm test:integration` (investor-portal.postgres.test.ts);
  `pnpm test:e2e --spec=e2e/investor-portal.spec.ts`.
- **Hand test.** Demo as seeded (Gmail emulator connected): as the founder, send an update
  to an investor contact, read the emulator message, open its link in a second browser profile
  (landing page with only an Open button, then home with only that update), Share a Data room
  document from its menu and download it in the portal, Revoke and see the second profile
  refuse at once, delete a contact that has portal access and see the confirmation. To see
  Post to portal, disconnect Gmail first.
- **Mobile.** Investors open the portal in any browser; nothing in the mobile app.

### 7. Audit requests on arrival

- **Goal.** Decision 4 end to end: intake from mail sync, filed once, visible at once,
  drafted, closed by the founder (Mark done or Dismiss).
- **Owned files.** `schema.prisma` (`AuditRequest`), `packages/db/src/audit-requests.ts`,
  `packages/adapters/src/audit-intake.ts` (`enqueueAuditIntake`, `runAuditIntake`, the
  drafting-run starter), `packages/adapter-kit/src/types.ts` (`"audit.intake"` in
  `BackgroundJobPayloads`), `packages/adapter-kit/src/background-jobs.ts` (payload schema
  and `auditIntakeJob`), `packages/adapters/src/background-job-handlers.ts` (`audit.intake`;
  no new deps, so `apps/api/src/app.ts` and `apps/worker/src/index.ts` do not change),
  `mail-sync.ts` (one call next to the filing enqueue), `investor-tools.ts`
  (`audit_request_upsert`) with its registration in `builtin-tools.ts` (adapters),
  `BUILTIN_TOOL_NAMES` (contracts), `executor.ts` (gate, dispatch) and the Investors tool
  list in `packages/contracts/src/investors.ts`, `builtin-skills.ts` (`audit-response`, moved
  from the Carta agent), `carta-agent.ts` (drop the audit duty), `packages/db/src/contacts.ts`
  (`contacts.linked` also counts audit rows, shared with 6, 8, 9), `rpc.ts`/`router.ts`
  (`investors.audits.list|update|draft`), `ActionItems.tsx` (audit rows: New, Draft ready,
  New mail, as-of warning, sender flag, Draft reply, menu with Mark done and Dismiss, the
  Show done button), `Investors.tsx` (Show done in the Updates header).
- **Prerequisites.** 2, 5 (the tool and skill files and `ActionItems.tsx` that slice 5
  introduces; the Data room is already merged).
- **Behavior.** As in "Audits": intake matches audit, confirmation, 409A or DocuSign mail
  with a document attachment, an Auditor sender or a DocuSign sender, independent of the Data
  room auto-file setting; the row exists on arrival; a message in a known thread only updates
  `lastMailAt`; drafting starts only when the agent exists and fewer than 10 drafts have
  started today, otherwise the row waits with Draft reply; the agent drafts in the thread with
  `mail_draft` and moves the row to `drafted`; one notification "Audit request from <fund>";
  nothing closes a row but Mark done or Dismiss; history stays reachable after the last row
  closes.
- **Tests first.** `packages/db/src/audit-requests.postgres.test.ts` (unique thread,
  dismissed stays dismissed, the daily draft count under concurrent intakes never passes 10),
  `packages/adapters/src/audit-intake.test.ts` (match rules, a known thread touches only
  `lastMailAt`, filed ids passed, the row is created even when no agent exists, request eleven
  creates a row and starts no run, auto-file setting off still intakes),
  `investor-tools.test.ts` (upsert by id and by fund + as-of, state only moves forward),
  `builtin-skills.test.ts`, `executor.test.ts` (the tool is offered to the Investors agent
  only), `Investors.test.tsx` (ordering: due date first, then newest; Show done reachable with
  no open row).
- **Regression test.** `apps/web/e2e/investors.spec.ts` gains an action-items case
  with mocked `investors.audits.list` (screenshot `investors-audits`).
- **Verify.** `pnpm vitest run packages/adapters/src/audit-intake.test.ts packages/adapters/src/investor-tools.test.ts packages/adapters/src/builtin-skills.test.ts packages/adapters/src/executor.test.ts apps/web/src/pages/Investors.test.tsx`;
  `pnpm test:integration` (audit-requests.postgres.test.ts);
  `pnpm test:e2e --spec=e2e/investors.spec.ts`.
- **Hand test.** Demo as seeded: the Gmail emulator is connected, so a message can be
  delivered to a demo mailbox through the emulator's own inbound path; if that path cannot
  inject an audit-shaped message, ask the agent (`@audit-response` with invented details), which
  calls the same upsert. Confirm the row appears, Draft reply works, Mark done, Show done, and
  that a second request with the same fund and date through the agent does not duplicate.
  Attachment filing and real Gmail drafts need the manual check with a real mailbox.
- **Mobile.** Degrades: the notification opens the agent chat; the action list is
  web and desktop.

### 8. Fundraising page: round and pipeline

- **Goal.** The second page with the whole round lifecycle and the prospect pipeline.
- **Owned files.** `schema.prisma` (`FundraiseRound`; `Contact.stage`,
  `checkSizeCents`, `nextStep`, `roundId`), `packages/contracts/src/contacts.ts`
  (the prospect kind and the stage fields), `ContactDialog.tsx` (Prospect in
  `contactKindNames` and `contactAddLabels`; Stage, check size and next step shown only
  for kind prospect, since the dialog is shared with the Contacts page),
  `packages/db/src/contacts.ts` (pipeline field mapping; `contacts.linked` counts a stage),
  `packages/db/src/fundraising.ts`, `packages/contracts/src/fundraising.ts`, `rpc.ts` and
  `router.ts` (`fundraising.overview`, `fundraising.round.save|close|reopen`,
  `fundraising.prospects.save`), `packages/adapters/src/fundraising-tools.ts`
  (`fundraising_read`) with its registration in `builtin-tools.ts` (adapters),
  `BUILTIN_TOOL_NAMES` (contracts), `executor.ts` (gate, dispatch) and the Investors tool
  list, `apps/web/src/pages/Fundraising.tsx` (+ stories, tests; `Pipeline` component; Edit
  round and Reopen dialogs; an empty SAFEs section until slice 9; the contact dialog reused
  with kind prospect and Stage), `App.tsx` (`/app/fundraising`), `Shell.tsx` (`fundraisingMode`,
  `sidebar-fundraising`, hidden key `fundraising`, Ask opens the Investors agent, the page
  calls `investors.agent` on first open, palette keywords "safe, round, raise").
- **Prerequisites.** 1, 2.
- **Behavior.** Sidebar row after Investors; the page always shows the pipeline and SAFEs; with no
  round the round card offers Start a round, and Add prospect works; round bar as specified (Funded and Signed zero until slice 9; Pending counts Committed prospects of the open round); pipeline
  grouped by stage without row chips; Send SAFE on Committed rows is hidden until slice 9; the
  full round lifecycle (Start, Edit, Close, Reopen); a Committed prospect from a closed round
  counts nowhere until its Committed stage is saved again; the agent answers round and pipeline
  questions from `fundraising_read`.
- **Tests first.** `packages/db/src/fundraising.postgres.test.ts` (one open round,
  scoping, Reopen refused while another round is open; a Committed prospect from a closed
  round counts in no later round's Pending until its Committed stage is saved again),
  `investor-tools.test.ts` is not used; `fundraising-tools.test.ts` (`fundraising_read` shape),
  `executor.test.ts` (offered to the Investors agent only), `Fundraising.test.tsx` (grouping, Passed collapsed, empty state,
  Close round only in the round menu, Edit round, Reopen, amount column, Pipeline and SAFEs
  shown with no round and after Close, Add prospect with no round, an existing email opens
  that contact). The close-with-signed-unpaid-SAFE confirm and "close keeps SAFEs" tests live
  in slice 9, where the `Safe` table exists.
- **Regression test.** `apps/web/e2e/fundraising.spec.ts` (screenshot `fundraising`).
- **Verify.** `pnpm vitest run packages/adapters/src/fundraising-tools.test.ts packages/adapters/src/executor.test.ts apps/web/src/pages/Fundraising.test.tsx`;
  `pnpm test:integration` (fundraising.postgres.test.ts);
  `pnpm test:e2e --spec=e2e/fundraising.spec.ts`.
- **Hand test.** Demo as seeded: Fundraising from the sidebar; Add prospect with no round,
  Start a round, move a prospect to Committed and see Pending; Close, see the commitment count
  nowhere, Reopen; Add a prospect with a demo contact's email and see that contact open; Ask the
  agent about the pipeline.
- **Mobile.** Degrades: no screen; the agent answers from `fundraising_read`.

### 9. SAFEs: native rows, Send SAFE, cover summary, Attention strip

- **Goal.** Decision 3 without Mercury, plus the SAFE rows on both pages.
- **Owned files.** `schema.prisma` (`Safe`), `packages/db/src/safes.ts`,
  `packages/core/src/safes.ts` (status, `needsAttention`, post-money math),
  `packages/contracts/src/fundraising.ts` (SAFE schemas), `rpc.ts` and `router.ts`
  (`fundraising.safes.list|save|mark|delete`), `fundraising-tools.ts` (`fundraising_read`
  returns SAFEs), `Fundraising.tsx` (SAFEs section, Attention strip with Mark funded and Mark
  signed, `SafeDialog`, `SafeCoverSummary` with Mark sent, Send SAFE wiring, Mark
  sent/signed/funded date dialog with Undo, Cancel SAFE, the close-round confirm),
  `Investors.tsx` (unconverted SAFE rows), `contact-tools.ts` (`cap_table_read` returns SAFEs),
  `packages/db/src/contacts.ts` (kind flips to investor on Signed, only for a prospect, and is
  not reversed; `contacts.linked` counts SAFEs).
- **Prerequisites.** 3, 8.
- **Behavior.** As in "Fundraising" and "Cap table sources": one Send SAFE button
  (native dialog in this slice; the Mercury hand-off comes with slice 10), the row
  leaves the pipeline once a SAFE exists, Draft SAFEs do not count on Investors,
  Signed flips a prospect contact to investor (board and auditor keep their kind), the round bar sums Funded and Signed from
  rows and Pending from Committed-stage prospects without a SAFE plus Sent SAFEs and
  native-dialog Drafts, and a prospect whose only SAFE is canceled or deleted before it was
  signed returns to the pipeline.
- **Tests first.** `packages/core/src/safes.test.ts` (status from timestamps,
  needsAttention, at-cap percent and sum with invented figures, a Mercury discount-only SAFE shows none),
  `packages/db/src/safes.postgres.test.ts` (scope, kind flip for a prospect and none for a board contact, round totals),
  `Fundraising.test.tsx` (close confirm only with a signed unpaid SAFE, closing keeps the
  round's SAFEs; dialog: cap only (no discount or MFN field), prefill from round; the
  button reads Send SAFE; Send SAFE hides after a SAFE exists and returns after the
  SAFE is deleted; the round bar total is unchanged when Send SAFE turns a committed
  prospect into a Draft), `Investors.test.tsx` (SAFE rows, Drafts hidden),
  `fundraising-tools.test.ts` (SAFEs in `fundraising_read`).
- **Regression test.** `apps/web/e2e/fundraising.spec.ts` adds a SAFE (screenshot
  `fundraising-safe`).
- **Verify.** `pnpm vitest run packages/core/src/safes.test.ts packages/adapters/src/fundraising-tools.test.ts apps/web/src/pages/Fundraising.test.tsx apps/web/src/pages/Investors.test.tsx`;
  `pnpm test:integration` (safes.postgres.test.ts);
  `pnpm test:e2e --spec=e2e/fundraising.spec.ts`.
- **Hand test.** Demo as seeded. Mercury is connected in the demo, which makes Send SAFE take the
  Mercury path of slice 10; this slice's Send SAFE is the native dialog, so disconnect Mercury in
  Integrations first. Then Send SAFE on a Committed prospect, cover summary, Print, Mark sent, Mark
  signed (the contact becomes an investor), Mark funded with a date and Undo, Cancel and Delete,
  Close round with a signed unpaid SAFE.
- **Mobile.** Degrades: no screen.

### 10. Mercury SAFE sync, Waiting for Mercury and deposit matching

- **Goal.** Decision 3 with Mercury: SAFEs created in Mercury show up with their real
  status and, where possible, the deposit.
- **Owned files.** `packages/contracts/src/finance.ts` (`SAFE_READ_TOOLS`), the API
  composition root `apps/api/src/app.ts` (`safeCallToolFor`, the allowlisted caller, beside
  `financeCallToolFor`), `schema.prisma` (`Contact.mercurySentAt`, `SafeSyncState`,
  `Safe.financeTransactionId`), `packages/adapters/src/safe-sync.ts` (`syncSafesForUser`, zod
  mapper, throttle and claim on its own `SafeSyncState` row),
  `apps/api/src/fundraising.ts` (sync on `fundraising.overview`; no server-removal hook: removing
  Mercury changes no row), `packages/contracts/src/fundraising.ts` and `rpc.ts`/`router.ts`
  (`fundraising.refresh`, `fundraising.safes.assign|unassign`,
  `fundraising.prospects.markWaiting|notSent`), `packages/db/src/fundraising.ts` (Waiting for
  Mercury and Not sent), `packages/db/src/safes.ts` (upsert by source+externalId, attach by email,
  assign, unassign, deposit match against `FinanceTransaction`), `Fundraising.tsx` (Mercury header
  states, Send SAFE opens Mercury and marks the prospect Waiting for Mercury, Not sent, Assign to
  contact, Unassign, deposit line with the Finance link, Mercury document in Open),
  `packages/testkit/src/cli/demo/data.ts` (a canned `getSafeRequests` answer with invented rows
  in the Mercury tools and handlers, so the demo can exercise sync).
- **Prerequisites.** 9 (and a Mercury server from Finance).
- **Behavior.** As in "Mercury SAFEs" and "Send SAFE" and the Glossary counting rule.
- **Tests first.** `packages/adapters/src/safe-sync.test.ts` (synthetic
  `getSafeRequests` fixtures shaped like the documented response, run through
  `safeCallToolFor` so the allowlist is exercised (a write tool or a finance-only tool is
  refused); a malformed row is counted, not written; status from the documented fields; two
  deposits of equal amount match nothing, a non-USD or already-linked transaction is never
  matched), `packages/db/src/safes.postgres.test.ts` (email match attaches the SAFE to the
  prospect and removes its check size from Pending; an unmatched SAFE is listed, in no round bar,
  and Assign attaches it; the same Mercury id under two users of one space and under two spaces
  yields separate rows; the match ignores case and surrounding whitespace; Not sent restores the
  normal prospect row; a Mercury SAFE canceled after attach counts zero and the prospect returns
  to the pipeline if it was never Signed; deposit match; removing the Mercury server changes no
  row, no total and keeps Waiting for Mercury; remove then re-add Mercury refreshes the same rows
  and counts each SAFE once; an Expired Mercury SAFE counts zero and does not block Send SAFE;
  attaching clears `mercurySentAt`; a wrong assign fixed by Unassign then Assign to contact counts
  once; Unassign restores the prospect's check size in Pending and leaves its kind),
  `packages/contracts/src/finance.test.ts` (the list has no write tool and the finance list has no
  SAFE tool), `Fundraising.test.tsx` (Connect and Sync failed states, with Reconnect in the failed
  menu; Send SAFE with Mercury shows Waiting for Mercury and no new SAFE row, the Waiting row's menu
  is exactly Open Mercury, Not sent, Passed and Edit prospect, Send SAFE with no email asks for it,
  Assign to contact appears only on a Mercury row with no contact and its picker lists prospects
  and investors, Unassign only on an attached Mercury row; a Funded row's menu has no Mark action).
- **Regression test.** The adapter test; live Mercury is manual.
- **Verify.** `pnpm vitest run packages/adapters/src/safe-sync.test.ts packages/contracts/src/finance.test.ts packages/testkit/src/cli/demo/data.test.ts apps/web/src/pages/Fundraising.test.tsx`;
  `pnpm test:integration` (safes.postgres.test.ts).
- **Hand test.** Demo as seeded: Mercury is already connected, so Fundraising shows the synced
  state, and with the canned SAFE rows added in this slice the SAFEs list shows them (invented data
  only). Send SAFE opens the Mercury hand-off and marks Waiting for Mercury; Not sent reverses it;
  Assign to contact and Unassign on a row. To see Connect Mercury, disconnect Mercury in
  Integrations first. Real Mercury needs the manual check.
- **Mobile.** Degrades: no screen.

Manual checks before calling the epic done: connect a real Carta, Google Drive,
Gmail and Mercury account on a development stack and walk slices 4, 5, 6, 7 and 10
once each; record what `getSafeRequests` returned (shape only, no figures) in this
file.

## Dependencies

Everything uses packages already installed: `zod`, Prisma 7, Hono, better-auth
(unchanged), `react-router-dom`, Lingui, lucide-react, shadcn components in
`packages/ui-web`, vitest, Playwright, `node:crypto`. **No new dependency is
required.** Considered and not added without a decision: `@1984vc/cap-table`
(devDependency oracle; the formula is one line) and a DOCX writer such as `docx` or
`docxtemplater` (only if the YC form fill follow-up is approved after the license
check).

## Assumptions

- Gmail imposes daily sending limits per account; one message per investor stays
  well inside them for an early-stage list, to confirm against Google's current
  limits before slice 6 (no number is stated here).
- Drive's CSV export returns the first tab of a Google Sheet; founders keep the cap
  table there.
- The Inbox composer's send primitive can be called server-side once per recipient
  with one From account.
- Mercury's `getSafeRequests` matches its public reference; the mapper validates and
  reports rather than guessing.
- A Mercury SAFE is matched to a prospect by investor email; a mismatch shows two rows
  rather than a wrong merge. A Mercury SAFE without an investor email never attaches by
  itself; the founder assigns it. A Carta or sheet SAFE holder is not matched to any
  `Safe` row.

## Open questions

- **YC SAFE license.** Not verified; the plan links to YC's page and copies nothing.
- **Self-service link recovery** (cut after review): if founders ask for a public "email me
  a link" form, it needs an atomic shared-store throttle per address, a per-IP limit at the
  proxy (the checked-in production Caddyfile has none), indistinguishable answers and timing
  for known, unknown, blocked and throttled addresses, and origin checks.
- **Documented-only fields.** Not verified against a live account: Mercury's `getSafeRequests`
  field list (`valuationType`, `valuationCap`, `investmentAmount`, `investmentDate`, the
  timestamps, `documentUrl`, `investor`), which comes from Mercury's public reference
  (research.md section 3; the tool names are in `contracts/integration-agent.ts`) and which the
  mapper validates; and the Finance fields the update draft quotes (cash, burn, runway and
  last month's revenue come from `finance_overview`, not MRR). Carta holdings and a sheet read
  are whatever `cap_table_update` receives (`CapTableSnapshotInputSchema`), so the mockup shows
  only those fields plus figures Rakazo computes (percent, Equity raised, the at-cap group).
  The mockup does not draw the docked agent panel; Ask opens the existing one.
- **Mercury SAFE webhooks** and whether `paidAt` always means a matched deposit:
  unverified; sync polls.
- **Carta "as of" holdings** for audit answers: still TBD from the Carta plan; the
  skill falls back to current holdings and the row shows it.
- **Two members in one space** (PG-20): the snapshot, SAFEs and updates stay per
  space and user as today; a CFO sees their own table. Sharing one company record
  across members changes the ownership of every table in this plan, so it needs its
  own decision and is not settled here.
- **Shared status colors.** The `--warning` and `--success` tokens match the Finance
  mockup; their small-text contrast (success tag text is 4.35:1 at 11px) is a decision
  for the shared tokens, not for this page.
- **Forwarded link** (PG-48): accepted by decision 5; the founder sees "Opened" dates
  and can Revoke.
- **Investor email on Mercury SAFEs**: whether `getSafeRequests` always carries it is
  unverified; without it the SAFE counts by status and waits for Assign to contact.
- **Where the SAFE sync claim lives** (`FinanceSyncState` column or its own row):
  `FinanceSyncState` is one row per Mercury server (primary key `mcpServerId`) whose
  claim token also guards the finance write transaction, so a SAFE sync sharing it would
  block finance sync; lean toward its own `SafeSyncState` row keyed the same way. Decide
  in slice 10.

## Out of scope and follow-ups

- Computer-use filling of auditor portals with the existing computer runtime.
- OCF export or import; priced-round modeling; vesting; option grants; pre-money
  SAFEs and cap-plus-discount SAFEs.
- Filling the YC DOCX; e-signature; sending SAFEs for signature from Rakazo.
- Board consents, minutes, meeting records, a board reminder.
- Writing to Mercury, Carta or Google Sheets.
- Read receipts per update, investor replies in the portal, "new since last visit".
- Mobile screens for Investors, Fundraising and the portal.
- CRM import; stale-prospect alerts; Fundraising notifications.

## Review record

Step 4 of the feature-request process: an Astra review of the plan (14 findings, plus
a list of scope cuts), each checked against the source before any change. File:line are
the source lines opened to confirm or refute the claim.

| Id | Finding | Verdict | Change made, or reason |
|---|---|---|---|
| 1 | Atomic portal revoke, email change, exchange | Accepted | `packages/db/src/contacts.ts:55` (`writeContact`) is a plain `updateMany` and `router.ts:7269` calls it, so email invalidation had no owner. Portal security now serializes mint, exchange, Revoke, Unblock and email change on a locked contact row in one transaction, with the email-change deletion in `writeContact`; slice 6 owns that file and tests the races. |
| 2 | SAFE key ignores the tenant | Accepted | Finance scopes its external id to a server (`schema.prisma:2192`); the plan's `(source, externalId)` was global. Key is now `(spaceId, userId, source, externalId)`, related ids must share the owner, test for two users and two spaces. |
| 3 | Portal lacks assumed protections | Accepted | `request-body-limit.ts:59-63` mounts only auth, local-settings and `/rpc/*`; `app.ts:747-753` sets `no-store` only for `/api/auth/*` and `/rpc/*`; `Caddyfile.prod` has no rate limiting. Added a Request hygiene bullet (body limit, no-store, origin check) and took the review's alternative: cut the public "Email me a link" form, so no public endpoint needs enumeration or abuse controls. |
| 4 | Carta snapshots vs the SAFE model | Accepted | `carta.ts:54-70` allows security "SAFE" with null shares and amounts; `CapTable.tsx:159-175` derives the pool from `optionPoolAvailable`. One pool representation (`optionPoolAvailable`), snapshot SAFE holders stay as read and are outside the 100% and the at-cap sum, unknown figures stay "—", percent column "—" when rows do not reconcile to the source total, no dedup by email. |
| 5 | Partial sheet imports | Accepted | `drive-tools.ts:328-337` returns `truncated`. A truncated or incomplete read fails with the existing failed-read state and `cap_table_update` is refused; the open question about a "partly read" cue is removed. |
| 6 | Mercury overrides and disconnect conversion | Accepted | Consistent with decision 8 (Mercury is the only record of a Mercury SAFE), whose intent is kept. Cut manual dates and Mark actions on Mercury rows, conversion to native on disconnect, clearing Waiting for Mercury, and Delete on Mercury rows; cached rows stay and reconnect refreshes them. |
| 7 | Import time is not round membership | Accepted | Added `Contact.roundId` (set when Committed is saved) and counted Pending only for the open round; imported Mercury SAFEs get a round only by attaching to a prospect. Needs a founder decision (below). |
| 8 | Default MFN with a cap vs a YC form | Accepted | `mockup.html` showed "Post-money cap $10M · MFN" and a default-on MFN box. Native SAFE is the YC post-money cap form only; round and dialog lose MFN and discount; imported terms stay as imported. Mockup updated. |
| 9 | Unknown-delivery retry vs the sender | Accepted | `inbox-compose.ts:432` claims only `draft` or `failed`, `:338`/`:378` leave `unknown` terminal, and `ComposeSend` (`schema.prisma:2022`) holds the state and `providerMessageId`. Each confirmed resend is a new attempt key `<updateId>:<contactId>:<n>` with its own `ComposeSend` row; the delivery reads its result from there. |
| 10 | Slices not independently complete | Accepted | Routine, Reminder and the `investor-update` skill moved from slice 2 to 5; `audit-response` to 7; Post to portal and notices from 5 to 6; the prospect kind from 5 to 8 (`contacts.ts:4` has no such kind today); SAFE-dependent tests from 8 to 9. |
| 11 | Automatic audit close and reopen | Accepted | Intake skips known threads and updates `lastMailAt` only, so the reopen rule never fired and a holding reply could close a request. Removed `closeAnsweredAuditRequests`, reopening and the courtesy-reply question; Mark done and Dismiss remain. |
| 12 | SAFE status and deposit matching | Accepted | Mercury's fields (research.md section 3) have no sent date. Status is derived from the listed fields, Canceled and Expired count zero and are not active, overdue Mark signed is native only, and a deposit links only when exactly one USD candidate qualifies (`FinanceTransaction.currency` exists, `schema.prisma:2171`). |
| 13 | Tests that miss their failure | Accepted | Slice 6 e2e uses `/__e2e/gmail` and `/__e2e/emails` (`packages/testkit/src/cli/harness.ts`; `/api/dev/emails` exists only in development, `app.ts`); slice 2 asserts the executor's offered tools; slice 10 routes the mapper through a new allowlisted `safeCallToolFor` (`finance-call-tool.ts:42` rejects other tools); slice 6 adds same-space different-owner and no-storage-call cases. |
| 14 | Shared-file ownership | Accepted | "Append-only" replaced by an explicit list of shared files, one chain in number order, with the lead owning all shared edits and delegates getting new modules only. |
| Cuts | Recovery form, Not from pipeline, company preview, duplicate-email tie-break, `lastUsedAt`, `lastSeenAt`, round `status`, share counts | Accepted | All removed (round status is derived from `closedAt`; contact emails are unique per owner). The editor now reuses `RichTextEditor.tsx`. Kept as the review advised: separate token, session and share tables, Unknown-delivery handling, source-switch protection, concurrent-edit protection. |

The founder confirmed the three decisions this review surfaced (decisions 9 to 11).

### Rebase onto main (128599932)

The plan was written against abdac68a6; 281 commits landed before this rebase. Each row
was checked against the source at 128599932. Paths, symbols and line numbers in the
table above are the ones opened at the old base; the sections above are current.

| Area | Change in the plan | Why |
|---|---|---|
| Contacts page (#465, #496, #518, #537) | New "Contacts page" bullet in What exists today. Investors keeps a Contacts section but only for investor, board and auditor (tabs Investors, Board, Auditors; the Other tab is dropped), as the portal view; every other kind stays on the Contacts page. Slice 3 adds this section when the contact-only rows leave the holdings table. | `/app/contacts` already lists, searches, adds, edits and deletes all contacts; a second full contact list on Investors would duplicate it. |
| Contact kinds | Kinds are now eight (investor, auditor, customer, vendor, partner, advisor, legal, other); the plan adds `prospect` and `board`. `contactKindNames` and `contactAddLabels` are exhaustive records, so slices 5 and 8 edit them. Glossary and data model corrected. | `ContactKindSchema` was `investor | auditor | other` at the old base. |
| Shared contact UI | Reuse `ContactDialog`, `useContactNotices` (toasts, Undo, saved-row highlight), `PageHeader`, `AskBotButton`, `SearchField`, `PickFilter`, `enqueueNotificationToast`. The duplicate-email rule now uses the dialog's "Open <name>" button. The Carta-only dialog hint (`fromCapTable`) shows only for the Carta source. | #482/#496 moved these out of `CapTable.tsx`. |
| Contact tools | `contacts_*` are offered to every agent (`contactToolsAllowed` is `mailToolsAllowed`); only `cap_table_*` stay Carta-only (`capTableToolsAllowed`). `contacts_add` returns an existing contact unchanged (`addContactIfNew`, `alreadySaved`); the "fills empty fields" behaviour is dropped. Slice 2 gates `cap_table_read` and `cap_table_update` separately. | `contact-tools.ts` and `contacts.ts` changed in #465/#496. |
| `contacts_save` approval (0729d2d15) | `contacts_save` follows the normal approval settings, so an agent can change an email without asking. The portal's email-change invalidation in `writeContact` is now also the control against unattended email changes. | Prompt and behaviour changed on main. |
| Page-agent plumbing | Slice 2 uses the Shell `agentPanel` descriptor (Legal, Data room), `findInvestorsAgent`, `pageAgentKind`/`PageAgentIntro`, `agent-colors.ts`, `botUsesConnectorTools`, `autoGroupFolderName` and the `bots.create` reserved prefixes, not `cartaPanelState`. | These exist on main now; Carta's panel is connected-state specific. |
| Routine | The seeded routine uses the account time zone and `notify: true`, and both notifications use importance `attention`. | `ensureLegalRoutine` uses UTC and `notify: false`, and `notify_user` turns a notify-off routine's notifications into `info` (no toast, no phone). |
| Slice 1 rename | Added the other places that name `/app/cap-table` or the `cap-table` surface: `use-sidebar-glance.ts` (`surfaceOfPath`), `IntegrationsHome.tsx`, `McpDetail.tsx`, `onboarding.ts`, `shell-layout.spec.ts`, the `pages` list of `SidebarPagesGroup`. | Found by searching main. |
| Cap table page | Records that the page already has `Summary`, `OwnershipDonut`, a merged holders-and-contacts table, search, security filter and sort; the pool row is "Unallocated pool" (plan and mockup changed from "Option pool (unallocated)"). | Reuse existing parts and strings. |
| Data room | `FolderDocuments` is read-only (Name, Type, Added); slice 6 extends it for "Shared with" and Share. `DrivePicker` is the Drive picker export. | Verified in `FolderDocuments.tsx`. |
| Mercury / sync | `safeCallToolFor` follows `createDevinCallTool` (`devin-call-tool.ts`). `FinanceSyncState` is keyed by Mercury server and its claim guards finance writes, so the open question now leans to its own `SafeSyncState`. | New precedent; schema read. |
| Mail sync / jobs | Audit intake hook sits next to `enqueueMailAttachmentFiling`, which now shares `syncMailbox` with meeting-digest queueing; new job names also need `payloadSchemas` entries. | `mail-sync.ts` and `background-jobs.ts` changed. |
| Demo stack and mobile | The demo stack seeds a mock Carta, cap table and contacts, and calls `carta/agent` and `contacts/save`; slices 2 and 3 update the seed. Mobile now has Inbox and Artifacts screens, still none for this work. | `testkit/src/cli/demo/seed.ts`; `apps/mobile/app`. |
| Locale catalogs | Slice preface: run `intl:extract` after copy changes. | Catalogs are checked in. |
| Unchanged | better-auth 1.7.7 and no magic-link plugin, `hiddenPages` TEXT[] and its migration, request-body-limit and no-store coverage, `isTrustedOrigin`, `drive_read` 100k cap and `truncated`, `FINANCE_READ_TOOLS` without SAFE tools, `ensureCartaAgent`/`startCartaSync`/`onMcpServerConnected`, `CAP_TABLE_FOLDER`, the Data room content route, `ComposeSend`, `FinanceTransaction`. | Re-read at 128599932. |

Founder decisions from the rebase (2026-10-21), now decisions 12 to 15 above. Taken as
defaults without a question: Board and Prospect appear in the shared Contacts UI; a kind
change to one the Investors page does not list ends portal access; the narrow header keeps
`PageHeader`.

### Decomposition review

Step 6 of the feature-request process: an Astra review of the epic decomposition (14
findings and a shared-file ownership table), each checked against the source before any
change. Line numbers are the lines opened in this worktree.

| Id | Finding | Verdict | Change made, or reason |
|---|---|---|---|
| 1 | New agent tools have no registration owner | Accepted | `builtin-tools.ts:156` (`builtinAgentTools`), `packages/contracts/src/builtin-tools.ts:68` (`BUILTIN_TOOL_NAMES`) and `executor.ts:7322`/`:4659` (gate and dispatch) are the real registration points. Slices 5, 7 and 8 now each register their tool in all four places and extend the Investors tool list as the tool becomes executable. The second half (a "this run read this file untruncated" check through the executor) is dropped by narrowing the guarantee (finding 9). |
| 2 | Job types and worker integration missing | Partly | Slice 7's `audit.intake` job now lists `types.ts:719` (`BackgroundJobPayloads`) and follows the `mail.attachments` precedent (`background-jobs.ts:43`, `background-job-handlers.ts:240`); its handler needs only deps both the API and the worker already pass, so neither composition changes. Slice 5's `investor.send` job is cut: `inboxComposeSend` is API-owned (`inbox-compose.ts:414`), so the send loop runs in the API process, detached, with state in Postgres; a stale `sending` update shows as Partly sent with Retry. |
| 3 | `DrivePicker` is an import dialog | Accepted | `ImportFromDrive.tsx:35-45` returns a message and a changed flag and `:122` calls `dataRoom.importDrive`. Slice 4 owns the file and adds a single-sheet mode that returns `{ id, name }` without importing, with the import path tested unchanged. |
| 4 | Source-switch rules contradict; stale writes unprotected | Accepted | `contact-tools.ts:81` and `cap-table.ts:24` write unconditionally. `source` is now a column and every write names its expected source (one conditional update), so a late Carta or sheet write is refused whoever calls it. The switch takes effect at once and keeps the data (with one-step Undo from `previous`, see finding 14), which removes the "switch only after first read" contradiction; Undo changes `source` back, so a late result from the undone source is refused. Tests added for a Carta write after a switch, a late sheet result after switching back, and a failed first read. |
| 5 | No agent contract for history or editing a draft | Accepted | `investor_update_draft` is one tool with `history`, `get`, `save` and `create`; it refuses a sent or posted update. No new tool family. |
| 6 | Linked-contact deletion has no owner | Accepted | `ContactDialog.tsx:263` deletes at once and `use-contact-notices.ts:59` restores five fields. Slice 6 adds `contacts.linked` and the confirmation in the shared dialog (so the Contacts page asks too, no Undo for a linked delete); slices 7, 8 and 9 extend the check. |
| 7 | Share UI reaches only ten documents | Accepted | `FolderDocuments.tsx:19` (`LIMIT = 10`) and its only consumer is `CapTable.tsx`. Share moves to the Data room's `ItemMenu.tsx` and `ItemDialogs.tsx`, which cover every document; `FolderDocuments` is unchanged. |
| 8 | Prerequisites hide missing dependencies | Accepted | Prerequisites are recomputed and the merge rule is stated once (tests pass on the listed prerequisites only; number order is merge order). Slice 2 is Investors-only (Fundraising's Ask and first-open creation move to 8); the Sheet button moves to 4; `updates.post` and revoked-recipient tests move to 6; `ActionItems` is created in 5 and slice 7 depends on 5; the full round lifecycle (Edit, Close, Reopen) is in 8; slice 10 owns the RPCs for Refresh, Assign, Unassign, Waiting and Not sent. Slice 8 uses its own `fundraising-tools.ts`, so it no longer depends on 5. |
| 9 | Guarantees without checkable contracts or tests at the wrong layer | Accepted | (a) The "never partial" read is narrowed: Rakazo enforces source, file id and a non-empty table; the agent is told to stop on `truncated` (`drive-tools.ts:328-337` returns only that flag). (b) `contact-tools.ts:96-100` finds the contact by the submitted email and writes the same email, so `contacts_save` cannot change an email: email-change tests use the `contacts.save` RPC and the plan no longer says an agent can change an email. (c) The redirect is asserted in `App.test.tsx` and the e2e spec, not in `Investors.test.tsx` (`CapTable.test.tsx:1014` mounts the page alone). (d) Footer and toast text moved to component tests; token-free request lines to the API and e2e tests; proxy logs stated as untestable. |
| 10 | Audit arrival, dedupe and history gaps | Accepted | The intake job now creates the row on arrival (`mailThreadId` unique), so a failed or missing drafting run leaves a visible New row with Draft reply, which also creates the agent. The ten-per-day cap counts `draftStartedAt` under an advisory lock and request eleven waits with Draft reply. A new message in a known thread sets "New mail" instead of being silently dropped. Show done stays reachable while any done row exists. Cross-thread duplicates are accepted as a limit (the founder dismisses one). |
| 11 | SAFE restoration and round counting underspecified | Accepted | Automatic reversal of the investor flip is cut (the founder edits the kind). Unassigned or round-less Mercury SAFEs are listed but in no round bar; a SAFE counts in a round only through its contact's `roundId`. "Creates no `Safe` row" now reads "creates no native SAFE; a synced row is a read-only cache". |
| 12 | Verification commands incomplete | Accepted | `carta-migration.postgres.test.ts:6` skips without `VERIFY_DATABASE`, and `*.postgres.test.ts` files are all run by `pnpm test:integration` (`harness.ts` discovers them); `playwright.config.ts:29` starts only Vite. Every slice now uses `pnpm test:integration` for Postgres suites and `pnpm test:e2e --spec=e2e/<name>.spec.ts` for e2e. Slice 1 adds `IntegrationsHome.test.tsx:189`, `McpDetail.test.tsx:140` and `carta-agent.spec.ts:38`; slice 3 migrates `router.test.ts` and `CapTable.stories.tsx`, which reference `carta.capTable` and `carta.refresh`. |
| 13 | Hand tests assume the wrong demo state | Accepted | `seed.ts:160-174` connects two Gmail accounts (sending is emulated) and `:207-217` connects Mercury and Brex; `data.ts:1125-1135` has no SAFE tool; no Drive is seeded. Each slice's hand test now starts from that state and says to disconnect an integration where it needs the empty state. Slice 10 adds canned invented `getSafeRequests` rows to the demo. Slice 9's hand test disconnects Mercury first. |
| 14 | Scope beyond the six stories | Partly | Cut: per-row `rev`, stale-row recovery and navigation blocking (whole-table save with an `updatedAt` check instead). The review also proposed cutting source-switch history and Undo; the founder kept one-step Undo (decision 16, `previous` column, slice 3); portal notice retries, the multi-contact copy-link fallback and the "Notifies <n>" footer; board and auditor portal access (investor contacts only, decision 2); `Contact.lastContactAt`; `InvestorUpdate.reviewedAt` (the draft stays an action item until sent or deleted); automatic investor-flip reversal. Kept: Post to portal itself (founder confirmed, decision 17), Mercury deposit matching (decision 3 says "deposits"), `portalLastSeenAt` and "Opened" dates (decision 5 accepts them). |
| Shared files | Overlapping ownership | Accepted | The Slices intro lists every file edited by more than one slice and which slices, merged in slice order by the lead, and the children say the same. Files that no longer overlap: the job files (7 only), `ImportFromDrive.tsx` (4), `ItemMenu.tsx`/`ItemDialogs.tsx` (6), `fundraising-tools.ts` split from `investor-tools.ts`. `notify-user.ts` and `use-sidebar-glance.ts` stay with slice 1 for the rename and slice 2 adds the Investors spawn key (`notify-user.ts:16-18` defaults to `thread`). |

Founder answers to this review are decisions 16 to 19: one-step Undo kept, Post to portal kept,
the draft stays an action item until sent or deleted, a Mercury SAFE not attached to a prospect in a round counts in no round bar, a signed SAFE's investor flip is never reversed automatically, and one audit in two threads shows as two rows.
