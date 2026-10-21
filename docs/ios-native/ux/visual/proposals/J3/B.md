# J3 (round 3, cluster C7) proposal B: restructure

Idea: treat a run like a conversation queue and remove what is not needed yet.
- Typing during a run: queue with an explicit Send. When text is typed during a run the capsule shows a tinted Send arrow in the trailing slot and Stop moves out to a 44pt solid circle left of the capsule. Tapping Send adds the bubble with the caption "Queued" and a Cancel link; it goes to the agent after the run ends. New frames: "Running, text typed" (Send + Stop), "Queued". DS-06 Stop rule is rewritten. Needs a backend queue (ordering, cancel, retry), which no board or contract states.
- Reactions: remove. PH-Thread drops the emoji row, the chip and the "React" item; the menu is Reply and Copy; STORY-042 is marked not planned; DS-06 says "Reactions are not planned".
- Archive: return to Home with a bottom solid Undo toast in all four boards. In addition remove "Clear chat" (and its confirmation frames) so the menu is Archive and Delete only; toast reads "<Name> archived" with no second line.
Cost: new Queued frames, DS-06 rewrite, three confirmation frames deleted, a backend queue feature; removes a feature the contract already supports (threads.react).
