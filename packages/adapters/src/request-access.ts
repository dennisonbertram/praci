import type { ConnectorTool } from "@rakazo/adapter-kit";
import type { AccessCapabilityId } from "@rakazo/core";
import { ACCESS_CAPABILITIES, accessCapability } from "@rakazo/core";

type Capability = (typeof ACCESS_CAPABILITIES)[number];

/** Effects of this run's request_access calls: what was granted, and every capability already asked. */
export function accessRunState(
  effects: readonly { status: string; request: unknown; result?: unknown }[],
) {
  const asked = new Set<string>();
  const granted = new Set<AccessCapabilityId>();
  /** Approved, but the agent's call has not been replayed yet: the tool stays offered to replay it. */
  const awaitingReplay = new Set<AccessCapabilityId>();
  for (const effect of effects) {
    const id = accessCapability(
      (effect.request as { capability?: unknown } | null)?.capability,
    )?.id;
    if (!id) continue;
    asked.add(id);
    // A completed effect is a grant only when the owner's allow ran the call. A denial answered
    // without a card also completes an effect, with an error result.
    const allowed =
      effect.status === "approved" ||
      effect.status === "executing" ||
      (effect.status === "completed" && (effect.result as { ok?: unknown } | null)?.ok === true);
    if (allowed) granted.add(id);
    if (effect.status === "approved") awaitingReplay.add(id);
  }
  return { asked, granted, awaitingReplay };
}

/**
 * The capabilities this run could ask for: some tool of it exists for this run when the owner's
 * switches are ignored (`baseline`), none is offered now (`offered`), the capability is one a
 * Firewall agent may hold when the agent is firewalled, and it was not asked about in this run.
 */
export function requestableCapabilities(input: {
  baseline: ReadonlySet<string>;
  offered: ReadonlySet<string>;
  firewalled: boolean;
  asked: ReadonlySet<string>;
}): Capability[] {
  return ACCESS_CAPABILITIES.filter(
    (capability) =>
      (!input.firewalled || capability.firewall) &&
      !input.asked.has(capability.id) &&
      capability.tools.some((tool) => input.baseline.has(tool)) &&
      !capability.tools.some((tool) => input.offered.has(tool)),
  );
}

/** The request_access tool for this run: the capability enum lists only what can be asked now. */
export function requestAccessToolFor<T extends ConnectorTool>(
  tool: T,
  capabilities: readonly Capability[],
): T {
  const schema = tool.inputSchema as { properties: Record<string, unknown> };
  return {
    ...tool,
    description: `${tool.description} You can ask for: ${capabilities
      .map((capability) => `${capability.id} (${capability.words})`)
      .join("; ")}.`,
    inputSchema: {
      ...schema,
      properties: {
        ...schema.properties,
        capability: {
          type: "string",
          enum: capabilities.map((capability) => capability.id),
          description: "The capability to ask for.",
        },
      },
    },
  };
}
