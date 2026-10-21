import { describe, expect, it } from "vitest";
import { BOX_MCP_ENDPOINT, BOX_READ_TOOLS, BOX_WRITE_TOOLS } from "./box.js";
import {
  CARTA_MCP_ENDPOINT,
  CARTA_READ_TOOLS,
  CARTA_WRITE_TOOLS,
  cartaAgentSpawnKey,
} from "./carta.js";
import { DEVIN_MCP_ENDPOINT, DEVIN_READ_TOOLS, DEVIN_WRITE_TOOLS } from "./devin.js";
import { FINANCE_READ_TOOLS } from "./finance.js";
import {
  GRANOLA_BLOCKED_TOOLS,
  GRANOLA_MCP_ENDPOINT,
  GRANOLA_READ_TOOLS,
  granolaAgentSpawnKey,
} from "./granola.js";
import {
  INTEGRATION_PRESETS,
  integrationAgentSpawnKey,
  integrationAgentSpawnKeyForServer,
  integrationPresetForEndpoint,
  isIntegrationAgentForServer,
  isIntegrationAgentSpawnKey,
  isReadTool,
} from "./integration-agent.js";
import { WISPR_FLOW_MCP_ENDPOINT } from "./wispr-flow.js";

const mercury = INTEGRATION_PRESETS.mercury;
const brex = INTEGRATION_PRESETS.brex;

describe("Zernio preset data", () => {
  it("has a closed read-only list and leaves linking to S3a", () => {
    const preset = INTEGRATION_PRESETS.zernio;
    expect(preset.allowedTools).toEqual(preset.reads);
    expect(preset.allowedTools).toHaveLength(9);
    expect(preset.forcedWrites).toEqual([]);
    expect(preset).not.toHaveProperty("requiresAgent");
    expect(preset.allowedTools).not.toContain("posts_create");
    expect(preset.allowedTools).not.toContain("gtm_post");
  });
});

describe("isReadTool", () => {
  it("reads on readOnlyHint true", () => {
    expect(isReadTool({ name: "anything", annotations: { readOnlyHint: true } })).toBe(true);
  });
  it("reads when the preset lists the tool", () => {
    expect(isReadTool({ name: "getAccounts" }, mercury)).toBe(true);
    expect(isReadTool({ name: "getAccount" }, mercury)).toBe(true);
    expect(isReadTool({ name: "list_cards" }, brex)).toBe(true);
  });
  it("forced writes win over annotations and read lists", () => {
    expect(
      isReadTool({ name: "requestSendMoney", annotations: { readOnlyHint: true } }, mercury),
    ).toBe(false);
    expect(isReadTool({ name: "lock_card", annotations: { readOnlyHint: true } }, brex)).toBe(
      false,
    );
    expect(isReadTool({ name: "start_expense_download" }, brex)).toBe(false);
    expect(isReadTool({ name: "verify_shipping_address" }, brex)).toBe(false);
  });
  it("treats unknown and unannotated tools as writes", () => {
    expect(isReadTool({ name: "mystery" })).toBe(false);
    expect(isReadTool({ name: "mystery", annotations: { readOnlyHint: false } }, mercury)).toBe(
      false,
    );
    expect(isReadTool({ name: "requestSendMoney" }, mercury)).toBe(false);
    expect(isReadTool({ name: "lock_card" }, brex)).toBe(false);
  });
  it("keeps every Finance read tool a read", () => {
    for (const provider of ["mercury", "brex"] as const)
      for (const name of FINANCE_READ_TOOLS[provider])
        expect(isReadTool({ name }, INTEGRATION_PRESETS[provider])).toBe(true);
  });
  it("matches presets by endpoint host", () => {
    expect(integrationPresetForEndpoint("https://mcp.mercury.com/mcp")?.service).toBe("Mercury");
    expect(integrationPresetForEndpoint(CARTA_MCP_ENDPOINT)).toBe(INTEGRATION_PRESETS.carta);
    expect(integrationPresetForEndpoint("https://example.test/mcp")).toBeUndefined();
  });
  it("builds and recognizes the spawn key", () => {
    expect(isIntegrationAgentSpawnKey(integrationAgentSpawnKey("s1"))).toBe(true);
    expect(isIntegrationAgentSpawnKey("carta-agent:u1")).toBe(false);
  });
});

describe("Carta integration-agent preset", () => {
  const carta = INTEGRATION_PRESETS.carta;

  it("uses only the shared Carta read and write tool sets", () => {
    expect(carta.reads).toEqual(CARTA_READ_TOOLS);
    expect(carta.forcedWrites).toEqual(CARTA_WRITE_TOOLS);
    expect(carta.allowedTools).toEqual([...CARTA_READ_TOOLS, ...CARTA_WRITE_TOOLS]);
    expect(carta.requiresAgent).toBe(true);
  });

  it("does not let unexpected annotations expand the preset", () => {
    expect(
      isReadTool({ name: "unknownAnnotatedRead", annotations: { readOnlyHint: true } }, carta),
    ).toBe(false);
    expect(isReadTool({ name: "unknownWrite", annotations: { readOnlyHint: false } }, carta)).toBe(
      false,
    );
    expect(
      isReadTool({ name: CARTA_WRITE_TOOLS[0], annotations: { readOnlyHint: true } }, carta),
    ).toBe(false);
    for (const name of CARTA_READ_TOOLS) expect(isReadTool({ name }, carta)).toBe(true);
  });

  it("selects the specialized Carta identity and requires the exact live linked bot", () => {
    const server = {
      id: "server-1",
      spaceId: "space-1",
      userId: "user-1",
      endpoint: CARTA_MCP_ENDPOINT,
      agentBotId: "bot-1",
    };
    const bot = {
      id: "bot-1",
      spaceId: "space-1",
      userId: "user-1",
      spawnKey: cartaAgentSpawnKey("user-1"),
      archivedAt: null,
    };
    expect(integrationAgentSpawnKeyForServer(server)).toBe(cartaAgentSpawnKey("user-1"));
    expect(isIntegrationAgentForServer(server, bot)).toBe(true);
    expect(isIntegrationAgentForServer({ ...server, agentBotId: null }, bot)).toBe(false);
    expect(isIntegrationAgentForServer(server, { ...bot, id: "stranded-bot" })).toBe(false);
    expect(isIntegrationAgentForServer(server, { ...bot, userId: "user-2" })).toBe(false);
    expect(isIntegrationAgentForServer(server, { ...bot, spaceId: "space-2" })).toBe(false);
    expect(isIntegrationAgentForServer(server, { ...bot, archivedAt: new Date() })).toBe(false);
    expect(
      isIntegrationAgentForServer(server, { ...bot, archivedAt: undefined as unknown as null }),
    ).toBe(false);
    expect(
      isIntegrationAgentForServer(server, {
        ...bot,
        spawnKey: integrationAgentSpawnKey("server-1"),
      }),
    ).toBe(false);
    expect(
      integrationAgentSpawnKeyForServer({
        ...server,
        endpoint: "https://mcp.example.test/mcp",
      }),
    ).toBe(integrationAgentSpawnKey("server-1"));
  });
});

describe("preset instructions", () => {
  it("say what each service is and keep writes as requests", () => {
    expect(mercury.instructions).toContain("Mercury is");
    expect(mercury.instructions).toContain("hold it for its own approval");
    expect(mercury.instructions).toContain("TBD");
    expect(brex.instructions).toContain("Brex is");
    expect(brex.instructions).toContain("TBD");
  });
});

describe("Devin integration-agent preset", () => {
  const devin = INTEGRATION_PRESETS.devin;

  it("treats every listed read as a read and every listed write as a write", () => {
    for (const name of DEVIN_READ_TOOLS) expect(isReadTool({ name }, devin)).toBe(true);
    for (const name of DEVIN_WRITE_TOOLS) {
      expect(isReadTool({ name }, devin)).toBe(false);
      expect(isReadTool({ name, annotations: { readOnlyHint: true } }, devin)).toBe(false);
    }
  });

  it("requires its agent, so no ordinary bot can reach a Devin write", () => {
    expect(devin.requiresAgent).toBe(true);
  });

  it("hides tools Devin adds later, even annotated reads", () => {
    expect(devin.allowedTools).toEqual([...DEVIN_READ_TOOLS]);
    expect(isReadTool({ name: "devin_new", annotations: { readOnlyHint: true } }, devin)).toBe(
      false,
    );
  });

  it("matches by https host, so path variants match and other hosts do not", () => {
    for (const endpoint of [
      DEVIN_MCP_ENDPOINT,
      `${DEVIN_MCP_ENDPOINT}/`,
      "https://mcp.devin.ai/sse",
    ])
      expect(integrationPresetForEndpoint(endpoint)).toBe(devin);
    for (const endpoint of ["http://mcp.devin.ai/mcp", "https://api.devin.ai/mcp", "nonsense"])
      expect(integrationPresetForEndpoint(endpoint)).toBeUndefined();
  });
});

describe("Box integration-agent preset", () => {
  const box = INTEGRATION_PRESETS.box;

  it("treats every listed read as a read and every listed write as a write", () => {
    for (const name of BOX_READ_TOOLS) expect(isReadTool({ name }, box)).toBe(true);
    for (const name of BOX_WRITE_TOOLS) {
      expect(isReadTool({ name }, box)).toBe(false);
      expect(isReadTool({ name, annotations: { readOnlyHint: true } }, box)).toBe(false);
    }
  });

  it("gates every Enhanced Extract Agent tool as a write", () => {
    for (const name of [
      "ai_extract_structured",
      "ai_extract_structured_from_fields_enhanced",
      "ai_extract_structured_from_metadata_template_enhanced",
    ])
      expect(isReadTool({ name }, box)).toBe(false);
  });

  it("lists no tool as both a read and a write", () => {
    const reads = new Set<string>(BOX_READ_TOOLS);
    expect(BOX_WRITE_TOOLS.filter((name) => reads.has(name))).toEqual([]);
  });

  it("hides tools Box adds later, even annotated reads", () => {
    expect(isReadTool({ name: "box_new", annotations: { readOnlyHint: true } }, box)).toBe(false);
  });

  it("matches by https host and does not require an agent before sign-in", () => {
    expect(integrationPresetForEndpoint(BOX_MCP_ENDPOINT)).toBe(box);
    expect(integrationPresetForEndpoint(`${BOX_MCP_ENDPOINT}/`)).toBe(box);
    expect(integrationPresetForEndpoint("http://mcp.box.com")).toBeUndefined();
    expect(integrationPresetForEndpoint("https://api.box.com/mcp")).toBeUndefined();
    expect("requiresAgent" in box).toBe(false);
  });
});

describe("Granola integration-agent preset", () => {
  const granola = INTEGRATION_PRESETS.granola;

  it("reads its read tools and blocks switch_workspace and sign_out, even if annotated read-only", () => {
    for (const name of GRANOLA_READ_TOOLS) expect(isReadTool({ name }, granola)).toBe(true);
    for (const name of GRANOLA_BLOCKED_TOOLS) {
      expect(granola.allowedTools).not.toContain(name);
      expect(isReadTool({ name, annotations: { readOnlyHint: true } }, granola)).toBe(false);
    }
  });

  it("matches only Granola's endpoint", () => {
    expect(integrationPresetForEndpoint(GRANOLA_MCP_ENDPOINT)).toBe(granola);
    expect(integrationPresetForEndpoint("http://mcp.granola.ai/mcp")).toBeUndefined();
  });
});

describe("Wispr Flow integration-agent preset", () => {
  const wispr = INTEGRATION_PRESETS.wisprflow;

  it("treats read-verb names and read-only hints as reads, everything else as a write", () => {
    expect(isReadTool({ name: "get_meeting_summary" }, wispr)).toBe(true);
    expect(isReadTool({ name: "list_tasks" }, wispr)).toBe(true);
    expect(isReadTool({ name: "anything", annotations: { readOnlyHint: true } }, wispr)).toBe(true);
    expect(isReadTool({ name: "create_task" }, wispr)).toBe(false);
  });

  it("matches only its endpoint", () => {
    expect(integrationPresetForEndpoint(WISPR_FLOW_MCP_ENDPOINT)).toBe(wispr);
    expect(integrationPresetForEndpoint(`${WISPR_FLOW_MCP_ENDPOINT}/`)).toBe(wispr);
    expect(integrationPresetForEndpoint("https://api.wisprflow.ai/other")).toBeUndefined();
  });
});

describe("the one Granola agent", () => {
  const server = {
    id: "srv",
    spaceId: "sp",
    userId: "u1",
    endpoint: GRANOLA_MCP_ENDPOINT,
    agentBotId: "b1",
  };
  const bot = (spawnKey: string, userId = "u1") => ({
    id: "b1",
    spaceId: "sp",
    userId,
    spawnKey,
    archivedAt: null,
  });
  it("serves a Granola server whether its spawn key is the user's or the server's", () => {
    expect(isIntegrationAgentForServer(server, bot(granolaAgentSpawnKey("u1")))).toBe(true);
    expect(isIntegrationAgentForServer(server, bot(integrationAgentSpawnKey("srv")))).toBe(true);
  });
  it("does not accept another user's Granola agent or any other server's", () => {
    expect(isIntegrationAgentForServer(server, bot(granolaAgentSpawnKey("u2"), "u1"))).toBe(false);
    const other = { ...server, endpoint: "https://api.brex.com/mcp" };
    expect(isIntegrationAgentForServer(other, bot(granolaAgentSpawnKey("u1")))).toBe(false);
  });
});
