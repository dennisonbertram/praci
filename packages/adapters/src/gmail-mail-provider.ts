import type {
  MailAccount,
  MailAddress,
  MailListRequest,
  MailMessage,
  MailMessagePage,
  MailProvider,
  ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";

export type MailSleep = (ms: number, signal: AbortSignal) => Promise<void>;

export interface GmailMailProviderDeps {
  prisma?: Pick<PrismaClient, "connection">;
  connectors: { managed(id: string): ManagedConnectorProvider | undefined };
  sleep?: MailSleep;
  random?: () => number;
}

export function isMailConnection(_row: {
  status: string;
  providerRef: string | null;
  provider: string;
}): boolean {
  throw new Error("not implemented");
}

export function parseAddressList(_value: string): MailAddress[] {
  throw new Error("not implemented");
}

export class GmailMailProvider implements MailProvider {
  constructor(_deps: GmailMailProviderDeps) {}
  listAccounts(): Promise<MailAccount[]> {
    throw new Error("not implemented");
  }
  listMessages(
    _account: MailAccount,
    _request: MailListRequest,
    _context: unknown,
  ): Promise<MailMessagePage> {
    throw new Error("not implemented");
  }
  getMessage(_account: MailAccount, _id: string, _context: unknown): Promise<MailMessage> {
    throw new Error("not implemented");
  }
}

export function createMailProvider(
  deps: GmailMailProviderDeps & { prisma: Pick<PrismaClient, "connection"> },
): MailProvider {
  return new GmailMailProvider(deps);
}
