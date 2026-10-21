# Topic: agent-skills-and-memory

Code read: `apps/web/src/pages/shell/BotSkillsSection.tsx`, `components/teach/SkillDraftCard.tsx`, `pages/shell/transcript.tsx` (hover actions), `lib/use-remembered-messages.ts`, `lib/slash-skills.ts`, `pages/shell/composer.tsx`, `apps/api/src/agent-skills.ts`, `apps/api/src/remember-message.ts`, `packages/adapters/src/skill-tools.ts`, `packages/core/src/agent-skill.ts`.

Facts used throughout:
- Skills live in the bot settings panel (Settings of one agent), section heading "Skills". Rows show name, a one-line description, a source badge (Built-in, Plugin, Agent) and a switch labelled "Use {name}".
- "Add skill" menu: "New skill", "Upload SKILL.md", "From URL". A SKILL.md needs front matter with a non-empty `name` and `description` (name max 80 chars, description max 2000, file max 100,000 chars).
- An agent never activates its own skill. Its `skill_create` makes a draft; its `skill_update` on an active skill stores a pending revision and the old version stays in use. The owner sees both under "Drafts {count}" with Approve and Discard.
- "Remember" is a hover action on a bot message. It saves the message text to that agent's memory (plain text, capped at 2,000 characters).
- Names are matched case-insensitively and also against built-in skill names.

---

## STORY-APP-353: Write a first skill by hand and use it from the slash menu

**Type**: medium
**Topic**: agent-skills-and-memory
**Persona**: Maya, first-time founder of Northwind Robotics, chatting with her "Chief of Staff" agent
**Goal**: Teach the agent how Northwind writes its weekly investor note, then invoke it with `/`.
**Preconditions**: Signed in, one agent exists, no custom skills. Only built-in skills are listed.
**Ideal path**: 9 — open agent Settings, Add skill, New skill, type, Save, back to chat, `/`, pick, send.
**Alternate paths**: Upload SKILL.md (STORY-APP-354) or From URL (STORY-APP-355) create the same row. The agent can also draft one in chat (STORY-APP-357).

### Steps
1. In the chat with Chief of Staff, open the agent's settings (composer slash action "Chat settings", or the agent's settings panel) → The bot settings panel opens with a "Skills" heading and built-in rows such as the finance and Carta ones, each badged "Built-in".
2. Click "Add skill" at the right of the "Skills" heading → Menu shows "New skill", "Upload SKILL.md", "From URL".
3. Click "New skill" → The list is replaced by a "SKILL.md" text area showing a placeholder template (`name: my-skill`, `description: What this skill does...`). "Save" is disabled.
4. Type front matter `name: investor-note` and `description: Draft the weekly Northwind investor note from this week's email and metrics.` plus body steps → "Save" is still disabled until both `name:` and `description:` have text and the text differs from the template.
5. Click "Save" → Editor closes, list reloads, "investor-note" appears with its description and a switch that is on.
6. Close settings, click the composer, type `/` → The picker "Skills and actions" lists "Skills" with the built-ins and "investor-note".
7. Type `inv` → List narrows to "investor-note". Press Enter or click it → A chip for the skill appears in the composer (removable with "Remove skill ...").
8. Add "Focus on hiring and the 40% pilot growth." and send → The agent runs with the skill forced.

Maya is thinking: "Do I need to know YAML?" She hesitates at step 4 because the placeholder disappears as soon as she types and she does not know whether `---` lines are required. UNVERIFIED: whether the Save button accepts a body typed with no closing `---` (the client checks only for `name:`/`description:` lines; the server rejects missing front matter with "SKILL.md must start with YAML frontmatter (--- ... ---).").

### Variations
- Maya clicks "Cancel" at step 4 → editor closes, nothing is saved, the typed text is lost.
- Same skill is visible to every agent, but each agent has its own switch (STORY-APP-359).

### Edge Cases
- Saving a name that matches an existing or built-in skill (any letter case) → inline error "A skill with that name already exists".
- Description over 2000 characters or name over 80 → server message "Skill name must be at most 80 characters." appears in red under the heading.
- Network failure on Save → "Could not save skill"; text stays in the editor so she can retry.

---

## STORY-APP-354: Upload a SKILL.md file

**Type**: short
**Topic**: agent-skills-and-memory
**Persona**: Solo technical founder who keeps skills in a repo
**Goal**: Add a skill from a local `SKILL.md` file.
**Preconditions**: A valid `SKILL.md` on disk with `name: pr-triage` and a description.
**Ideal path**: 3 — Add skill, Upload SKILL.md, choose file.
**Alternate paths**: "New skill" and paste; "From URL".

### Steps
1. Open agent Settings → "Skills" section.
2. Click "Add skill" → "Upload SKILL.md" → The file picker opens, limited to `.md` / markdown.
3. Choose the file → The skill is created immediately with no editor step; "pr-triage" appears in the list with its switch on.

### Variations
- Wrong file type (for example `.txt`) → the picker's filter hides it. UNVERIFIED: drag-and-drop is not offered.

### Edge Cases
- File with no front matter → red error "SKILL.md must start with YAML frontmatter (--- ... ---)." and nothing is saved.
- Same file uploaded twice → second upload shows "A skill with that name already exists".
- Choosing the same file again after an error works, because the file input is cleared after each pick.

---

## STORY-APP-355: Import a skill from a GitHub link

**Type**: short
**Topic**: agent-skills-and-memory
**Persona**: Maya, who found a SKILL.md for investor updates on GitHub
**Goal**: Add a skill by pasting a link.
**Preconditions**: Public `https://github.com/example-org/skills/blob/main/investor-update/SKILL.md` (invented).
**Ideal path**: 4 — Add skill, From URL, paste, Save.
**Alternate paths**: Download and Upload SKILL.md.

### Steps
1. "Skills" section → "Add skill" → "From URL" → The list is replaced by one field labelled "From URL" with the hint `https://`, plus "Save" and "Cancel".
2. Paste the GitHub `blob` link → "Save" becomes enabled once the field is not empty.
3. Click "Save" → The server rewrites the link to the raw file, fetches it (https only, port 443, max 100,000 bytes), and creates the skill with a `source-url` line in its front matter. The list shows the new row.
4. Click the new row → The editor shows the SKILL.md including the `source-url` line, so Maya can see where it came from.

Maya is thinking: "Is this safe to run?" She hesitates because the imported text goes live on save; there is no review step like the one for agent drafts. UNVERIFIED: whether any warning is shown for imported skills (none found in the component).

### Variations
- A raw link (`https://raw.githubusercontent.com/...`) works the same.

### Edge Cases
- `http://` link → "Use an https:// link to a SKILL.md."
- Link to a page that is not a SKILL.md → the front matter error is shown.
- Private or unreachable host, or oversized file → a fetch error message appears in red; the field stays open.
- Name clash → "A skill with that name already exists".

---

## STORY-APP-356: Edit, switch off and delete a skill

**Type**: medium
**Topic**: agent-skills-and-memory
**Persona**: Maya, tidying skills after a month of use
**Goal**: Fix the wording of one skill, pause another, remove a third.
**Preconditions**: Custom skills "investor-note", "board-prep" and "old-onboarding".
**Ideal path**: 10 — open row, edit, Save; flip a switch; open row, Delete, Confirm delete.
**Alternate paths**: The agent can propose edits (STORY-APP-358) or delete via its own `skill_delete` tool UNVERIFIED for approval (the code deletes a user skill directly, with no owner confirmation).

### Steps
1. Click the row "investor-note" → The editor opens with its full SKILL.md. The name and badges show above the text area.
2. Change a step → "Save" enables only when the text is non-empty and different from the saved text.
3. Click "Save" → Editor closes, list reloads.
4. Flip the "Use board-prep" switch off → The switch changes immediately. The skill remains listed but the agent and the `/` picker stop offering it.
5. Open "old-onboarding" → Editor shows "Save", "Cancel" and a red "Delete".
6. Click "Delete" → The button changes to "Confirm delete" with a red background. Nothing is deleted yet.
7. Click "Confirm delete" → The skill disappears from the list.

### Variations
- Built-in row: opening it shows the text read-only with only "Close"; there is no Save or Delete. Only the switch works.
- Plugin skills behave like built-ins.

### Edge Cases
- Switch fails to save → switch snaps back and "Could not save skill" appears.
- Opening a row fails → "Could not load skill".
- Rename to an existing name on Save → "A skill with that name already exists".
- Click "Cancel" or open another row after "Delete" was armed → the confirm state resets.

---

## STORY-APP-357: The agent drafts a skill in chat and Maya approves it

**Type**: long
**Topic**: agent-skills-and-memory
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Let the agent capture a repeatable process as a skill, check the text, and make it live.
**Preconditions**: Chief of Staff agent exists. Maya has just walked the agent through preparing a customer-pilot summary for `pilot@northwind-customer.example.test`.
**Ideal path**: 8 — ask in chat, open Settings, read the draft, Approve, verify the row.
**Alternate paths**: Write it herself (STORY-APP-353). The Drafts group appears in no other surface UNVERIFIED (no inbox or notification for drafts was found; the list reloads when a run ends).

### Steps
1. In chat type "Turn what we just did into a skill called pilot-summary." and send → The agent runs its skill tool. Its tool result says "Drafted; awaiting the owner's approval. It is not usable until they approve it."
2. The agent's reply says the draft is waiting → Nothing else in the chat changes. UNVERIFIED: no approval card appears in the thread for agent skill drafts.
3. Open agent Settings → "Skills" section now shows a "Drafts" heading with a count "1" above the normal list, because the run ending refreshed the list.
4. Read the expanded draft: name "pilot-summary", description, and the instructions in a scrollable box (front matter hidden) → Maya checks the steps match what she wanted.
5. She sees the draft is not in the regular list yet and the `/` picker does not offer it.
6. Click "Approve" → The draft moves to the normal list with an "Agent" badge, switch on. "Drafts" disappears when its count reaches zero.
7. Return to chat, type `/pil` → "pilot-summary" is offered.
8. Select it and send → The agent uses the approved skill.

Maya is thinking: "I can't edit the draft here." She hesitates at step 4 because the draft box is read-only text. She can Approve and then open the row to edit (STORY-APP-356), or Discard and ask the agent to redo it.

### Variations
- Maya clicks "Discard" → draft removed, nothing becomes active.
- Maya asks the agent to change a draft that is still unapproved → the draft text updates in place and the count stays 1.

### Edge Cases
- An active skill already uses the name → the agent's tool returns `A skill named "..." already exists.` and no draft is made.
- Name was taken after the draft was written (for example Maya created one with the same name) → "Approve" fails with "A skill with that name already exists" and the draft stays.
- Approve fails otherwise → "Could not approve skill"; Discard failure → "Could not discard skill".
- While the editor or URL field is open, the Drafts group is hidden until she closes it.

---

## STORY-APP-358: Approve a proposed revision to an active skill

**Type**: medium
**Topic**: agent-skills-and-memory
**Persona**: Solo technical founder, who relies on a live "release-notes" skill
**Goal**: Let the agent improve a working skill without it changing silently.
**Preconditions**: Active skill "release-notes". The founder asked the agent "tighten release-notes to cap each note at 3 bullets."
**Ideal path**: 5 — Settings, read "Update" draft, Approve.
**Alternate paths**: Edit the row by hand (STORY-APP-356).

### Steps
1. After the agent replies, the tool result reads "Revision proposed; the current version stays in use until the owner approves it." → The live skill keeps working.
2. Open agent Settings → "Drafts 1" shows "release-notes" with a small "Update" badge.
3. Read the proposed instructions → Compare against the row below by opening it separately. UNVERIFIED: there is no side-by-side diff; the draft box shows only the new body.
4. Click "Approve" → The revision replaces the live content. The "Update" draft disappears.
5. Click "Discard" instead (alternate) → the proposal is dropped and the active skill is unchanged.

### Variations
- The agent proposes a second revision before the first is approved → the pending text is replaced by the latest one (single pending slot per skill).

### Edge Cases
- Revision renames the skill to a name already used → Approve shows "A skill with that name already exists".
- Skill deleted before approval → UNVERIFIED how Approve behaves; server throws a not-found style isolation error.

---

## STORY-APP-359: Different agents, different skills (per-agent switch)

**Type**: medium
**Topic**: agent-skills-and-memory
**Persona**: Maya with two agents, "Chief of Staff" and "Finance Analyst"
**Goal**: Keep a sales-style skill away from the finance agent while sharing the skill library.
**Preconditions**: Custom skill "investor-note" exists. Both agents exist.
**Ideal path**: 4 — open Finance Analyst settings, flip "Use investor-note" off, check `/`.
**Alternate paths**: none found.

### Steps
1. Open Finance Analyst's settings → "Skills" lists the same skills as for Chief of Staff, all switches on by default.
2. Turn off "Use investor-note" → Switch flips at once.
3. Back in the Finance Analyst chat, type `/` → The picker refreshes when `/` is typed and no longer lists "investor-note".
4. Switch to Chief of Staff and type `/` → "investor-note" is still there.
5. Open Chief of Staff settings → Its switch is still on.

Same info appears on two surfaces: the Skills list in settings and the `/` picker. The picker hides two bundled skills ("Interrogate", "inbox-search") that settings still list, and shows friendly titles for bundled skills (for example "Cut costs" for `finance-cost-cutting`), so the same skill has different names on the two surfaces.

### Variations
- Drafts are per owner, not per agent. A draft appears in every agent's Skills settings.

### Edge Cases
- Switch fails → reverts, "Could not save skill".
- Group chats: UNVERIFIED which agent's switches apply.

---

## STORY-APP-360: Remember one good answer

**Type**: short
**Topic**: agent-skills-and-memory
**Persona**: Maya, after the agent wrote a clear explanation of Northwind's pilot pricing
**Goal**: Keep that answer in the agent's memory so it comes up later.
**Preconditions**: A bot message in a 1:1 agent chat. A memory provider is configured (affects the Memory scope control only).
**Ideal path**: 2 — hover the message, click Remember.
**Alternate paths**: "More" menu → "Remember".

### Steps
1. Hover the agent's message → Hover actions show React, Reply, a bookmark-plus icon labelled "Remember", and "More".
2. Click the bookmark icon → It changes to a filled bookmark labelled "Remembered" and becomes disabled. No toast or dialog.
3. (Check) Open "More" on the same message → The menu item reads "Remembered" and is disabled.
4. Reload the page, return to the thread → The message still shows "Remembered" (the list of remembered ids is fetched on load).

Maya is thinking: "Where did that go?" She hesitates because no screen lists what was remembered. UNVERIFIED: the code has a "Memory scope" control in settings but no list of remembered messages was found.

### Variations
- Her own messages and tool cards: no Remember action (only bot text messages that allow reactions).
- Group thread: the message is saved to the agent that wrote it.

### Edge Cases
- Save fails → icon reverts to "Remember" and the chat shows "Could not remember".
- Click twice quickly → one document per message, so no duplicate.
- Message over 2,000 characters → saved text is cut with an ellipsis. Markdown formatting is stripped.
- Message with no text (only a card) → nothing saved, yet the icon stays on "Remembered". UNVERIFIED how the client treats this.

---

## STORY-APP-361: Choose how an agent shares memory

**Type**: short
**Topic**: agent-skills-and-memory
**Persona**: The deployment owner on the desktop app, with a memory provider configured
**Goal**: Stop the Finance Analyst's remembered notes from mixing with other agents.
**Preconditions**: A memory provider is configured, otherwise the control is hidden.
**Ideal path**: 3 — open Finance Analyst settings, scroll to Memory scope, click "Isolated".
**Alternate paths**: none found.

### Steps
1. Open Finance Analyst settings, scroll below "Thinking" → "Memory scope" with three toggles: "Inherit default", "Isolated", "Shared".
2. Click "Isolated" → The toggle becomes pressed and the setting saves at once (no Save button).
3. Return to chat and use Remember on a message (STORY-APP-360) → That note belongs to this agent's memory scope.

### Variations
- With no memory provider, "Memory scope" does not appear at all, and no hint explains why.

### Edge Cases
- Save fails → UNVERIFIED how the control reports it (uses the shared auto-save in the panel).
- "Remember" works as an agent-scoped save regardless of this choice (`scope: bot`), so what "Shared" changes for remembered notes is UNVERIFIED.

---

## STORY-APP-362: Review a taught-skill draft card and add it to a routine

**Type**: medium
**Topic**: agent-skills-and-memory
**Persona**: Maya, who showed the agent how to export a monthly CSV from a bank website
**Goal**: Check the generated playbook, test it, save it, and schedule it.
**Preconditions**: A teaching session ended and a "Draft skill" card is in the thread. This is a different skill type (a "playbook" from computer teaching) than the SKILL.md skills above. The entry path is UNVERIFIED here; it is covered by the teach topic.
**Ideal path**: 5 — read card, edit, Save, Test, Add to routine.
**Alternate paths**: none found.

### Steps
1. In the thread, read the card titled "Draft skill" with the goal under it → Fields: "Name", "When to use", "Inputs", "Steps", "How to check", "What to return", "Approval boundaries", "Failure handling".
2. Edit "Approval boundaries" to "Never submit payments." → Text updates locally.
3. Click "Test" → The edits are saved to the draft and a test run starts. The thread refreshes.
4. Click "Save" → Button shows "Saving…", then "Saved". The skill is stored under the name in the Name field.
5. Click "Add to routine" → A routine form opens prefilled with the skill name and a prompt built from the playbook.

Maya is thinking: "Is this the same as Settings → Skills?" She hesitates because saved taught skills do not obviously appear in that list. UNVERIFIED: whether a taught skill shows in the "Skills" section (separate `skills` RPC from `agentSkills`).

### Variations
- Edit after "Saved" → button text stays "Saved"; UNVERIFIED whether a second Save is needed to store later edits.

### Edge Cases
- Any call fails → UNVERIFIED: the card has no error text; buttons just re-enable.
- Inputs and Steps are one item per line; a blank line becomes an empty item.

---

## STORY-APP-363: Full journey from a repeated chore to a trusted skill

**Type**: long
**Topic**: agent-skills-and-memory
**Persona**: Maya, first-time founder of Northwind Robotics, in her second month
**Goal**: Turn a weekly chore into a reusable, approved skill, remember a key answer, and run it with `/`.
**Preconditions**: Connected Gmail, Chief of Staff agent, a memory provider, no custom skills.
**Ideal path**: 22 — the whole flow below.
**Alternate paths**: Upload or URL import in place of the chat draft (stories 02, 03).

### Steps
1. In chat ask "Summarize this week's replies from investors at `lena@fund.example.test`." → Agent answers.
2. Hover the answer and click "Remember" → bookmark becomes "Remembered".
3. Ask "Make that into a skill named investor-replies." → Agent drafts; reply says it needs approval.
4. Type `/inv` in the composer → "investor-replies" is NOT offered yet (still a draft).
5. Open agent Settings → "Skills" → "Drafts 1" with "investor-replies".
6. Read the body; notice it names `lena@fund.example.test` directly → Maya wants it general.
7. Click "Discard" → Draft gone.
8. Back in chat: "Redo it without any person's name; use whoever replied this week." → New draft.
9. Settings → "Drafts 1" → read → "Approve".
10. Row "investor-replies" has an "Agent" badge, switch on.
11. Click the row → editor opens. Change the description to "Summarize investor replies since Monday." → "Save" enables.
12. Click "Save" → list reloads.
13. Close settings, type `/inv` → "investor-replies" appears.
14. Select it; chip appears; add "Include Northwind's pilot numbers." → send.
15. Agent runs the skill and replies.
16. Hover reply → "Remember".
17. Open Settings → turn "Use investor-replies" off to test removal from the picker.
18. Type `/inv` → not offered.
19. Turn it back on → offered again after typing `/`.

Maya is thinking: "I just want one place to see what the agent has learned." Skills are in settings; remembered messages have no list (see STORY-APP-360). Both are reachable only from the agent, not from a global page. UNVERIFIED: a global "memory" or "skills" page.

### Variations
- Approve first, then edit by hand instead of discard-and-redo.

### Edge Cases
- Maya forgets to approve → the skill never works; no badge or reminder outside Settings. UNVERIFIED: any indicator on the settings entry point.
- Run ends while Settings is open → the list reloads and the new draft appears without leaving the panel.

---

## STORY-APP-364: Settings loads slowly or fails

**Type**: short
**Topic**: agent-skills-and-memory
**Persona**: Solo technical founder on flaky hotel Wi-Fi
**Goal**: Understand and recover from a failed skills load.
**Preconditions**: Network drops while opening agent Settings.
**Ideal path**: 3 — see error, reconnect, reopen.
**Alternate paths**: none found.

### Steps
1. Open agent Settings → A grey placeholder bar shows under "Skills" while loading.
2. Request fails → red "Could not load" appears under the heading; the "Add skill" button is still shown.
3. Close and reopen Settings after reconnecting → List and any "Drafts" appear. UNVERIFIED: no retry button exists in the section.

### Variations
- Failure after a write (for example after Approve) → "Could not load" shows even though the write succeeded; the list is stale until reload.

### Edge Cases
- Quick switch between agents → older responses are ignored, so the list never shows another agent's switch states.
- Opening a row while a save is running does nothing (rows are disabled while busy).
