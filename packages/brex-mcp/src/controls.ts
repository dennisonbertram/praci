import type { BrexCardDuration, BrexCardsControls, BrexMember } from "@rakazo/contracts";
import type { BrexCard, BrexSpendLimit } from "./client.js";

/** `reason` is the tool error the model sees, so it says what was refused and why. */
export type Check = { ok: true } | { ok: false; reason: string };

export interface CardState {
  amountCents: number;
  currency: "USD";
  duration: BrexCardDuration;
  lockAfterDate: string | null;
  allowedMerchants: string[] | null;
  blockedMerchants: string[] | null;
}

/** The new values of an update_card call; an omitted field keeps the card's current value. */
export interface CardPatch {
  amountCents?: number;
  duration?: BrexCardDuration;
  lockAfterDate?: string | null;
  allowedMerchants?: string[] | null;
  blockedMerchants?: string[] | null;
}

export interface SpendLimitPatch {
  amountCents?: number;
  addMembers?: BrexMember[];
  removeMembers?: BrexMember[];
  endDate?: string;
  status?: "ACTIVE" | "ARCHIVED";
}

const DAY_MS = 86_400_000;
const refuse = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });
const blocked = (reason: string) => refuse(`Blocked by the owner's Brex controls: ${reason}`);
const usd = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function isRealDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Amount cap, allowed durations and the ONE_TIME lifetime rule, applied to a resulting state. */
function checkCardState(
  controls: BrexCardsControls,
  state: Pick<CardState, "amountCents" | "duration" | "lockAfterDate">,
  capCents: number,
  amountLabel: string,
  now: Date,
): Check {
  if (state.amountCents > capCents)
    return blocked(`${amountLabel} ${usd(state.amountCents)} exceeds the ${usd(capCents)} cap.`);
  if (!controls.allowedDurations.includes(state.duration))
    return blocked(
      `duration ${state.duration} is not allowed (allowed: ${controls.allowedDurations.join(", ")}).`,
    );
  if (state.lockAfterDate !== null && !isRealDate(state.lockAfterDate))
    return refuse(`The lock date ${state.lockAfterDate} is not a real date (use YYYY-MM-DD).`);
  if (state.duration === "ONE_TIME" && controls.oneTimeMaxDays !== null) {
    const max = controls.oneTimeMaxDays;
    if (state.lockAfterDate === null)
      return blocked(`a ONE_TIME card needs a lock date within ${max} days.`);
    const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
    const days = (Date.parse(`${state.lockAfterDate}T00:00:00Z`) - today) / DAY_MS;
    if (days > max)
      return blocked(
        `a ONE_TIME card must lock within ${max} days; ${state.lockAfterDate} is later.`,
      );
  }
  return { ok: true };
}

export function checkCreateCard(
  controls: BrexCardsControls,
  input: { amountCents: number; duration: BrexCardDuration; lockAfterDate?: string | undefined },
  now: Date,
): Check {
  return checkCardState(
    controls,
    { ...input, lockAfterDate: input.lockAfterDate ?? null },
    controls.maxNewCardLimitCents,
    "new card limit",
    now,
  );
}

/** Checks the card as it would be after the patch, and returns that state for the full update. */
export function checkUpdateCard(
  controls: BrexCardsControls,
  card: BrexCard,
  patch: CardPatch,
  now: Date,
): { ok: true; next: CardState } | { ok: false; reason: string } {
  const current = card.spend_controls;
  if (card.limit_type !== "CARD" || !current)
    return refuse(
      "This card draws on a per-user limit, so its limit cannot be changed here. Use update_spend_limit on the user's spend limit.",
    );
  if (!current.spend_limit || !current.spend_duration)
    return refuse("The card's current spend controls could not be read, so it was not changed.");
  if (current.spend_limit.currency !== "USD")
    return refuse("Only USD cards can be changed; this card's limit is not in USD.");

  const names = (list: { name: string }[] | null | undefined) =>
    list?.length ? list.map((m) => m.name) : null;
  const next: CardState = {
    amountCents: patch.amountCents ?? current.spend_limit.amount,
    currency: "USD",
    duration: patch.duration ?? current.spend_duration,
    lockAfterDate:
      patch.lockAfterDate !== undefined ? patch.lockAfterDate : (current.lock_after_date ?? null),
    allowedMerchants:
      patch.allowedMerchants !== undefined
        ? patch.allowedMerchants
        : names(current.allowed_merchant_details),
    blockedMerchants:
      patch.blockedMerchants !== undefined
        ? patch.blockedMerchants
        : names(current.blocked_merchant_details),
  };
  const checked = checkCardState(controls, next, controls.maxCardLimitCents, "card limit", now);
  return checked.ok ? { ok: true, next } : checked;
}

export function checkCreateSpendLimit(
  controls: BrexCardsControls,
  input: { amountCents: number },
): Check {
  if (input.amountCents > controls.maxSpendLimitBaseCents)
    return blocked(
      `spend limit base amount ${usd(input.amountCents)} exceeds the ${usd(controls.maxSpendLimitBaseCents)} cap.`,
    );
  return { ok: true };
}

/**
 * A limit may only be edited when it is already safe: HARD, no buffer, no auto-created cards, USD.
 * Anything else is edited by the user in Brex. Returns the member ids the patch results in, when
 * it touches members.
 */
export function checkUpdateSpendLimit(
  controls: BrexCardsControls,
  current: BrexSpendLimit,
  patch: SpendLimitPatch,
): { ok: true; next: { memberUserIds?: string[] } } | { ok: false; reason: string } {
  const settings = current.authorization_settings;
  if (!settings) return refuse("This spend limit's settings could not be read. Edit it in Brex.");
  if (settings.authorization_type !== "HARD")
    return refuse(`This spend limit is ${settings.authorization_type}, not HARD. Edit it in Brex.`);
  if (current.auto_create_limit_cards_setting !== "DISABLED")
    return refuse("This spend limit auto-creates cards for its members. Edit it in Brex.");
  if (settings.limit_buffer_percentage)
    return refuse("This spend limit has a spending buffer. Edit it in Brex.");
  if (settings.base_limit.currency !== "USD")
    return refuse("Only USD spend limits can be changed; this one is not in USD.");
  // The cap applies to the resulting amount, so an over-cap limit stays blocked until it is lowered.
  const amountCents = patch.amountCents ?? settings.base_limit.amount;
  // Archiving stops all spending on the limit, so an over-cap limit can still be archived.
  if (patch.status !== "ARCHIVED" && amountCents > controls.maxSpendLimitBaseCents)
    return blocked(
      `spend limit base amount ${usd(amountCents)} exceeds the ${usd(controls.maxSpendLimitBaseCents)} cap.`,
    );

  if (!patch.addMembers?.length && !patch.removeMembers?.length) return { ok: true, next: {} };
  const members = new Set(current.member_user_ids);
  for (const m of patch.removeMembers ?? []) {
    if (!members.delete(m.userId)) return refuse(`${m.name} is not a member of this spend limit.`);
  }
  for (const m of patch.addMembers ?? []) members.add(m.userId);
  return { ok: true, next: { memberUserIds: [...members] } };
}
