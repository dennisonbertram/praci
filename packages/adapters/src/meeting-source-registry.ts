import { GRANOLA_API_CONNECTOR_ID } from "@rakazo/contracts";
import { createGranolaMeetingSource } from "./granola-meeting-source.js";
import type { MeetingSourceRegistry } from "./meeting-sync-job.js";

/**
 * The real providers, keyed by `Meeting.provider`. A new provider adds an entry here and a
 * `MeetingSource`, and no job. Tests and the demo stack pass `granolaBaseUrl` (the Granola API
 * emulator) or a whole registry through `createBackgroundJobHandlers({ meetingSources })`.
 */
export function createMeetingSourceRegistry(
  options: { granolaBaseUrl?: string; fetch?: typeof fetch } = {},
): MeetingSourceRegistry {
  return {
    granola: {
      connectorId: GRANOLA_API_CONNECTOR_ID,
      create: ({ apiKey }) => {
        if (!apiKey) throw new Error("Granola needs an API key");
        return createGranolaMeetingSource({
          apiKey,
          ...(options.granolaBaseUrl ? { baseUrl: options.granolaBaseUrl } : {}),
          ...(options.fetch ? { fetch: options.fetch } : {}),
        });
      },
    },
  };
}
