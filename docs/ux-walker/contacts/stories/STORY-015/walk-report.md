# STORY-015: Edit an agent-saved contact

Session walk-b, 1280x800 plus one 390x844 check. Screenshots in `screenshots/`.

## Screens
Asked Chief to save 'Ada Examp (WalkB)'; the list row gives no sign of the agent; search 'Q3 investor' finds it by notes and puts ?q= in the URL (reloading with that URL restores it); dialog shows the Notes text and 'Added by Chief'; name fixed and a line appended; Save closes and the list shows the new name; reopening shows both note lines and 'Added by Chief'. A seeded agent-saved contact (read only) also showed 'Added by Chief'. The app has no new-chat control, so I used the shared Chief thread (one message).

Geometry audit: no horizontal overflow on any state. Flagged items were the sidebar rows and the dialog form padding (16px), neither visible as a defect.

## Result
pass. Phone dialog shows Added by Chief, Save above Cancel, Delete below.

## Flow Log
Actual 5 steps (ideal 5). Hesitation: none after opening; list gives no agent cue (by design).
