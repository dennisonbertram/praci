import { INTEGRATION_PRESETS } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { connectedAppAgentInstructions, instructions } from "./integration-agent.js";
import {
  INTEGRATION_PRESET_HISTORY,
  INTEGRATION_TEMPLATE_HISTORY,
  isPastIntegrationDefault,
} from "./integration-agent-history.js";

const first = INTEGRATION_TEMPLATE_HISTORY[0] as string;
const boxTemplate = INTEGRATION_TEMPLATE_HISTORY.find((t) =>
  t.includes("Allow changes in {service}"),
) as string;

describe("integration agent default history", () => {
  it("the first shipped Mercury text (696 characters) is a past default", () => {
    const stored = `${first.replaceAll("{service}", "Mercury")} ${INTEGRATION_PRESET_HISTORY.mercury?.[0]}`;
    expect(stored).toHaveLength(696);
    expect(isPastIntegrationDefault(stored, "Mercury", ["mercury"])).toBe(true);
  });

  it("a Box text with the extra sentence is a past default", () => {
    const stored = `${boxTemplate.replaceAll("{service}", "Box")} ${INTEGRATION_PRESET_HISTORY.box?.[0]}`;
    expect(stored).toContain('turn on "Allow changes in Box"');
    expect(isPastIntegrationDefault(stored, "Box", ["box"])).toBe(true);
  });

  it("an edited text is not a past default", () => {
    const stored = `${first.replaceAll("{service}", "Mercury")} ${INTEGRATION_PRESET_HISTORY.mercury?.[0]}`;
    expect(
      isPastIntegrationDefault(stored.replace("account", "accounts"), "Mercury", ["mercury"]),
    ).toBe(false);
    expect(isPastIntegrationDefault(`${stored} Be brief.`, "Mercury", ["mercury"])).toBe(false);
  });

  it("the current text is not recorded as past", () => {
    for (const [service, key, ro] of [
      ["Mercury", "mercury", false],
      ["Devin", "devin", true],
      ["Box", "box", false],
    ] as const) {
      const current = instructions(service, INTEGRATION_PRESETS[key].instructions, ro);
      expect(INTEGRATION_TEMPLATE_HISTORY).toContain(instructions("{service}", "", ro));
      expect(isPastIntegrationDefault(current, service, [key])).toBe(true);
    }
  });

  it("a Brex agent that also took the cards guidance upgrades with both presets", () => {
    const old = `${first.replaceAll("{service}", "Brex")} ${INTEGRATION_PRESET_HISTORY.brex?.[0]} ${INTEGRATION_PRESET_HISTORY.brexCards?.[0]}`;
    expect(isPastIntegrationDefault(old, "Brex", ["brex", "brexCards"])).toBe(true);
    expect(isPastIntegrationDefault(old, "Brex", ["brex"])).toBe(false);
  });

  it("connected-app and read-only defaults match the builder", () => {
    const app = connectedAppAgentInstructions({
      connectorId: "x",
      displayName: "Acme",
      provider: "acme",
    });
    expect(app).toBe(instructions("Acme"));
    expect(isPastIntegrationDefault(app, "Acme")).toBe(true);
    const devin = instructions("Devin", INTEGRATION_PRESETS.devin.instructions, true);
    expect(INTEGRATION_TEMPLATE_HISTORY).toContain(instructions("{service}", "", true));
    expect(isPastIntegrationDefault(devin, "Devin", ["devin"])).toBe(true);
  });

  // Guard: fails when the template or a preset changes without the old text being kept in the history.
  it("the current template and every current preset are recorded in the history", () => {
    expect(INTEGRATION_TEMPLATE_HISTORY).toContain(instructions("{service}", "", false));
    expect(INTEGRATION_TEMPLATE_HISTORY).toContain(instructions("{service}", "", true));
    for (const [key, preset] of Object.entries(INTEGRATION_PRESETS))
      expect(INTEGRATION_PRESET_HISTORY[key], key).toContain(preset.instructions);
  });
});
