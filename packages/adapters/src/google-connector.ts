// Stub so the red-phase tests fail on behavior. Replaced by the real connector in the next commit.
import type {
  AdapterContext,
  ConnectorCall,
  ConnectorCatalogItem,
  ConnectorEvent,
  ConnectorProxyRequest,
  ConnectorProxyResponse,
  ConnectorTool,
  SecretStore,
} from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";

export interface GoogleConnectorConfig {
  clientId: string;
  clientSecret: string;
  identitySecret: string;
  redirectUri?: string;
  prisma: Pick<PrismaClient, "connection" | "secret">;
  secrets: SecretStore;
  fetch?: typeof fetch;
  now?: () => number;
}

const todo = (): never => {
  throw new Error("not implemented");
};

export class GoogleConnector {
  constructor(readonly config: GoogleConnectorConfig) {}
  describe() {
    return {
      id: "google",
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: { discover: false, oauth: true, secretsBrokered: true },
    };
  }
  async catalog(_context: AdapterContext, _query?: string): Promise<ConnectorCatalogItem[]> {
    return todo();
  }
  async discoverTools(_context: AdapterContext): Promise<ConnectorTool[]> {
    return todo();
  }
  async listConnectedExternalIds(_context: AdapterContext): Promise<string[]> {
    return todo();
  }
  async connectionReady(_context: AdapterContext, _externalId: string): Promise<boolean> {
    return todo();
  }
  async begin(
    _request: { provider: string; redirectUrl: string },
    _context: AdapterContext,
  ): Promise<{ authorizationUrl: string | null; state: string }> {
    return todo();
  }
  async complete(
    _request: { state: string; code?: string },
    _context: AdapterContext,
  ): Promise<{ connectionRef: string; secretId?: string }> {
    return todo();
  }
  async revoke(_connectionRef: string, _context: AdapterContext): Promise<void> {
    return todo();
  }
  async proxy(
    _request: ConnectorProxyRequest,
    _context: AdapterContext,
  ): Promise<ConnectorProxyResponse> {
    return todo();
  }
  async *execute(_call: ConnectorCall, _context: AdapterContext): AsyncIterable<ConnectorEvent> {
    todo();
  }
}
