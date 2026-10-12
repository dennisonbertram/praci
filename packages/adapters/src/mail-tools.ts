import type {
  AdapterContext,
  ConnectorTool,
  JobPublisher,
  MailAccount,
  MailProvider,
} from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";

export const MAIL_TOOL_NAMES = new Set(["mail_search", "mail_grep", "mail_get"]);

export type MailToolDeps = {
  mail: MailProvider;
  prisma: PrismaClient;
  jobs: JobPublisher;
  accounts: () => Promise<MailAccount[]>;
  scope: { spaceId: string; userId: string; botId: string };
  deadlineMs?: number;
  now?: () => Date;
};

export function mailToolsAllowed(_options: {
  hasProvider: boolean;
  groupId: string | null;
  runUserId: string;
  botUserId: string;
  messagingChannelRun: boolean;
}): boolean {
  return true;
}

export function selectMailTools(tools: ConnectorTool[], _mailEnabled: boolean): ConnectorTool[] {
  return tools;
}

export async function mailToolFromTool(
  _name: string,
  _deps: MailToolDeps,
  _context: AdapterContext,
  _args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return { error: "not implemented" };
}

export async function deleteMailSearches(
  _prisma: PrismaClient,
  _scope: { spaceId: string; userId: string },
): Promise<number> {
  return 0;
}

export async function expireMailSearch(_prisma: PrismaClient, _searchId: string): Promise<void> {}
