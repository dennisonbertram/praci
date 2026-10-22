import { devinSessionUrl } from "@rakazo/contracts";
import { expect, it } from "vitest";
import { BUILTIN_AGENT_SKILLS } from "./builtin-skills.js";

const skill = BUILTIN_AGENT_SKILLS.find((s) => s.name === "devin-sessions");

it("the Devin skill is read-only and links sessions with the page's session URL", () => {
  expect(skill?.description).toBe("Search and follow Devin sessions. Read-only.");
  const text = skill?.content ?? "";
  for (const banned of [
    "devin_session_create",
    "devin_session_interact",
    "_manage",
    "Allow changes",
    "approval card",
  ])
    expect(text).not.toContain(banned);
  for (const read of ["devin_session_search", "devin_session_events", "read_wiki_contents"])
    expect(text).toContain(read);
  expect(text).toContain(devinSessionUrl("SESSION_ID"));
});

const update = BUILTIN_AGENT_SKILLS.find((s) => s.name === "investor-update");

it("the investor-update skill reads past updates, takes an audience, saves a draft and never makes a Gmail draft or sends", () => {
  const text = update?.content ?? "";
  expect(BUILTIN_AGENT_SKILLS.some((s) => s.name === "carta-investor-update")).toBe(false);
  expect(text).toContain('investor_update_draft with action "history"');
  expect(text).toContain("audience");
  expect(text).toContain("mail_search");
  expect(text).toContain("notify_user");
  for (const banned of ["mail_draft", "mail_send", "Bcc", "Carta"])
    expect(text).not.toContain(banned);
});
