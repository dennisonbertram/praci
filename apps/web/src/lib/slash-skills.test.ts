import { i18n } from "@lingui/core";
import type { AgentSkillCatalogEntry } from "@rakazo/contracts";
import { expect, it } from "vitest";
import { slashSkillLabel, slashSkillOptions } from "./slash-skills";

i18n.loadAndActivate({ locale: "en", messages: {} });

const skill = (name: string, source: AgentSkillCatalogEntry["source"]): AgentSkillCatalogEntry => ({
  id: name,
  name,
  description: `${name} description`,
  source,
  readOnly: source !== "user",
});

const bundled = Array.from({ length: 10 }, (_, i) => skill(`bundled-${i}`, "builtin"));

it("lists the person's own skills ahead of bundled ones even past the cap", () => {
  const result = slashSkillOptions([...bundled, skill("mine", "user")], "");
  expect(result).toHaveLength(8);
  expect(result[0]?.name).toBe("mine");
  expect(result.slice(1).map((s) => s.name)).toEqual(bundled.slice(0, 7).map((s) => s.name));
});

it("keeps each group in its original order", () => {
  const result = slashSkillOptions(
    [bundled[0]!, skill("a", "user"), bundled[1]!, skill("b", "user")],
    "",
  );
  expect(result.map((s) => s.name)).toEqual(["a", "b", "bundled-0", "bundled-1"]);
});

it("filters across all skills when typing", () => {
  const result = slashSkillOptions([...bundled, skill("mine", "user")], "bundled-9");
  expect(result.map((s) => s.name)).toEqual(["bundled-9"]);
});

it("hides developer and internal bundled skills from founders", () => {
  const result = slashSkillOptions(
    [
      skill("Interrogate", "builtin"),
      skill("inbox-search", "builtin"),
      skill("Interrogate", "user"),
    ],
    "",
  );
  expect(result.map((s) => [s.name, s.source])).toEqual([["Interrogate", "user"]]);
});

it("names bundled skills in plain words and finds them by that name", () => {
  const runway = skill("finance-runway-scenarios", "builtin");
  expect(slashSkillLabel(runway).title).toBe("Runway scenarios");
  expect(slashSkillOptions([runway, skill("other", "builtin")], "runway sc")).toEqual([runway]);
});

it("gives every bundled skill a plain title instead of its slug", () => {
  for (const name of ["devin-sessions", "meeting-notes", "box-files", "finance-categorize"]) {
    expect(slashSkillLabel(skill(name, "builtin")).title).not.toBe(name);
  }
});
