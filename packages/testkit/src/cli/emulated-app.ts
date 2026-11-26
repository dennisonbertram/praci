import type { ManagedConnectorProvider, TransactionalEmail } from "@rakazo/adapter-kit";
import type {
  CalendarApiEmulator,
  EmulatedMcpServer,
  FinanceSyncDeps,
  MeetingSourceRegistry,
} from "@rakazo/adapters";
import { EmailEmulator, PipedreamConnector, ThirdPartyConnectorEmulator } from "@rakazo/adapters";
import { createApp } from "../../../../apps/api/src/app.ts";
import { createE2eComposio } from "./e2e-mail.js";

/** A "google" connector whose only working call is `proxy`, answered by the Calendar emulator. */
function calendarConnector(calendar: CalendarApiEmulator): ManagedConnectorProvider {
  const unavailable = async () => {
    throw new Error("Not available in the demo");
  };
  return {
    describe: () => ({
      id: "google",
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: { discover: false, oauth: true, secretsBrokered: true },
    }),
    discoverTools: async () => [],
    execute: unavailable as never,
    catalog: async () => [],
    listConnectedExternalIds: async () => [],
    connectionReady: async () => false,
    begin: unavailable,
    complete: unavailable,
    revoke: unavailable,
    proxy: async (request) => calendar.handle(request),
  };
}

/**
 * The API wired to every offline emulator: connected apps, the Pipedream directory, transactional
 * email and a Gmail mailbox. The e2e harness and the demo stack both start the app through here.
 */
export async function createEmulatedApp(
  databaseUrl: string,
  options: {
    composio?: ReturnType<typeof createE2eComposio>;
    financeCallToolFor?: FinanceSyncDeps["callToolFor"];
    /** Extra emulated MCP servers by hostname, such as the demo's mock Carta. */
    mcpServers?: Record<string, EmulatedMcpServer>;
    cryptoFetch?: typeof fetch;
    /** Meeting providers; the demo points Granola at its emulator. */
    meetingSources?: MeetingSourceRegistry;
    /** Where the Brex cards server reaches Brex; the demo points it at its emulator. */
    brexApi?: { baseUrl: string };
    /** Offline Google Calendar: the app's "google" connector answers from this emulator. */
    calendar?: CalendarApiEmulator;
    /** Called with each transactional email (reset links, verification) the app sends. */
    onEmail?: (message: TransactionalEmail) => void;
  } = {},
) {
  const thirdParties = new ThirdPartyConnectorEmulator(options.mcpServers);
  const pipedream = new PipedreamConnector(
    {
      clientId: "fake-client-id",
      clientSecret: "fake-client-secret",
      projectId: "fake-project-id",
      environment: "development",
      identitySecret: process.env.ENCRYPTION_KEY as string,
    },
    { fetch: thirdParties.fetch, resolveHostname: thirdParties.resolveHostname },
  );
  const email = new EmailEmulator(options.onEmail);
  const composio = options.composio ?? createE2eComposio();
  const handles = await createApp({
    databaseUrl,
    prisma: undefined,
    composio,
    pipedream,
    email,
    ...(options.financeCallToolFor ? { financeCallToolFor: options.financeCallToolFor } : {}),
    ...(options.cryptoFetch ? { cryptoFetch: options.cryptoFetch } : {}),
    ...(options.meetingSources ? { meetingSources: options.meetingSources } : {}),
    ...(options.brexApi ? { brexApi: options.brexApi } : {}),
    ...(options.calendar ? { google: calendarConnector(options.calendar) } : {}),
    remoteConnectors: {
      fetch: thirdParties.fetch,
      resolveHostname: thirdParties.resolveHostname,
    },
    integrationsCatalogUrl: "https://catalog.example.test/",
  });
  return { handles, email, composio };
}
