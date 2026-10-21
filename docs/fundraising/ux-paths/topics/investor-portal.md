# Topic: Investor portal (both sides)

> **Superseded after the Astra plan review (see README, Review record):** the dead-link page shows only "This link no longer works." There is no email field, no "Email me a link" and no link-sent page; the founder sends a new link with Resend or Copy link. The landing page shows only an Open button (no company name). Stories below that use the request form or the company name before sign-in no longer apply.

Round 4. Updated against the plan after round 3 ("Portal", "Portal security", decisions 2 and 5, slice 6) and the mockup views `#portal`, `#portal-empty`, `#portal-email`, `#portal-open`, `#link-dead`, `#link-sent`, `#inv-contactmenu`, `#inv-unblock`, `#inv-share`, `#inv-copylink`. Model: every send, Resend or copied link mints a new token for that contact, carried in the URL fragment (`/portal/open#<token>`); each token expires 90 days after it was issued and a contact can hold several. The landing page reads the fragment and only the POST from its Open button starts a session: a `PortalSession` row whose random token is the cookie value (30 days from creation). Revoke, a block and an email change delete all of the contact's tokens and sessions; Unblock restores nothing. The portal shows every sent or posted investors update to every investor contact with portal access (there are no per-update shares) and only the documents shared with that contact; board updates are never shown. Link emails from the instance provider have the subject "<Company> · your link". Planned feature; all names and figures are invented. Gap tags: `PG-nn` round-1 gap still open; `NG-nn` gap from round 2, 3 or 4 that is still open (see `../catalog.md`, "Plan gaps (round 4)").

## STORY-301: Founder resends a portal link from a contact
**Type**: short
**Topic**: Investor portal
**Persona**: Maya Chen, founder of Example Robotics, desktop web
**Goal**: Give Priya Raman a fresh link after she lost the email
**Preconditions**: Investors, Contacts card, Investors tab. Priya is an investor contact with an email; her Portal cell reads "Invited Oct 2".
**Ideal path**: 2 (row menu, Resend link)
**Alternate paths**: The next update Send also mints and emails a new link.
### Steps
1. Read the Portal column → "—" (never sent a link), "Invited <date>" (the latest send or resend), "Opened <date>" (last Open), "Revoked", or after Unblock "Unblocked · send a link". Send, Resend and a Post to portal notice all move "Invited".
2. Open the row's "…" menu on Priya (`#inv-contactmenu`) → Resend link, Revoke, Edit, Delete. Resend link is offered for any investor contact with an email.
3. Click Resend link → a new token is minted and emailed from the instance's email provider, subject "Example Robotics · your link" (not from the founder's Gmail); older tokens keep working until each expires; the cell reads "Invited Oct 20".
### Variations
- Marcus Webb (no email): the menu has no Resend link; Copy link mints one he can be given by hand.
- A new investor added after the last update: Resend link works for her, and once she opens it she sees every earlier sent update (resolved in round 3).
- Elena Ruiz shows "Opened Oct 4": the founder knows she used the portal, not what she read (PG-45, accepted).
### Edge Cases
- A contact with no email: Resend link has nothing to send to, so the item is absent.
- A board or auditor contact who holds a link from a document share: Resend link is offered for them too (round-4 plan).

## STORY-302: Share a Data room document with chosen investors
**Type**: medium
**Topic**: Investor portal
**Persona**: Maya Chen
**Goal**: Share "Seed SPA, signed" with Sam and Priya as well as the two who already have it
**Preconditions**: The document is in Finance / Cap Table, listed in Documents on Investors; its "Shared with" cell reads "Elena Ruiz, Tom Okafor".
**Ideal path**: 4 (row menu, Share, tick two contacts, Share)
**Alternate paths**: The same Share action on the document in the Data room.
### Steps
1. Open the "…" on "Seed SPA, signed" in Documents → Share (and the existing file actions).
2. Click Share → the dialog "Share · Seed SPA, signed" (`#inv-share`) lists the contacts: those who already have the file (Elena, Tom) show Unshare, the others (Sam, Priya) a checkbox; "Email them a link" is ticked; buttons Cancel and Share. There is no second confirm for a sensitive file, because the dialog names the file and the people.
3. Tick Sam Lind and Priya Raman, press Share → one `InvestorShare` row per chosen contact; each newly ticked contact gets a new link by email from the instance's email provider, subject "Example Robotics · your link", even one who already holds a link, so they learn that a document exists.
4. Read the row → "Shared with" lists the four names.
### Variations
- Remove one person's access: open the dialog and press Unshare beside the name.
- A sensitive file such as "409A valuation report" looks the same in the list as the SPA; the dialog is the only check.
### Edge Cases
- The founder deletes the Data room item: the shares cascade and the investors' portal loses it on the next request.

## STORY-303: Send mints a personal link per recipient
**Type**: medium
**Topic**: Investor portal
**Persona**: Maya Chen
**Goal**: Publish the October update to four investors by email and portal in one click
**Preconditions**: Draft open; Gmail connected; audience investors; four ticked recipients.
**Ideal path**: 1 (Send)
**Alternate paths**: Post to portal without Gmail (STORY-204).
### Steps
1. Click Send → the background job, for each recipient, mints a new token (only its sha256 hash is stored; the plain link goes into that one email), sets its expiry 90 days out and `portalLinkSentAt`, and sends one email "Example Robotics · October update" from Maya's Gmail with the update body and a single line "View online and past updates".
2. No share rows are created. The portal lists the update to every investor contact with portal access, whether or not they were ticked.
3. Return to Contacts → the Portal column reads "Invited Oct 20" for every recipient (the date of the latest send, so it moves on every send); "Opened <date>" shows once the contact opens a link.
### Variations
- Board audience: board emails are plain text with no link, and the update never reaches the portal (STORY-208).
### Edge Cases
- Send fails for one recipient → STORY-210.
- A revoked contact is not emailed and is refused by the portal (STORY-212).

## STORY-304: Investor receives the link, reads on a phone, downloads a document
**Type**: long
**Topic**: Investor portal
**Persona**: Tom Okafor, Harbor Angels, an angel with six portfolio companies, reading in a mail app with an in-app browser
**Goal**: Read the September update and download the signed SPA
**Preconditions**: Maya sent the September update three minutes ago; Tom is an investor contact with a link in that email and a share for "Seed SPA, signed".
**Ideal path**: 4 (tap the link, tap Open, read, tap Download); the Open tap is deliberate protection against link scanners.
**Alternate paths**: Opening the same email later on desktop works the same way.
### Steps
1. Open the email (`#portal-email`) → From Maya Chen, subject "Example Robotics · September update", the update body, and one line "View online and past updates".
2. Tap the link → `/portal/open#<token>` shows the landing page (`#portal-open`): the company name and an Open button. The page's script reads the fragment and asks a read-only preview call for the company name; a GET and the preview start no session, so a scanner or unfurler uses nothing up and never sees the token (fragments are not sent).
3. Tap Open → the POST creates a `PortalSession` row and sets the `rakazo_portal` cookie to its random token (HttpOnly, Secure, SameSite=Lax, Path=/api/portal, 30 days), records the open, removes the fragment, and the page goes to `/portal/home`.
4. Read home (`#portal`) → company name, the newest update in full (September update, Oct 2, with TL;DR, Numbers, Highlights, Lowlights, Asks), "Earlier updates" below, Documents, and a footer line with his email and Sign out. Controls are at least 44 px tall.
5. Tap "August update" under Earlier updates → it expands in place.
6. Tap Download on "Seed SPA, signed" (PDF · Feb 2026) → the file downloads with an attachment disposition.
### Variations
- Tom's mail app opens an in-app browser that does not share cookies with Safari: a later Safari visit lands on the dead-link page and he requests a link (STORY-305). If he asks within 10 minutes of the send, no second email goes out, but the page still says a link is on its way. [plan silent: the 10-minute limit counts from any send, so it can block the first request after an update (NG-40, accepted in round 3: the "on its way" answer is true)]
### Edge Cases
- There is no "new since your last visit" marker (out of scope).
- Download inside an in-app browser that cannot save PDFs.
- Maya now sees "Opened Oct 20" in Tom's row.

## STORY-305: Link no longer works, request a new one
**Type**: medium
**Topic**: Investor portal
**Persona**: Tom Okafor, on a phone, 35 days after he last tapped Open
**Goal**: Read the latest update without digging for an old email
**Preconditions**: Tom opened the portal once, bookmarked `/portal/home`, and never tapped Open again. His session lasts 30 days from creation and has ended; the link in his email is 35 days old and still valid (90 days).
**Ideal path**: 3 (open, request a link, tap the email)
**Alternate paths**: Tap the old email link and Open (works until day 90); open `/portal` directly.
### Steps
1. Open the bookmark `/portal/home` → no valid cookie, so the dead-link page shows (`#link-dead`): "This link no longer works.", a labeled "Email address" field, and a filled button "Email me a link". It names no company, because it does not know one.
2. Type tom@harbor.example and tap the button → the page shows "If this address has access, a link is on its way. Check spam." (`#link-sent`).
3. Open the email "Example Robotics · your link" from the instance's email provider → one link per company where he is a contact; tap the Example Robotics link → landing page, tap Open → home with the October update and every earlier one.
### Variations
- `/portal` directly: the same page without the sentence "This link no longer works."
- Tom types the wrong address: the same message appears and nothing arrives.
- Tom bookmarked home and reads every week: the session does not slide, so on day 31 he lands on the dead-link page although his email link still works. [plan silent: a fixed 30-day session and the wording "no longer works" for a lapsed session (NG-49)]
- The instance has no email provider: the form is not shown.
### Edge Cases
- A second request inside 10 minutes for the same contact sends no second email and still shows the same message.
- The email lands in spam, which is why the message says "Check spam."

## STORY-306: Dead link variants
**Type**: short
**Topic**: Investor portal
**Persona**: Tom Okafor, phone
**Goal**: Recover from an expired, revoked or unknown link
**Preconditions**: A link that is expired, revoked or typed wrong.
**Ideal path**: 2 (read the page, submit the email)
**Alternate paths**: none found
### Steps
1. Tap `/portal/open#<token>` → the landing page loads; when the preview call finds the token expired, revoked or unknown, it shows the same page for all three: "This link no longer works." with the email field.
2. Submit the address → "If this address has access, a link is on its way. Check spam."
3. For a revoked contact nothing arrives: the request form and the link both refuse a blocked contact. Tom cannot tell revocation from expiry.
### Variations
- Tom already has a valid cookie and taps a live older link: the landing page still shows and Open replaces the session with the same contact's.
### Edge Cases
- Pasted into a chat app that unfurls links: the unfurler only sends a GET, so nothing is consumed.

## STORY-307: Same email at two companies, and a forwarded link
**Type**: medium
**Topic**: Investor portal
**Persona**: Elena Ruiz, Northwind Ventures, a contact at Example Robotics and at Tidewater Labs, on a phone
**Goal**: Reach the right company's portal; separately, her colleague opens a forwarded email
**Preconditions**: elena@northwind.example is a contact in two spaces, each with shares.
**Ideal path**: 3 (request a link, pick the company's link in the email, Open)
**Alternate paths**: Tap the original update email from each founder.
### Steps
1. Submit elena@northwind.example on `/portal` (no company is named) → the standard acknowledgement.
2. Open the email → one link per contact, listing Example Robotics and Tidewater Labs.
3. Tap Example Robotics, then Open → home for Example Robotics.
4. Return to the email, tap the Tidewater link, then Open → the cookie is replaced; Tidewater's home shows. There is no switcher on home.
### Variations
- Forwarded email: Elena forwards the update to colleague Jonas, who taps the link and Open → he gets her full session until the link expires or Maya revokes it (accepted trade-off, decision 5). Maya sees only "Opened <date>" for Elena. [plan silent: nothing tells Elena or Maya that a second person used the link]
### Edge Cases
- `/portal/home` shared by URL alone gives the dead-link page, because the cookie is required.
- Switching between companies needs the email each time. [plan silent: no company switcher (PG-49)]

## STORY-308: Founder revokes access and changes a contact's email
**Type**: medium
**Topic**: Investor portal
**Persona**: Maya Chen
**Goal**: Cut off Sam Lind (Lakeside Capital) who sold his stake, then fix Priya Raman's mistyped email
**Preconditions**: Sam's Portal cell reads "Opened Oct 3"; Priya's email was entered as priya@raman.exmaple and her link went nowhere.
**Ideal path**: 2 (row menu, Revoke)
**Alternate paths**: Delete the contact (shares, tokens and sessions cascade; after a confirm).
### Steps
1. Open Sam Lind's "…" menu (`#inv-contactmenu`) → Resend link, Revoke, Edit, Delete (Revoke is offered for any contact with portal access).
2. Choose Revoke → there is no confirm (Unblock reverses it); all of Sam's tokens and `PortalSession` rows are deleted and `portalBlockedAt` is set at once.
3. Read the row → the Portal cell reads "Revoked" and the menu now offers Unblock, Edit, Delete (`#inv-unblock`).
4. Sam opens his email link or reloads home → the next request returns 401 and he sees "This link no longer works." The request form also refuses him.
5. Choose Edit on Priya and correct the email → her tokens and sessions are deleted because a different person may own the new address; the cell shows "—". Maya is not told her pending link was voided.
6. Choose Resend link on Priya → a new token goes to the corrected address and the cell reads "Invited Oct 20".
7. Later choose Unblock on Sam → the shares are still there but his old links and cookie stay dead; he needs a Resend link or the next update. The Portal cell reads "Unblocked · send a link" until a link goes out.
### Variations
- Revoke removes nothing: Maya can still see Sam in each document's "Shared with" column.
### Edge Cases
- Sam is mid-download: the stream finishes; the next request is refused.

## STORY-309: No email provider, founder copies the link
**Type**: short
**Topic**: Investor portal
**Persona**: Maya Chen, self-hosting with no email provider for the app; Gmail connected for updates
**Goal**: Get Tom a working link anyway
**Preconditions**: The instance has no `TransactionalEmailProvider`.
**Ideal path**: 3 (Resend link, copy, paste)
**Alternate paths**: Send the update from Gmail: its emails already carry each contact's link.
### Steps
1. Choose Resend link on Tom's row → the app has no provider, so a dialog shows the newly minted link once (`#inv-copylink`: "Link · Tom Okafor", "Shown once.", Close and Copy link).
2. Copy the link and send it to Tom in her own message. The link works for 90 days.
3. Close the dialog → the link cannot be shown again; Resend link mints another one.
### Variations
- Tom opens `/portal` on this instance: the request form is not shown, so there is nothing that promises an email.
### Edge Cases
- Pasted into a chat app that unfurls links: only a GET, and the token is in the fragment, so nothing is used.

## STORY-310: Portal security walk with a careless and a hostile investor
**Type**: long
**Topic**: Investor portal
**Persona**: Maya Chen as founder; Tom Okafor (careless: forwards), Jonas (forwardee), a mail scanner, and a stranger
**Goal**: Confirm that what leaks is limited to what the plan accepts
**Preconditions**: Tom holds a link and a share for the SPA; Elena (another contact) has a share for the 409A report only; a second company shares Tom's email.
**Ideal path**: 12 (a walk, not a goal)
**Alternate paths**: none found
### Steps
1. A mail scanner GETs Tom's link → the landing page is returned without the token (fragments are not sent); no cookie is set and "Opened" does not change.
2. Tom taps Open → a `PortalSession` row is created and its random token is the cookie; "Opened Oct 20" appears on his row.
3. Tom forwards the email; Jonas taps the link and Open → Jonas has a full session as Tom (accepted by decision 5); the founder still sees only "Opened".
4. Jonas requests a document id he was not given, such as the 409A report → the content route finds no share row for Tom's contact and refuses. Jonas can read every sent investors update, since Tom may.
5. Jonas opens the URL of another company's portal → the cookie belongs to the first company's contact; the second company's data is not reachable with it.
6. Maya chooses Revoke on Tom → his tokens and sessions are deleted, so the next request returns 401 for both Tom and Jonas, the dead-link page appears, and the request form sends nothing for Tom.
7. Tom's email at the second company is a different contact; that link keeps working.
8. Maya changes Tom's email on the contact → his tokens and sessions are deleted, so the forwarded link and any cookie are dead (resolved in round 3).
9. Maya deletes the Data room item "Seed SPA, signed" → the share cascades and the document disappears from the portal.
10. A stranger guesses `/portal/open#<random>` → the preview call finds no token and the page shows the dead-link wording; no information about who exists.
11. A stranger posts many addresses to the request form → every answer is identical; one email per contact per 10 minutes. Per-IP limiting is left to the proxy (plan open question).
12. Maya reads the proxy and access logs → the landing request is `/portal/open` with no token; the token is only in the fragment and the POST body. The earlier path-token finding (NG-16) is closed.
### Variations
- Tom keeps an old email after Maya sends a newer update: the old token still works until its own 90 days end (a contact can hold several live tokens).
### Edge Cases
- Deleting the contact (after a confirm) cascades its shares and tokens.

## STORY-311: Nothing shared yet, and Sign out
**Type**: short
**Topic**: Investor portal
**Persona**: Elena Ruiz
**Goal**: See an honest empty state and leave cleanly
**Preconditions**: Elena has a valid link, no investors update has been sent or posted yet, and no document is shared with her.
**Ideal path**: 3 (Open, read, Sign out)
**Alternate paths**: none found
### Steps
1. Tap her link, then Open → home (`#portal-empty`) shows the company name and "Nothing shared yet."
2. Read the footer → her email and Sign out.
3. Tap Sign out → the cookie is cleared; reloading `/portal/home` shows the dead-link page. The link still works until it expires.
### Variations
- Maya sends or posts an update later: the same session then shows it, because the portal lists every sent update to every investor contact with access.
### Edge Cases
- None beyond the above.

## Gaps found
Open after round 5. Resolved and no longer listed: NG-47 (Unblocked cell), NG-48 (Resend for any kind with shared documents), NG-31 (Resend for any investor contact with an email), NG-32 (PortalSession, deletion on revoke, block and email change), NG-36 (Share dialog emails newly ticked contacts).
- PG-45 (accepted skip): no per-contact view of what a contact can see; the Portal column and Documents "Shared with" column are the answer.
- PG-49: no company switcher.
- NG-40 (nice): the 10-minute link limit counts from any send, so it can block the first request after an update. Accepted in round 3 (the "on its way" answer is true); kept here as a note.
- NG-49 (new, nice): a fixed 30-day session and the dead-link wording for a regular reader.
