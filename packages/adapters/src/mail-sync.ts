import type { AdapterContext, MailAccount, MailProvider } from "@rakazo/adapter-kit";
import type { Prisma, PrismaClient } from "@rakazo/db";

export interface MailSyncDeps {
  prisma: PrismaClient;
  mail: MailProvider;
  /** Overrides the clock that decides the 14-day window. */
  now?: () => Date;
  /** Overrides the provider deadline, which defaults to 90 seconds. */
  deadlineMs?: number;
}

export type MailSyncOutcome = "synced" | "skipped" | "failed";

export async function syncMailbox(
  _deps: MailSyncDeps,
  _account: MailAccount,
  _context: AdapterContext,
): Promise<MailSyncOutcome> {
  throw new Error("not implemented");
}

export async function deleteMailConnectionData(
  _tx: Prisma.TransactionClient,
  _scope: { spaceId: string; userId: string; connectionId: string },
): Promise<void> {
  throw new Error("not implemented");
}
