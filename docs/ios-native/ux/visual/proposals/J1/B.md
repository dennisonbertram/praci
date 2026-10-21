# J1 proposal B (round 2): restructure, restore the first-send consent sheet

Remove consent from Connect and ask on the first send, the one frame the thread walker asked for (F-thread-007).

- PG-A-HomeNoModel: the Connect sheet footer is removed. After connecting the card says "Model A connected." with "Message Chief".
- PG-B-Consent: frame 1 is a new sheet "Share data with Model A?" with the line "Your messages and attachments are sent to Model A to run your agents.", prominent Allow, secondary Not now, Privacy details link. Frame 2 draws the thread after Not now: the typed message stays in the composer as a draft and a one-line strip above it reads "Sharing is off. Allow". Frame 3 is the speech sheet, frame 4 Settings.
- PG-A-ThreadStates: Not sent row "Sharing is off" with Allow.
- PH-Inbox: "Consent needed" frame stays; add the declined Inbox frame with a card and Allow.

Every new user now meets a second modal between "Message Chief" and the first reply. Consent is explicit and just in time, and it matches speech.
Risk: medium. It adds a gate that STORY-019 (flow audit) measured as extra taps, a second Duo layout for the sheet, and a first reply that waits on a prompt.
