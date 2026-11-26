import { MeetingSourceError } from "@rakazo/adapter-kit";
import {
  GRANOLA_API_CONNECTOR_ID,
  isWisprFlowEndpoint,
  OMI_CLOUD_CONNECTOR_ID,
} from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createGranolaMeetingSource } from "./granola-meeting-source.js";
import type { McpConnector } from "./mcp-connector.js";
import type { MeetingSourceRegistry } from "./meeting-sync-job.js";
import { createOmiCloudMeetingSource } from "./omi-cloud-meeting-source.js";
import { createWisprFlowMeetingSource } from "./wispr-flow-meeting-source.js";

/** A failed MCP call as the source error the sync job understands. */
function mcpSourceError(error: unknown): MeetingSourceError {
  if ((error as { expected?: unknown } | null)?.expected === "reconnect")
    return new MeetingSourceError("auth", "Wispr Flow needs to be signed in again");
  if (error instanceof Error && /HTTP 429/.test(error.message))
    return new MeetingSourceError("rate_limit", "Wispr Flow rate limit");
  return new MeetingSourceError("unavailable", "Wispr Flow is unavailable");
}

/**
 * The real providers, keyed by `Meeting.provider`. A new provider adds an entry here and a
 * `MeetingSource`, and no job. Tests and the demo stack pass `granolaBaseUrl` (the Granola API
 * emulator) or a whole registry through `createBackgroundJobHandlers({ meetingSources })`.
 */
export function createMeetingSourceRegistry(
  options: {
    granolaBaseUrl?: string;
    omiCloudBaseUrl?: string;
    fetch?: typeof fetch;
    /** The user's MCP servers; without it there is no Wispr Flow source and its syncs do nothing. */
    mcp?: { prisma: PrismaClient; connector: Pick<McpConnector, "callServerTool"> };
  } = {},
): MeetingSourceRegistry {
  const { mcp } = options;
  return {
    ...(mcp
      ? {
          wisprflow: {
            create: ({ spaceId, userId, mcpServerId }, signal) => {
              if (!mcpServerId) throw new Error("Wispr Flow needs an MCP server");
              return createWisprFlowMeetingSource({
                call: async (tool, args) => {
                  // Read at each call: a server the user removed or turned off stops the sync.
                  const server = await mcp.prisma.mcpServer.findFirst({
                    where: { id: mcpServerId, spaceId, userId, enabled: true },
                  });
                  if (!server || !isWisprFlowEndpoint(server.endpoint))
                    throw new MeetingSourceError("auth", "Wispr Flow is not connected");
                  try {
                    return await mcp.connector.callServerTool(
                      server,
                      {
                        operationId: `meetings-sync:${mcpServerId}`,
                        traceId: `meetings-sync:${mcpServerId}`,
                        spaceId,
                        userId,
                        signal,
                      },
                      tool,
                      args,
                    );
                  } catch (error) {
                    throw mcpSourceError(error);
                  }
                },
              });
            },
          },
        }
      : {}),
    granola: {
      connectorId: GRANOLA_API_CONNECTOR_ID,
      create: ({ apiKey }, signal) => {
        const base = options.fetch ?? fetch;
        if (!apiKey) throw new Error("Granola needs an API key");
        return createGranolaMeetingSource({
          apiKey,
          ...(options.granolaBaseUrl ? { baseUrl: options.granolaBaseUrl } : {}),
          // Every request ends when the run's deadline passes.
          fetch: (input, init) =>
            base(input, {
              ...init,
              signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal,
            }),
        });
      },
    },
    omi_cloud: {
      connectorId: OMI_CLOUD_CONNECTOR_ID,
      // The pendant import (provider "omi") may hold the same conversation; the first copy wins.
      skipIfRecordedBy: ["omi"],
      // Assumed from Omi's docs (not confirmed): a list call with transcripts costs one of 25
      // transcript reads an hour. Two such calls every 6 minutes is 20 an hour.
      chainDelayMs: 6 * 60_000,
      create: ({ apiKey }, signal) => {
        const base = options.fetch ?? fetch;
        if (!apiKey) throw new Error("Omi needs an API key");
        return createOmiCloudMeetingSource({
          apiKey,
          maxTranscriptCalls: 2,
          ...(options.omiCloudBaseUrl ? { baseUrl: options.omiCloudBaseUrl } : {}),
          fetch: (input, init) =>
            base(input, {
              ...init,
              signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal,
            }),
        });
      },
    },
  };
}
