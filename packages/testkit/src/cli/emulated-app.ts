import type { EmulatedMcpServer, FinanceSyncDeps } from "@rakazo/adapters";
import { EmailEmulator, PipedreamConnector, ThirdPartyConnectorEmulator } from "@rakazo/adapters";
import { createApp } from "../../../../apps/api/src/app.ts";
import { createE2eComposio } from "./e2e-mail.js";

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
  const email = new EmailEmulator();
  const composio = options.composio ?? createE2eComposio();
  const handles = await createApp({
    databaseUrl,
    prisma: undefined,
    composio,
    pipedream,
    email,
    ...(options.financeCallToolFor ? { financeCallToolFor: options.financeCallToolFor } : {}),
    ...(options.cryptoFetch ? { cryptoFetch: options.cryptoFetch } : {}),
    remoteConnectors: {
      fetch: thirdParties.fetch,
      resolveHostname: thirdParties.resolveHostname,
    },
    integrationsCatalogUrl: "https://catalog.example.test/",
  });
  return { handles, email, composio };
}
