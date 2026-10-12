import type { MailProvider } from "@rakazo/adapter-kit";
import type { Actor, InboxListOutput } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";

export interface InboxDeps {
  prisma: PrismaClient;
  mail: MailProvider;
}

export async function inboxList(
  _deps: InboxDeps,
  _actor: Actor,
  _input: { connectionId?: string },
): Promise<InboxListOutput> {
  throw new Error("not implemented");
}

export async function inboxRefresh(
  _deps: InboxDeps,
  _actor: Actor,
  _input: { connectionId?: string },
  _signal?: AbortSignal,
): Promise<{ ok: true }> {
  throw new Error("not implemented");
}

export async function inboxGet(
  _deps: InboxDeps,
  _actor: Actor,
  _input: { messageId: string },
  _signal?: AbortSignal,
): Promise<{
  from: string;
  to: string;
  date: string;
  subject: string;
  html: string | null;
  text: string | null;
}> {
  throw new Error("not implemented");
}

export async function inboxUnreadCount(
  _deps: InboxDeps,
  _actor: Actor,
): Promise<{ count: number }> {
  throw new Error("not implemented");
}
