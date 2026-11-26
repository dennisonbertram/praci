# Judge brief: J3 (round 3, cluster C7) Chat: typing during a run, reactions, landing after archive

Context: Praci's planned native SwiftUI iPhone app (design boards only). Rules: glass only on floating controls, solid content, at most three glass groups, exactly one tinted prominent action per view. Persona: a founder who types a follow-up while the agent is still running, wants to thumbs-up an answer, and archives a chat.

Problem: (1) DS-06 says typed text stays a draft during a run, but a board shows "Sends after run". (2) DS-06 says React is deferred but PH-Thread draws an emoji row and a React menu item. (3) After Archive the user stays in the archived chat with a top toast over a still-live thread; Inbox toasts sit at the bottom.
Acceptance: running composer behavior drawn once and matching DS-06; Archive returns to the list with a bottom Undo toast; reaction rule identical in DS-06 and PH-Thread; at most three glass groups; toast, menu and Settings use one noun.

Proposals:
A: delete the "Sends after run" caption (draft kept, no new frame); keep reactions as drawn including the React menu item; Archive returns to Home with bottom toast, text unchanged.
B: queue with a Send control beside Stop and a "Queued" bubble (needs backend queue); remove reactions; Archive returns Home; remove Clear chat.
C: draft kept with Stop in the slot and a "Run finished, draft kept" frame (ChatGPT/Claude pattern); reactions shipped Messages-style (row is the picker, React menu item removed); Archive returns Home with bottom toast "<Name> archived" and Undo (Mail/Things pattern), menu says "Archive agent"/"Archive group".

Score each 1-5 on: meets criteria x3, simplicity x2, consistency x2, usability x2, visual quality x2, effort/risk x1 (5 = small and safe). Return a winner, optional graft, and a short defense.
