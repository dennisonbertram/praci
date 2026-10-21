# Judge brief J1: first-run model connection and AI data consent

Product: Praci, native iPhone app (planned). Persona: a first-time founder opening the app with no model connected, on a standard iPhone or Duo outer display (466x678). Goal: get to the first reply from the Chief bot in the fewest taps, while giving real, explicit permission to send data to a third-party AI provider.
Problem: Connect sheet, then a second "Share data with Model A?" sheet on first send. After connecting, the card says "Create a bot" though Chief exists. Key field shows for every provider. Missing states: wrong key, no-model Home on iPhone, empty thread, not sent because no model.
Rules: glass only on floating nav; solid content; exactly one tinted prominent action per view; minimal copy (every word is UI); product name Praci.
Acceptance: one consent moment per provider, naming the provider; after-connect action messages Chief; field and label match the provider; failed-key, no-model Home (iPhone), empty-thread and no-model-not-sent states drawn; Privacy details link; consequence of turning Model off stated.

## A (minimal)
Keep both gates. Relabel button "Message Chief", label key field per provider, name provider in the second sheet, add Privacy details, add missing state panels. Second sheet remains on first send.
## B (restructure)
Full-screen setup page: provider, three AI data switches (Model, Speech, Memory), one "Connect and continue" button; dismisses to Chief thread. No later consent prompts.
## C (convention)
Connect is consent: one footer line under the Connect button names the provider and data and links Privacy details; second sheet removed. Speech and Memory ask just-in-time on first use. After connect: "Message Chief" button. Per-provider field, failed-key line, no-model Not sent with "Connect" action, empty thread with greeting and pills, "+" hidden until connected, Settings footer and confirm on turning Model off.

Return JSON: scores 1-5 for each of A, B, C on criteria (acceptance x3, simplicity x2, consistency x2, usability x2, visual x2, effort x1), a winner, an optional graft, and a defense.
