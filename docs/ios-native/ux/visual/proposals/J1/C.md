# J1 proposal C (round 2): disclosure beside the action, permission placeholder in place of the feature

Pattern: the iOS permission placeholder. Camera, Photos and Maps do not show an error when access is off. They show the feature's own space with one sentence and one button that fixes it in place (Camera: "Camera access is off", button inside the viewfinder). Messages does the same for a failed send: the failed row itself is the repair control. Settings keeps the master switch.

- Consent stays where it is: Connect is consent, with the footer line naming Model A. No first-send sheet (keeps the STORY-019 saving). Speech and Memory ask the first time they are used.
- Sharing off becomes a drawn state with one pattern everywhere. A solid card (same shape as the no-model card) replaces the feature's entry point and holds one sentence, one prominent "Turn on" button, and a disclosure line "Sends messages and attachments to Model A." The button flips the switch in place, so allowing later takes one tap and the disclosure is next to it.
- Thread: typed text is kept, the composer stays visible but its Send is disabled, and the card sits above it. No Not sent bubble is created, because nothing was sent.
- Home: the card replaces the Chief CTA; Chief row subtitle "Sharing is off".
- Inbox after Not now: the existing "Changes to mail are off" card shape, "Inbox agent is off" with "Allow", mail listed unsorted.
- Speech after Not now: composer in typing mode, mic asks again on next tap. Privacy details is a 44 pt row. Settings shows the off state with "Agents are paused until Model A is on."

Allow-later path: one tap, in place, with disclosure. Risk: moderate, mostly new board frames; SwiftUI needs a Toggle bound to the consent record and a reusable card view.
