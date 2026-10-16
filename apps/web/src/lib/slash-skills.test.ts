import type { AgentSkillCatalogEntry } from "@rakazo/contracts";
import { expect, it } from "vitest";
import { slashSkillOptions } from "./slash-skills";

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
