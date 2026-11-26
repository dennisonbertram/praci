# Calendar UX paths

**Current implementation checked**: 2026-11-26
**Routes**: `/app/calendar` and `/app/calendar?view=day|week|month|schedule`
**Storybook**: `apps/web/src/pages/Calendar.stories.tsx`

The Calendar page combines Google events and local items such as bot routines and tasks. The date range, view and active filters live in the URL. Selecting an event opens a local detail popover; the selected event is not encoded in a shared URL and is not restored after reload. On a phone, the default is Schedule; on a wider screen, it is Day. Week, Month and Schedule are available from the view selector. The filter menu supports item kind and bot. A Google join link is external and needs a separate provider-backed check.

## Walkable stories

### CAL-001: Switch views and move through dates

1. Open `/app/calendar` from the sidebar.
2. Change Day to Week, Month and Schedule, then move the visible date range forward and back.
3. Confirm the URL tracks the selected view, date range and filters, and that the current view stays usable at desktop, tablet and phone widths.
4. Copy or reload the URL. Confirm those view settings return, while any selected-event popover starts closed.

### CAL-002: Filter the calendar

1. Open the Calendar filter menu.
2. Filter by kind, then by bot.
3. Clear each filter and confirm the items return.

### CAL-003: Read a calendar item

1. Select an event, routine or task in the calendar.
2. Read the title, time and available attendee/source details.
3. Confirm the detail popover is local state: sharing or reloading the URL does not reopen it.
4. If a Join action appears, verify its destination without completing a real meeting join unless the provider is explicitly configured for the walk.

### CAL-004: Use Calendar on a phone

1. Open `/app/calendar` at phone width.
2. Confirm the default Schedule view shows dates, times and full item titles in a readable list.
3. Select Week and inspect overlapping timed items. All event blocks should remain reachable even when their titles need truncation.

## Walk limits

The 2026-11-26 demo walk covered Day, Week, Schedule, the filter menu, event detail, phone Schedule and phone Week. The phone Week view uses three day columns. Overlapping events remain separately rendered and tappable, but narrow overlap lanes can truncate titles; Schedule is readable for the same dates. No external Join action was activated. Google account connection, provider-generated events, event creation/editing and meeting joins were not verified against a real provider.
