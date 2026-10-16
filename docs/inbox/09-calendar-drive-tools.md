# Calendar and Drive agent tools

## Calendar

When the user has a connected native Google Calendar connection (connector `google`, provider `googlecalendar`) in the run's space, and the run is the bot owner's direct-thread run, the agent also gets `calendar_list_events` and `calendar_get_event` (read-only) and `calendar_create_event`, `calendar_update_event` and `calendar_delete_event`. The three writes are in `APPROVAL_REQUIRED_BUILTIN_TOOLS`, so each call is approved like `mail_send`.

The handlers are in `packages/adapters/src/calendar-tools.ts` and call Calendar v3 through `GoogleApiClient`. `account` is matched against the connection's display name (the Google email). `calendar_create_event` derives the Google event id from the executor's effect key, so a replayed create gets a 409 and returns `alreadyCreated` instead of a second event. A create that fails after sending (timeout, dropped connection) returns an "outcome is unclear" error and is not retried. `sendUpdates` defaults to `none`. `packages/adapters/src/calendar-api-emulator.ts` is the offline fake.

## Drive

Agents get four built-in tools when the bot owner has a connected native Google Drive connection (connector `google`, provider `googledrive`) in the run's space. Like the mail tools, they are offered only in the owner's direct threads.

- `drive_search` (read): finds files by name or content. Trashed files are excluded. Shared drives are included.
- `drive_read` (read): returns text for Google Docs, Sheets (first sheet, CSV), Slides and text files, truncated to 100,000 characters (`truncated: true`). Other types return metadata and a note.
- `drive_create_file` (write): creates a Google Doc or a text file. Two calls: create the metadata, then upload the text. A failed create is never retried; the error tells the user to check Drive.
- `drive_update_file` (write): replaces the whole text content and/or renames. Binary files are refused.

The write tools need approval, the same way `mail_draft`, `mail_modify` and `mail_send` do. There is no delete tool. With several Drive accounts, `account` is the connection name.

Raw text uploads need `ConnectorProxyRequest.contentType`: a string body with a contentType is sent as is; otherwise the body is JSON as before. `DriveApiEmulator` is the offline fake for tests.
