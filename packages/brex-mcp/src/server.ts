import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { BrexCardsControls, BrexMember } from "@rakazo/contracts";
import { BREX_CARDS_WRITE_ARGS, BREX_TOKEN_REJECTED } from "@rakazo/contracts";
import * as z from "zod";
import type {
  BrexCard,
  BrexClient,
  BrexExpense,
  BrexSpendLimit,
  BrexTransaction,
  Paged,
} from "./client.js";
import { BrexError } from "./client.js";
import {
  checkCreateCard,
  checkCreateSpendLimit,
  checkUpdateCard,
  checkUpdateSpendLimit,
} from "./controls.js";

export type ReservationStatus = "created" | "failed" | "uncertain";

/**
 * What the server needs from the host. The host owns durable state (the owner's controls and the
 * daily card reservations) and knows which approved effect is calling.
 */
export interface BrexCardsStore {
  /** Read on every write, so an owner change between approval and dispatch applies. */
  loadControls(): Promise<BrexCardsControls>;
  /**
   * Counts the Brex account's cards of the last 24 hours (reserved, created and uncertain count)
   * and, below the cap, inserts a `reserved` row. The server calls it before the Brex create.
   */
  reserveCard(input: {
    maxCardsPerDay: number;
  }): Promise<{ ok: true; reservationId: string } | { ok: false; reason: string }>;
  settleReservation(id: string, status: ReservationStatus, cardId?: string): Promise<void>;
  /**
   * Runs `fn` while holding a lock on `key` (`card:<id>` or `spend_limit:<id>`), across every
   * process. Writes that read a target and then send a full replacement (members, spend controls)
   * use it so two approved calls cannot overwrite each other.
   */
  withTargetLock<T>(key: string, fn: () => Promise<T>): Promise<T>;
  /** The caller's idempotency key, from the request's `_meta`; undefined when there is none. */
  idempotencyKey(meta?: Record<string, unknown>): string | undefined;
}

export interface BrexCardsServerOptions {
  client: BrexClient;
  store: BrexCardsStore;
  now?: () => Date;
}

/** A refusal the model should see; nothing was sent to Brex. */
class Refusal extends Error {}

const text = (value: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(value) }],
});
const failure = (message: string): CallToolResult => ({
  isError: true,
  content: [{ type: "text", text: message }],
});

function describeBrexError(error: BrexError, checkWith?: string): string {
  const base = {
    auth: `${BREX_TOKEN_REJECTED}: Brex rejected the token or its scope. Ask the owner to replace the Brex token.`,
    rate_limit: "Brex is rate limiting this account. Try again later.",
    client: `Brex refused the request (status ${error.status}).`,
    unavailable: "Brex is unavailable right now.",
    network: "Brex did not answer.",
    mapping: "Brex sent an answer this server could not read.",
    incomplete: "Brex paging did not finish.",
  }[error.kind];
  return error.definite || !checkWith
    ? base
    : `${base} The change may or may not have been applied: check with ${checkWith} before retrying.`;
}

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const nameOf = (u: { first_name: string; last_name: string }) => `${u.first_name} ${u.last_name}`;

const cardView = (c: BrexCard) => ({
  id: c.id,
  name: c.card_name ?? null,
  lastFour: c.last_four,
  status: c.status ?? null,
  type: c.card_type ?? null,
  limitType: c.limit_type,
  ownerUserId: c.owner?.user_id ?? null,
  limitCents: c.spend_controls?.spend_limit?.amount ?? null,
  currency: c.spend_controls?.spend_limit?.currency ?? null,
  duration: c.spend_controls?.spend_duration ?? null,
  lockAfterDate: c.spend_controls?.lock_after_date ?? null,
  allowedMerchants: c.spend_controls?.allowed_merchant_details?.map((m) => m.name) ?? null,
  blockedMerchants: c.spend_controls?.blocked_merchant_details?.map((m) => m.name) ?? null,
});

const spendLimitView = (s: BrexSpendLimit) => ({
  id: s.id,
  name: s.name,
  status: s.status,
  period: s.period_recurrence_type,
  startDate: s.start_date ?? null,
  endDate: s.end_date ?? null,
  currentPeriodBalance: s.current_period_balance
    ? {
        startDate: s.current_period_balance.start_date ?? null,
        endDate: s.current_period_balance.end_date ?? null,
        amountSpentCents: s.current_period_balance.amount_spent?.amount ?? null,
        currency: s.current_period_balance.amount_spent?.currency ?? null,
      }
    : null,
  baseLimitCents: s.authorization_settings?.base_limit.amount ?? null,
  currency: s.authorization_settings?.base_limit.currency ?? null,
  authorizationType: s.authorization_settings?.authorization_type ?? null,
  bufferPercentage: s.authorization_settings?.limit_buffer_percentage ?? null,
  autoCreateCards: s.auto_create_limit_cards_setting,
  memberUserIds: s.member_user_ids,
});

const expenseView = (e: BrexExpense) => ({
  id: e.id,
  memo: e.memo ?? null,
  status: e.status ?? null,
  paymentStatus: e.payment_status ?? null,
  purchasedAt: e.purchased_at ?? null,
  amountCents: e.billing_amount?.amount ?? null,
  currency: e.billing_amount?.currency ?? null,
  userId: e.user_id ?? null,
  merchant: e.merchant?.raw_descriptor ?? null,
  merchantMcc: e.merchant?.mcc ?? null,
  category: e.category ?? null,
  expenseType: e.expense_type ?? null,
  receipts: e.receipts?.map((receipt) => ({ id: receipt.id })) ?? [],
  complianceStatus: e.review?.compliance_status ?? null,
});

const transactionView = (t: BrexTransaction) => ({
  id: t.id,
  cardId: t.card_id ?? null,
  description: t.description,
  amountCents: t.amount.amount,
  currency: t.amount.currency ?? null,
  postedAt: t.posted_at_date,
  type: t.type ?? null,
  merchant: t.merchant?.raw_descriptor ?? null,
  mcc: t.merchant?.mcc ?? null,
  expenseId: t.expense_id ?? null,
});

const Id = z.string().min(1).max(200);
const Iso = z.string().min(1).max(40);
const None = z.object({}).strict();

export function createBrexCardsServer({
  client,
  store,
  now = () => new Date(),
}: BrexCardsServerOptions) {
  const server = new McpServer({ name: "rakazo-brex-cards", version: "0.1.0" });

  type Meta = Record<string, unknown> | undefined;
  const register = <S extends z.ZodObject>(
    name: string,
    description: string,
    schema: S,
    annotations: { readOnlyHint: boolean; destructiveHint?: boolean },
    handler: (args: z.infer<S>, meta: Meta) => Promise<CallToolResult>,
  ) => {
    const callback = async (args: z.infer<S>, extra: { _meta?: Record<string, unknown> }) => {
      try {
        return await handler(args, extra._meta);
      } catch (error) {
        if (error instanceof Refusal) return failure(error.message);
        if (error instanceof BrexError) return failure(describeBrexError(error, writeChecks[name]));
        throw error;
      }
    };
    // The SDK's callback type is generic over its own schema types, which TypeScript cannot match
    // to a schema passed through here; the schema and callback are typed together above.
    server.registerTool(
      name,
      {
        description,
        inputSchema: schema,
        annotations: { ...annotations, openWorldHint: true },
      },
      callback as never,
    );
  };
  /** Where to look to see whether an unclear write took effect. */
  const writeChecks: Record<string, string> = {
    create_vendor_card: "list_cards",
    update_card: "get_card",
    lock_card: "get_card",
    terminate_card: "get_card",
    create_spend_limit: "list_spend_limits",
    update_spend_limit: "get_spend_limit",
    update_expense_memo: "list_expenses",
  };

  const refuse = (reason: string): never => {
    throw new Refusal(reason);
  };
  /** A read that must be complete; a partial list is an error. */
  const whole = <T>(paged: Paged<T>): T[] => {
    if (!paged.complete) throw paged.error ?? new BrexError("incomplete", "Incomplete");
    return paged.items;
  };
  /** Looks something up; a 404 becomes a plain refusal. */
  async function lookup<T>(what: string, read: () => Promise<T>): Promise<T> {
    try {
      return await read();
    } catch (error) {
      if (error instanceof BrexError && error.status === 404)
        return refuse(`${what} was not found.`);
      throw error;
    }
  }
  const requireKey = (meta: Meta): string =>
    store.idempotencyKey(meta) ??
    refuse(
      "This change was called without an idempotency key, so it was refused before reaching Brex.",
    );

  function matchCard(c: BrexCard, target: { cardId: string; cardName: string; lastFour: string }) {
    if (c.last_four !== target.lastFour)
      refuse(
        `Card ${target.cardId} ends in ${c.last_four}, not ${target.lastFour}. Nothing was changed.`,
      );
    if (norm(c.card_name ?? "") !== norm(target.cardName))
      refuse(
        `Card ${target.cardId} is named "${c.card_name}", not "${target.cardName}". Nothing was changed.`,
      );
  }
  async function matchMembers(members: BrexMember[]) {
    for (const m of members) {
      const user = await lookup(`User ${m.userId}`, () => client.getUser(m.userId));
      if (norm(nameOf(user)) !== norm(m.name))
        refuse(
          `User ${m.userId} is named "${nameOf(user)}", not "${m.name}". Nothing was changed.`,
        );
    }
  }

  // ---- reads ----
  const read = { readOnlyHint: true };
  register(
    "list_cards",
    "List Brex cards, optionally for one user.",
    z.object({ userId: Id.optional() }).strict(),
    read,
    async ({ userId }) => text({ cards: whole(await client.listCards({ userId })).map(cardView) }),
  );
  register(
    "get_card",
    "Get one Brex card with its spend controls.",
    z.object({ cardId: Id }).strict(),
    read,
    async ({ cardId }) =>
      text(cardView(await lookup(`Card ${cardId}`, () => client.getCard(cardId)))),
  );
  register(
    "list_users",
    "List Brex users, optionally matching a name or email.",
    z
      .object({
        name: z.string().min(1).max(200).optional(),
        email: z.string().min(1).max(200).optional(),
      })
      .strict(),
    read,
    async (q) =>
      text({
        users: whole(await client.listUsers(q)).map((u) => ({
          id: u.id,
          name: nameOf(u),
          email: u.email ?? null,
          status: u.status ?? null,
        })),
      }),
  );
  register(
    "list_spend_limits",
    "List Brex spend limits, optionally those a user is a member of.",
    z.object({ memberUserId: Id.optional() }).strict(),
    read,
    async (q) =>
      text({
        spendLimits: whole(await client.listSpendLimits(q)).map(spendLimitView),
      }),
  );
  register(
    "get_spend_limit",
    "Get one Brex spend limit.",
    z.object({ spendLimitId: Id }).strict(),
    read,
    async ({ spendLimitId }) =>
      text(
        spendLimitView(
          await lookup(`Spend limit ${spendLimitId}`, () => client.getSpendLimit(spendLimitId)),
        ),
      ),
  );

  register(
    "list_expenses",
    "List Brex card expenses. There is no per-card filter; use list_card_transactions for a card's activity. missingReceipt lists expenses with documentation due or overdue (receipts, memos, coding).",
    z
      .object({
        userId: Id.optional(),
        purchasedAtStart: Iso.optional(),
        purchasedAtEnd: Iso.optional(),
        missingReceipt: z.boolean().optional(),
      })
      .strict(),
    read,
    async ({ missingReceipt, ...q }) => {
      const paged = await client.listExpenses({
        ...q,
        ...(missingReceipt ? { complianceStatus: ["DUE", "OVERDUE"] } : {}),
      });
      if (!paged.complete && paged.error?.kind === "auth") throw paged.error;
      return text({
        expenses: paged.items.map(expenseView),
        incomplete: !paged.complete,
      });
    },
  );

  register(
    "list_reimbursements",
    "List Brex reimbursements. This is read-only: approvals and payments happen in Brex.",
    z
      .object({
        userId: Id.optional(),
        purchasedAtStart: Iso.optional(),
        purchasedAtEnd: Iso.optional(),
      })
      .strict(),
    read,
    async (q) => {
      const paged = await client.listReimbursements(q);
      if (!paged.complete && paged.error?.kind === "auth") throw paged.error;
      return text({
        reimbursements: paged.items.map(expenseView),
        incomplete: !paged.complete,
      });
    },
  );

  register(
    "list_card_transactions",
    "List settled card transactions only. Brex does not expose pending transactions through its API and settled ones can appear late, so a card with no transactions here is not proof it is unused. If incomplete is true, do not draw conclusions from what is missing.",
    z
      .object({
        cardId: Id.optional(),
        userId: Id.optional(),
        postedAtStart: Iso.optional(),
      })
      .strict(),
    read,
    async ({ cardId, ...q }) => {
      const paged = await client.listCardTransactions(q);
      if (!paged.complete && paged.error?.kind === "auth") throw paged.error;
      const items = cardId ? paged.items.filter((t) => t.card_id === cardId) : paged.items;
      return text({
        transactions: items.map(transactionView),
        incomplete: !paged.complete,
      });
    },
  );

  register("list_trips", "List Brex trips.", None, read, async () =>
    text({
      trips: whole(await client.listTrips()).map((t) => ({
        id: t.id,
        name: t.name ?? null,
        status: t.status,
        bookerUserId: t.booker_user_id,
        startsAt: t.starts_at ?? null,
        endsAt: t.ends_at ?? null,
      })),
    }),
  );
  register(
    "list_cash_accounts",
    "List Brex cash accounts with balances (no account or routing numbers).",
    None,
    read,
    async () =>
      text({
        accounts: whole(await client.listCashAccounts()).map((a) => ({
          id: a.id,
          name: a.name,
          status: a.status ?? null,
          currentBalanceCents: a.current_balance.amount,
          availableBalanceCents: a.available_balance.amount,
          currency: a.current_balance.currency ?? null,
          primary: a.primary,
        })),
      }),
  );
  register(
    "list_statements",
    "List statement periods and balances for the card account, or for a cash account when cashAccountId is given. Brex gives no statement document; the user downloads the PDF in Brex.",
    z.object({ cashAccountId: Id.optional() }).strict(),
    read,
    async ({ cashAccountId }) => {
      const paged = cashAccountId
        ? await client.listCashStatements(cashAccountId)
        : await client.listCardStatements();
      return text({
        statements: whole(paged).map((s) => ({
          id: s.id,
          startDate: s.period.start_date,
          endDate: s.period.end_date,
          startBalanceCents: s.start_balance?.amount ?? null,
          endBalanceCents: s.end_balance?.amount ?? null,
        })),
      });
    },
  );

  // ---- writes ----
  const write = { readOnlyHint: false };

  register(
    "create_vendor_card",
    "Create a virtual vendor card. Always virtual; the owner's controls cap the amount, duration and lifetime.",
    BREX_CARDS_WRITE_ARGS.create_vendor_card,
    write,
    async (args, meta) => {
      const key = requireKey(meta);
      const controls = await store.loadControls();
      const checked = checkCreateCard(controls, args, now());
      if (!checked.ok) return refuse(checked.reason);
      await matchMembers([{ userId: args.ownerUserId, name: args.ownerName }]);

      const reservation = await store.reserveCard({
        maxCardsPerDay: controls.maxCardsPerDay,
      });
      if (!reservation.ok) return refuse(reservation.reason);
      let created: BrexCard;
      try {
        created = await client.createCard(
          {
            owner: { type: "USER", user_id: args.ownerUserId },
            card_name: args.cardName,
            card_type: "VIRTUAL",
            limit_type: "CARD",
            spend_controls: {
              spend_limit: { amount: args.amountCents, currency: "USD" },
              spend_duration: args.duration,
              ...(args.lockAfterDate ? { lock_after_date: args.lockAfterDate } : {}),
              ...(args.allowedMerchants
                ? {
                    allowed_merchant_details: args.allowedMerchants.map((name) => ({ name })),
                  }
                : {}),
              ...(args.blockedMerchants
                ? {
                    blocked_merchant_details: args.blockedMerchants.map((name) => ({ name })),
                  }
                : {}),
            },
          },
          key,
        );
      } catch (error) {
        // A definite Brex refusal frees the slot; anything unclear keeps counting.
        await settle(
          reservation.reservationId,
          error instanceof BrexError && error.definite ? "failed" : "uncertain",
        );
        throw error;
      }
      await settle(reservation.reservationId, "created", created.id);
      return text(cardView(created));
    },
  );
  /** The card is already created or the outcome already known: a bookkeeping failure must not mask it. */
  async function settle(id: string, status: ReservationStatus, cardId?: string) {
    try {
      await store.settleReservation(id, status, cardId);
    } catch {
      // The row stays `reserved`, which still counts toward the daily cap.
    }
  }

  register(
    "update_card",
    "Change a vendor card's limit (USD), duration, lock date or merchant lists. Omitted fields keep their value; null clears the lock date or a merchant list. Name the card exactly as list_cards or get_card shows it.",
    BREX_CARDS_WRITE_ARGS.update_card,
    write,
    (args, meta) =>
      store.withTargetLock(`card:${args.cardId}`, async () => {
        const controls = await store.loadControls();
        const current = await lookup(`Card ${args.cardId}`, () => client.getCard(args.cardId));
        matchCard(current, args);
        const result = checkUpdateCard(controls, current, args, now());
        if (!result.ok) return refuse(result.reason);
        const { next } = result;
        const names = (list: string[] | null) => list?.map((name) => ({ name })) ?? null;
        const updated = await client.updateCard(
          args.cardId,
          {
            spend_controls: {
              spend_limit: {
                amount: next.amountCents,
                currency: next.currency,
              },
              spend_duration: next.duration,
              lock_after_date: next.lockAfterDate,
              allowed_merchant_details: names(next.allowedMerchants),
              blocked_merchant_details: names(next.blockedMerchants),
            },
          },
          store.idempotencyKey(meta),
        );
        return text(cardView(updated));
      }),
  );

  for (const [name, verb] of [
    ["lock_card", "lockCard"],
    ["terminate_card", "terminateCard"],
  ] as const) {
    register(
      name,
      name === "lock_card"
        ? "Lock a card (reversible, but only the user can unlock it, in Brex)."
        : "Terminate a card permanently. Lock first if unsure.",
      BREX_CARDS_WRITE_ARGS[name],
      { readOnlyHint: false, destructiveHint: name === "terminate_card" },
      (args, meta) =>
        store.withTargetLock(`card:${args.cardId}`, async () => {
          const current = await lookup(`Card ${args.cardId}`, () => client.getCard(args.cardId));
          matchCard(current, args);
          return text(
            cardView(
              await client[verb](args.cardId, { reason: args.reason }, store.idempotencyKey(meta)),
            ),
          );
        }),
    );
  }

  register(
    "create_spend_limit",
    "Create a spend limit modelled on an existing one (the template): policy, visibility and increase settings are copied; the limit is always HARD with no buffer and no auto-created cards.",
    BREX_CARDS_WRITE_ARGS.create_spend_limit,
    write,
    async (args, meta) => {
      const key = requireKey(meta);
      const checked = checkCreateSpendLimit(await store.loadControls(), args);
      if (!checked.ok) return refuse(checked.reason);
      const template = await lookup(`Template spend limit ${args.templateSpendLimitId}`, () =>
        client.getSpendLimit(args.templateSpendLimitId),
      );
      if (norm(template.name) !== norm(args.templateName))
        refuse(
          `Template ${args.templateSpendLimitId} is named "${template.name}", not "${args.templateName}". Nothing was changed.`,
        );
      await matchMembers(args.members);
      const created = await client.createSpendLimit(
        {
          name: args.name,
          period_recurrence_type: args.period,
          ...(args.startDate ? { start_date: args.startDate } : {}),
          ...(args.endDate ? { end_date: args.endDate } : {}),
          authorization_settings: {
            base_limit: { amount: args.amountCents, currency: "USD" },
            authorization_type: "HARD",
            rollover_refresh_rate: "OFF",
          },
          expense_visibility: template.expense_visibility,
          authorization_visibility: template.authorization_visibility,
          limit_increase_setting: template.limit_increase_setting,
          spend_type: template.spend_type,
          auto_transfer_cards_setting: "DISABLED",
          auto_create_limit_cards_setting: "DISABLED",
          expense_policy_id: template.expense_policy_id,
          member_user_ids: args.members.map((m) => m.userId),
        },
        key,
      );
      return text(spendLimitView(created));
    },
  );

  register(
    "update_spend_limit",
    "Change a safe (HARD, unbuffered) spend limit's amount, members, end date or status (ACTIVE or ARCHIVED). Nothing else can be changed here.",
    BREX_CARDS_WRITE_ARGS.update_spend_limit,
    write,
    async (args, meta) => {
      const key = requireKey(meta);
      return store.withTargetLock(`spend_limit:${args.spendLimitId}`, async () => {
        const controls = await store.loadControls();
        const current = await lookup(`Spend limit ${args.spendLimitId}`, () =>
          client.getSpendLimit(args.spendLimitId),
        );
        if (norm(current.name) !== norm(args.spendLimitName))
          refuse(
            `Spend limit ${args.spendLimitId} is named "${current.name}", not "${args.spendLimitName}". Nothing was changed.`,
          );
        const result = checkUpdateSpendLimit(controls, current, args);
        if (!result.ok) return refuse(result.reason);
        await matchMembers([...(args.addMembers ?? []), ...(args.removeMembers ?? [])]);
        const updated = await client.updateSpendLimit(
          args.spendLimitId,
          {
            ...(args.amountCents !== undefined
              ? {
                  authorization_settings: {
                    base_limit: { amount: args.amountCents, currency: "USD" },
                  },
                }
              : {}),
            ...(result.next.memberUserIds ? { member_user_ids: result.next.memberUserIds } : {}),
            ...(args.endDate ? { end_date: args.endDate } : {}),
            ...(args.status ? { status: args.status } : {}),
          },
          key,
        );
        return text(spendLimitView(updated));
      });
    },
  );

  register(
    "update_expense_memo",
    "Replace the memo on a card expense.",
    BREX_CARDS_WRITE_ARGS.update_expense_memo,
    write,
    async ({ expenseId, memo }) => {
      const updated = await lookup(`Expense ${expenseId}`, () =>
        client.updateExpenseMemo(expenseId, memo),
      );
      return text(expenseView(updated));
    },
  );

  return server;
}
