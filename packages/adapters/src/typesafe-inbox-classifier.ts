import type {
  AdapterContext,
  AdapterDescriptor,
  InboxClassification,
  InboxClassifierCapabilities,
  InboxClassifierMessage,
  InboxClassifierProvider,
  InboxClassifyResult,
  InboxSuspiciousSignal,
} from "@rakazo/adapter-kit";
import type { InboxPriority } from "@rakazo/contracts";
import { InboxCategorySchema } from "@rakazo/contracts";
import { capSnippet } from "@rakazo/core";
import { z } from "zod";
import { DEFAULT_JEV_MODEL } from "./auto-review.js";
import { readBodyCapped } from "./web-ssrf.js";

export const TYPESAFE_CLASSIFIER_ID = "typesafe";

const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
const MAX_JSON_BYTES = 64_000;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 500;
/** Requests in flight at once; TypeSafe answers one message per request. */
const CONCURRENCY = 5;

// Thresholds from the reference inbox, applied in this order by `mapTypesafeAnswers`.
const SCAM_PHISHING = 0.7;
const SPAM_JUNK = 0.8;
const SUSPICIOUS_PHISHING = 0.4;
const SUSPICIOUS_BRAND = 0.6;
const NEWSLETTER = 0.6;
const MIN_CATEGORY_CONFIDENCE = 0.5;
const NEEDS_REPLY = 0.5;

const PRIORITY_LEVELS: InboxPriority[] = ["low", "normal", "important", "critical"];

const CATEGORY_CRITERIA = {
  reply: "A person asks the recipient a question or waits on their answer",
  action: "Asks the recipient to sign, confirm, approve or do something",
  billing: "A bill, invoice or payment due",
  receipt: "A payment, order or booking confirmation",
  scheduling: "A meeting, appointment or event to arrange or confirm",
  newsletter: "A newsletter or digest the recipient subscribed to",
  security: "A sign-in, password or account security alert from a service",
  notification: "Automated updates from an app or service",
  personal: "Written by a person to the recipient, with nothing to answer",
  fyi: "Informational, no action needed",
  bulk: "Promotions and mass marketing mail",
  suspicious: "Looks like phishing, impersonation or an unexpected credential or payment request",
  spam: "Unsolicited junk",
  scam: "A fraud attempt",
} satisfies Record<z.infer<typeof InboxCategorySchema>, string>;

const QUESTIONS = {
  category: {
    type: "choice",
    instructions: "Which category best describes this email for the person it was sent to?",
    criteria: CATEGORY_CRITERIA,
  },
  needs_response: {
    type: "noul",
    instructions:
      "Does the sender ask the recipient a direct question or wait on a reply or action from them?",
  },
  is_newsletter: {
    type: "noul",
    instructions: "Is this a newsletter, digest or marketing mailing sent to many people?",
  },
  is_phishing: {
    type: "noul",
    instructions:
      "Is this phishing or fraud: impersonation, a credential request, or an unexpected payment request?",
  },
  is_junk: { type: "noul", instructions: "Is this unsolicited junk mail?" },
  brand_mismatch: {
    type: "noul",
    instructions:
      "Does the sender claim to be a specific company, service, or brand that fromDomain does not belong to?",
  },
  priority: {
    type: "score",
    instructions: "How urgent is this email for the recipient?",
    criteria: [
      "Automated, bulk or purely informational",
      "Ordinary mail with no deadline",
      "A direct ask from a person",
      "An explicit deadline today or a real consequence",
    ],
  },
} as const;

const noul = z.object({ type: z.literal("noul"), noul: z.number().min(0).max(1) });
const responseSchema = z.object({
  model: z.string().optional(),
  answers: z.object({
    category: z.object({
      type: z.literal("choice"),
      choice: z.string(),
      confidence: z.number().min(0).max(1),
    }),
    needs_response: noul,
    is_newsletter: noul,
    is_phishing: noul,
    is_junk: noul,
    brand_mismatch: noul,
    priority: z.object({ type: z.literal("score"), score: z.number() }),
  }),
  usage: z
    .object({
      input_tokens: z.number().nonnegative().optional(),
      output_tokens: z.number().nonnegative().optional(),
    })
    .optional(),
});

/** The raw answers for one message, flattened. */
export interface TypesafeAnswers {
  category: string;
  categoryConfidence: number;
  needsResponse: number;
  newsletter: number;
  phishing: number;
  junk: number;
  brandMismatch: number;
  /** Score from 0 to 3. */
  priority: number;
}

type Mapped = Omit<InboxClassification, "id" | "reason" | "todo" | "due">;

/**
 * Turns the typed answers into a category, in the reference's order: phishing, junk, weaker
 * phishing, brand mismatch, newsletter, then the category choice. Returns null when the choice is
 * too uncertain, so the message goes to the LLM. Mail that is hostile or bulk is never answered.
 */
export function mapTypesafeAnswers(a: TypesafeAnswers): Mapped | null {
  const signals: InboxSuspiciousSignal[] = [];
  if (a.phishing >= SUSPICIOUS_PHISHING) signals.push("phishing");
  if (a.junk >= SPAM_JUNK) signals.push("junk");
  if (a.brandMismatch >= SUSPICIOUS_BRAND) signals.push("brand_mismatch");

  let category: z.infer<typeof InboxCategorySchema>;
  let confidence: number;
  if (a.phishing >= SCAM_PHISHING) {
    [category, confidence] = ["scam", a.phishing];
  } else if (a.junk >= SPAM_JUNK) {
    [category, confidence] = ["spam", a.junk];
  } else if (a.phishing >= SUSPICIOUS_PHISHING) {
    [category, confidence] = ["suspicious", a.phishing];
  } else if (a.brandMismatch >= SUSPICIOUS_BRAND) {
    [category, confidence] = ["suspicious", a.brandMismatch];
  } else if (a.newsletter >= NEWSLETTER) {
    [category, confidence] = ["newsletter", a.newsletter];
  } else {
    const chosen = InboxCategorySchema.safeParse(a.category);
    if (!chosen.success || a.categoryConfidence < MIN_CATEGORY_CONFIDENCE) return null;
    [category, confidence] = [chosen.data, a.categoryConfidence];
  }

  const quiet = ["suspicious", "spam", "scam", "newsletter"].includes(category);
  const level = Math.min(3, Math.max(0, Math.round(a.priority)));
  return {
    category,
    priority: quiet ? "low" : (PRIORITY_LEVELS[level] ?? "normal"),
    needsReply: !quiet && a.needsResponse >= NEEDS_REPLY,
    signals,
    confidence,
  };
}

/** The domain of the real sender address, never the display name a forger controls. */
export function fromDomain(from: string): string {
  const address = from.match(/<([^<>]*)>\s*$/)?.[1] ?? from;
  const at = address.lastIndexOf("@");
  return at === -1
    ? ""
    : address
        .slice(at + 1)
        .trim()
        .toLowerCase();
}

export interface TypesafeInboxClassifierOptions {
  apiKey: string;
  fetch?: typeof fetch;
  /** Per request. */
  timeoutMs?: number;
  model?: string;
  /** Extra attempts after a 429 or 529. */
  retries?: number;
  retryDelayMs?: number;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

/**
 * TypeSafe Jev over HTTP: seven typed questions per message in one request. Any failure leaves the
 * message out of the result so the LLM classifies it; nothing here throws for a vendor problem.
 */
export class TypesafeInboxClassifier implements InboxClassifierProvider {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly model: string;
  private readonly retries: number;
  private readonly retryDelayMs: number;

  constructor(options: TypesafeInboxClassifierOptions) {
    this.apiKey = options.apiKey.trim();
    if (!this.apiKey) throw new Error("TYPESAFE_API_KEY is required");
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.model = options.model?.trim() || DEFAULT_JEV_MODEL;
    this.retries = options.retries ?? DEFAULT_RETRIES;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  }

  describe(): AdapterDescriptor<InboxClassifierCapabilities> {
    return {
      id: TYPESAFE_CLASSIFIER_ID,
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: { offline: false, keyless: false },
    };
  }

  async classify(
    messages: InboxClassifierMessage[],
    context: AdapterContext,
  ): Promise<InboxClassifyResult> {
    const unique = [...new Map(messages.map((m) => [m.id, m])).values()];
    const slots: Array<Mapped | null> = unique.map(() => null);
    const usage = { inputTokens: 0, outputTokens: 0 };
    let model = this.model;
    let next = 0;
    const worker = async () => {
      for (let i = next++; i < unique.length; i = next++) {
        const answered = await this.ask(unique[i] as InboxClassifierMessage, context.signal);
        if (!answered) continue;
        model = answered.model;
        usage.inputTokens += answered.usage.inputTokens;
        usage.outputTokens += answered.usage.outputTokens;
        slots[i] = mapTypesafeAnswers(answered.answers);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, unique.length) }, worker));
    const items = unique.flatMap((m, i) => {
      const mapped = slots[i];
      return mapped ? [{ ...mapped, id: m.id, reason: null, todo: null, due: null }] : [];
    });
    return { model, items, usage };
  }

  private async ask(message: InboxClassifierMessage, signal: AbortSignal) {
    // The internal id and the message body stay out; only what triage already sends goes.
    const body = JSON.stringify({
      model: this.model,
      state: {
        from: message.from,
        fromDomain: fromDomain(message.from),
        to: message.to,
        cc: message.cc,
        subject: message.subject,
        snippet: capSnippet(message.snippet),
        receivedAt: message.receivedAt,
        addressedToMe: message.addressedToMe,
        threadLength: message.threadLength,
      },
      questions: QUESTIONS,
    });
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      if (signal.aborted) return null;
      const bounded = AbortSignal.any([signal, AbortSignal.timeout(this.timeoutMs)]);
      try {
        const response = await this.fetchImpl(TYPESAFE_URL, {
          method: "POST",
          redirect: "error",
          signal: bounded,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body,
        });
        if (response.status === 429 || response.status === 529) {
          void response.body?.cancel().catch(() => undefined);
          if (attempt < this.retries) await sleep(this.retryDelayMs * 2 ** attempt, signal);
          continue;
        }
        if (!response.ok) {
          void response.body?.cancel().catch(() => undefined);
          return null;
        }
        const parsed = responseSchema.safeParse(
          JSON.parse(
            new TextDecoder().decode(await readBodyCapped(response, MAX_JSON_BYTES, bounded)),
          ),
        );
        if (!parsed.success) return null;
        const { answers } = parsed.data;
        return {
          model: parsed.data.model ?? this.model,
          usage: {
            inputTokens: parsed.data.usage?.input_tokens ?? 0,
            outputTokens: parsed.data.usage?.output_tokens ?? 0,
          },
          answers: {
            category: answers.category.choice,
            categoryConfidence: answers.category.confidence,
            needsResponse: answers.needs_response.noul,
            newsletter: answers.is_newsletter.noul,
            phishing: answers.is_phishing.noul,
            junk: answers.is_junk.noul,
            brandMismatch: answers.brand_mismatch.noul,
            priority: answers.priority.score,
          },
        };
      } catch {
        return null;
      }
    }
    return null;
  }
}
