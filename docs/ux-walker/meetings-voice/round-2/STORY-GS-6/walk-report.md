# STORY-GS-6: The agent is removed and recreated (round 2)

**Result: SKIPPED**

Outdated or changed by the plan: No surface: the plan says the key card renders 'Create agent' when the agent is missing (granola.md Surfaces, Connected key card), but the mockup draws only the agent-present card.

## Flow Log

Skipped. Plan check: repair path and idempotency are defined (Agent provisioning cases). Recorded as mockup gap F2-GS-6-01 (state undrawn, medium).

## Round-1 findings

None for this story.

## New findings (round 2)

- **F2-GS-6-01** (medium, mockup): The 'agent removed' state of the connected key card ('Create agent' in place of the 'Granola agent' link) is defined by the plan and not drawn. Fix: Add a 'No agent' state to screen 2.
