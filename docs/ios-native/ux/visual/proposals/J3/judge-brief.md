# Judge brief J3: Mail draft card editing model

Product: Praci, a planned native SwiftUI iPhone app. The agent ("Inbox agent") posts a mail draft card in the chat thread: To, Subject, body, buttons. Persona: founder, wants to add Jordan Lee on Cc and change a time, then send, in the fewest taps. Current card: "Needs approval", footer Save and Send (Send prominent). Nothing says how to edit; PG-A-Compose is a send-new-mail screen (X, up-arrow send). Rules: glass only on floating nav; one tinted prominent action per view; every visible word is UI so minimize copy; native iOS controls first.

Open questions: how the card is edited; what happens to the old card when the agent replaces it; "Save" vs "Save draft"; whether Compose X and card Save write the same draft.

Proposals:
A: composer is the only editor (type "Add Jordan on Cc"); rename Save to Save draft; old card shows "Replaced"; Compose X offers Save/Discard; no edit sheet.
B: tap card body opens the Compose layout as a prefilled sheet titled Edit draft with Done; card keeps Save draft and Send; edits happen in place.
C: Apple Mail pattern: draft is autosaved so Save is removed; footer Edit + Send; Edit or body tap opens the same sheet with Done; X with changes asks Discard/Keep editing; old card collapses to "Replaced"; Compose X Save draft writes the same draft.

Score each of A, B, C 1-5 on: (1) meets acceptance [x3] (edit entry, Replaced state, Save meaning, same draft, Cc suggestions and error states), (2) simplicity [x2], (3) consistency [x2], (4) usability [x2], (5) visual quality [x2], (6) effort and risk, 5 = small and safe [x1]. Return a winner, an optional graft, and a short defense.
