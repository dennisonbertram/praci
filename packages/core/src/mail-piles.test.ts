import { InboxCategorySchema, type MailSignals } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import {
  classifyPile,
  LEARN_MIN_AGREEING,
  type LearnContext,
  type LearnVote,
  learnSenderPile,
  type PileInput,
  pileFromCategory,
  resolvePile,
} from "./mail-piles.js";

const quiet: MailSignals = {
  listUnsubscribe: [],
  oneClick: false,
  listId: null,
  bulk: false,
  autoSubmitted: false,
  auth: { dkim: "pass", spf: "pass", dmarc: "pass" },
  dkimCoversUnsubscribe: false,
  categories: {
    spam: false,
    promotions: false,
    social: false,
    updates: false,
    forums: false,
    important: false,
  },
};
const withSignals = (patch: Partial<MailSignals>): MailSignals => ({ ...quiet, ...patch });
const listMail = withSignals({ listUnsubscribe: ["https://lists.example.test/u/1"] });

function input(patch: Partial<PileInput> = {}): PileInput {
  return {
    fromName: "Sam Example",
    fromAddress: "sam@example.test",
    subject: "Lunch on Thursday",
    signals: quiet,
    senderMark: null,
    priorContact: false,
    skipInbox: false,
    learnedPile: null,
    ...patch,
  };
}

describe("classifyPile stage order", () => {
  it("lets the Gmail spam flag beat an important mark and prior contact", () => {
    const decision = classifyPile(
      input({
        signals: withSignals({ categories: { ...quiet.categories, spam: true } }),
        senderMark: "important",
        priorContact: true,
      }),
    );
    expect(decision).toEqual({ pile: "spam", reasons: ["gmail_spam"] });
  });

  it("puts an important-marked sender in important even with List-Unsubscribe", () => {
    expect(classifyPile(input({ signals: listMail, senderMark: "important" }))).toEqual({
      pile: "important",
      reasons: ["marked_important"],
    });
  });

  it("leaves failed authentication from a prior contact or an important mark to the model", () => {
    const forged = withSignals({ auth: { dkim: "fail", spf: "fail", dmarc: "fail" } });
    const expected = { pile: null, reasons: ["auth_failed"] };
    expect(classifyPile(input({ signals: forged, priorContact: true }))).toEqual(expected);
    expect(classifyPile(input({ signals: forged, senderMark: "important" }))).toEqual(expected);
  });

  it("does not turn prior contact into important for a sender marked noise", () => {
    const decision = classifyPile(input({ senderMark: "noise", priorContact: true }));
    expect(decision.pile).toBeNull();
  });

  it("lets a noise mark pass through to the header rules when there was no prior contact", () => {
    expect(classifyPile(input({ signals: listMail, senderMark: "noise" })).pile).toBe(
      "newsletters",
    );
  });
});

describe("classifyPile prior contact", () => {
  it("leaves unknown prior contact with bulk headers to the model", () => {
    expect(classifyPile(input({ signals: listMail, priorContact: null }))).toEqual({
      pile: null,
      reasons: ["prior_contact_unknown"],
    });
  });

  it("leaves prior contact with bulk headers to the model", () => {
    expect(classifyPile(input({ signals: listMail, priorContact: true }))).toEqual({
      pile: null,
      reasons: ["automated_prior_contact"],
    });
    for (const patch of [
      { bulk: true },
      { listId: "Friends <friends.example.test>" },
      { autoSubmitted: true },
    ])
      expect(
        classifyPile(input({ signals: withSignals(patch), priorContact: true })).pile,
      ).toBeNull();
  });

  it("treats prior contact with clean headers as important", () => {
    expect(classifyPile(input({ priorContact: true }))).toEqual({
      pile: "important",
      reasons: ["prior_contact"],
    });
  });

  it("treats a no-reply sender as automated even after prior contact", () => {
    expect(
      classifyPile(input({ fromAddress: "noreply@shop.example.test", priorContact: true })).pile,
    ).toBeNull();
  });

  it("decides bulk headers as newsletters when the user never wrote to the sender", () => {
    expect(classifyPile(input({ signals: listMail, priorContact: false }))).toEqual({
      pile: "newsletters",
      reasons: ["list_unsubscribe"],
    });
  });

  it("never decides from a row whose headers were not fetched", () => {
    expect(classifyPile(input({ signals: null, priorContact: false }))).toEqual({
      pile: null,
      reasons: ["no_signals"],
    });
  });
});

describe("classifyPile safety", () => {
  const failed = withSignals({
    auth: { dkim: "fail", spf: "pass", dmarc: "fail" },
    listUnsubscribe: ["https://x.example.test/u"],
  });

  it("marks failed authentication that claims a known brand as spam", () => {
    expect(
      classifyPile(
        input({
          fromName: "PayPal Support",
          fromAddress: "help@paypa1-secure.example.test",
          subject: "Confirm your account",
          signals: failed,
        }),
      ),
    ).toEqual({ pile: "spam", reasons: ["auth_failed_brand"] });
  });

  it("leaves failed authentication that claims a brand to the model once the sender is marked important", () => {
    expect(
      classifyPile(
        input({
          fromName: "PayPal Support",
          fromAddress: "help@paypa1-secure.example.test",
          subject: "Confirm your account",
          signals: failed,
          senderMark: "important",
        }),
      ),
    ).toEqual({ pile: null, reasons: ["auth_failed"] });
  });

  it("does not call a real brand domain spam when the brand matches the sender domain", () => {
    expect(
      classifyPile(
        input({
          fromName: "PayPal",
          fromAddress: "service@paypal.example.test",
          subject: "Your statement",
          signals: failed,
        }),
      ).pile,
    ).toBeNull();
  });

  it("leaves failed authentication without a brand and with list headers to the model", () => {
    expect(classifyPile(input({ signals: failed }))).toEqual({
      pile: null,
      reasons: ["auth_failed"],
    });
  });
});

describe("classifyPile headers", () => {
  it("passes security alerts, bills and direct asks to the model even from no-reply", () => {
    for (const subject of [
      "Security alert: new sign-in from Linux",
      "Invoice 1042 is overdue",
      "Can you review this today",
      "Do you have a minute?",
    ])
      expect(
        classifyPile(
          input({ fromAddress: "no-reply@service.example.test", subject, signals: listMail }),
        ),
      ).toEqual({ pile: null, reasons: ["sensitive_subject"] });
  });

  it("sorts a clear notification into updates", () => {
    expect(
      classifyPile(
        input({
          fromAddress: "notifications@tracker.example.test",
          subject: "Build 412 finished",
        }),
      ),
    ).toEqual({ pile: "updates", reasons: ["no_reply"] });
    expect(
      classifyPile(
        input({ signals: withSignals({ autoSubmitted: true }), subject: "Out of office" }),
      ).pile,
    ).toBe("updates");
  });

  it("lets the subject decide when updates and newsletters signals both exist", () => {
    const decision = classifyPile(
      input({
        signals: withSignals({
          categories: { ...quiet.categories, updates: true, promotions: true },
          listId: "Shop <shop.example.test>",
        }),
        subject: "Your order shipped",
      }),
    );
    expect(decision.pile).toBe("updates");
  });

  it("sorts promotions, list id and bulk precedence into newsletters", () => {
    for (const patch of [
      { categories: { ...quiet.categories, promotions: true } },
      { categories: { ...quiet.categories, forums: true } },
      { listId: "News <news.example.test>" },
      { bulk: true },
    ])
      expect(classifyPile(input({ signals: withSignals(patch), subject: "Fall sale" })).pile).toBe(
        "newsletters",
      );
  });

  it("leaves plain mail from an unknown sender to the model", () => {
    expect(classifyPile(input())).toEqual({ pile: null, reasons: [] });
  });
});

describe("classifyPile newsletters versus updates", () => {
  const updatesNewsletter = withSignals({
    categories: { ...quiet.categories, updates: true },
    listUnsubscribe: ["https://lists.example.test/u/1"],
    listId: "Research <research.example.test>",
  });

  it("files a Gmail Updates newsletter with List-Id and List-Unsubscribe under newsletters", () => {
    const decision = classifyPile(input({ signals: updatesNewsletter, subject: "This week" }));
    expect(decision.pile).toBe("newsletters");
    expect(decision.reasons).toEqual(["list_unsubscribe", "list_id"]);
  });

  it("keeps auto-submitted mail with List-Unsubscribe in updates", () => {
    expect(
      classifyPile(input({ signals: { ...listMail, autoSubmitted: true }, subject: "Heads up" }))
        .pile,
    ).toBe("updates");
  });

  it("keeps a receipt or shipping subject with list headers in updates", () => {
    for (const subject of [
      "Your receipt from Shop",
      "Your order #1042",
      "Order confirmation",
      "Package delivered",
      "Out for delivery today",
    ]) {
      const decision = classifyPile(input({ signals: updatesNewsletter, subject }));
      expect(decision.pile, subject).toBe("updates");
      expect(decision.reasons).toContain("transactional_subject");
    }
  });

  it("does not read a newsletter subject with delivered, shipped or order digits as transactional", () => {
    for (const subject of [
      "Today's top stories, delivered",
      "Fresh ideas shipped weekly",
      "Pre-order 2 get 1",
      "Border 5 tips",
      "Disorder 3 ways",
    ]) {
      expect(classifyPile(input({ signals: updatesNewsletter, subject })).pile, subject).toBe(
        "newsletters",
      );
    }
  });

  it("does not read a promo that says order now as transactional", () => {
    expect(classifyPile(input({ signals: listMail, subject: "Order now and save 20%" })).pile).toBe(
      "newsletters",
    );
  });

  it("leaves a transactional-sounding subject with no other signal to the model", () => {
    expect(classifyPile(input({ subject: "I shipped the box" }))).toEqual({
      pile: null,
      reasons: [],
    });
  });

  it("sends no-reply with only List-Unsubscribe to updates", () => {
    expect(
      classifyPile(input({ fromAddress: "no-reply@app.example.test", signals: listMail })).pile,
    ).toBe("updates");
  });

  it("sends no-reply with a List-Id to newsletters", () => {
    expect(
      classifyPile(
        input({
          fromAddress: "no-reply@app.example.test",
          signals: withSignals({ listId: "News <news.example.test>" }),
        }),
      ).pile,
    ).toBe("newsletters");
  });

  it("sends no-reply with the promotions category to newsletters", () => {
    expect(
      classifyPile(
        input({
          fromAddress: "no-reply@app.example.test",
          signals: withSignals({ categories: { ...quiet.categories, promotions: true } }),
        }),
      ).pile,
    ).toBe("newsletters");
  });

  it("keeps Gmail social mail with List-Unsubscribe in updates", () => {
    expect(
      classifyPile(
        input({
          signals: {
            ...listMail,
            categories: { ...quiet.categories, social: true },
          },
        }),
      ).pile,
    ).toBe("updates");
  });
});

describe("classifyPile learned sender", () => {
  const learned = (patch: Partial<PileInput> = {}) =>
    classifyPile(input({ learnedPile: "newsletters", ...patch }));
  const noPass = withSignals({ auth: { dkim: null, spf: null, dmarc: null } });
  const unaligned = withSignals({ auth: { dkim: "pass", spf: "pass", dmarc: null } });

  it("uses the learned pile when no header rule decides, auth passes and nothing is marked", () => {
    expect(learned()).toEqual({ pile: "newsletters", reasons: ["learned_sender"] });
    expect(learned({ learnedPile: "important" }).pile).toBe("important");
  });

  it("lets a security subject, failed auth, missing auth, a mark, skip inbox and prior contact beat it", () => {
    expect(learned({ subject: "Security alert: new sign-in" }).pile).toBeNull();
    const forged = withSignals({ auth: { dkim: "fail", spf: "pass", dmarc: "pass" } });
    expect(learned({ signals: forged }).pile).toBeNull();
    expect(learned({ signals: noPass }).pile).toBeNull();
    expect(learned({ signals: unaligned }).pile).toBeNull();
    expect(learned({ senderMark: "noise" }).pile).toBeNull();
    expect(learned({ senderMark: "important" }).pile).toBe("important");
    expect(learned({ skipInbox: true }).reasons).toEqual(["skip_inbox"]);
    expect(learned({ priorContact: true }).reasons).toEqual(["prior_contact"]);
    expect(learned({ priorContact: null }).pile).toBeNull();
    expect(learned({ signals: null }).pile).toBeNull();
  });

  it("lets header rules decide before the learned pile", () => {
    expect(learned({ learnedPile: "important", signals: listMail }).pile).toBe("newsletters");
    expect(
      learned({ learnedPile: "important", signals: withSignals({ autoSubmitted: true }) }).pile,
    ).toBe("updates");
  });
});

describe("learnSenderPile", () => {
  const vote = (patch: Partial<LearnVote> = {}): LearnVote => ({
    category: "newsletter",
    modelDecided: true,
    signals: quiet,
    receivedAt: new Date("2026-10-10T10:00:00Z"),
    notSpam: false,
    ruleIsSpam: false,
    ...patch,
  });
  const ctx = (patch: Partial<LearnContext> = {}): LearnContext => ({
    mark: null,
    priorContact: false,
    skipInbox: false,
    forgottenAt: null,
    current: null,
    ...patch,
  });
  const votes = (n: number, patch: Partial<LearnVote> = {}) =>
    Array.from({ length: n }, () => vote(patch));
  const none = { pile: null, count: 0 };

  it("learns at the minimum number of agreeing verdicts and not before", () => {
    expect(LEARN_MIN_AGREEING).toBe(3);
    expect(learnSenderPile(votes(3), ctx())).toEqual({ pile: "newsletters", count: 3 });
    expect(learnSenderPile(votes(2), ctx())).toEqual({ keep: true });
  });

  it("maps categories to piles, so different categories in one pile agree", () => {
    const mixed = [vote({ category: "newsletter" }), vote({ category: "bulk" }), vote()];
    expect(learnSenderPile(mixed, ctx())).toEqual({ pile: "newsletters", count: 3 });
  });

  it("returns none on a conflicting verdict", () => {
    expect(learnSenderPile([...votes(3), vote({ category: "receipt" })], ctx())).toEqual(none);
  });

  it("returns none when any verdict is spam, scam or suspicious", () => {
    for (const category of ["spam", "scam", "suspicious"])
      expect(learnSenderPile([...votes(3), vote({ category })], ctx())).toEqual(none);
  });

  it("ignores rows with failed or no-pass authentication", () => {
    const forged = withSignals({ auth: { dkim: "fail", spf: "pass", dmarc: "pass" } });
    const noPass = withSignals({ auth: { dkim: null, spf: null, dmarc: null } });
    expect(learnSenderPile([...votes(3), vote({ signals: forged })], ctx())).toEqual({
      pile: "newsletters",
      count: 3,
    });
    expect(learnSenderPile([...votes(2), vote({ signals: noPass })], ctx())).toEqual({
      keep: true,
    });
    const unaligned = withSignals({ auth: { dkim: "pass", spf: "pass", dmarc: null } });
    expect(learnSenderPile([...votes(2), vote({ signals: unaligned })], ctx())).toEqual({
      keep: true,
    });
    expect(learnSenderPile([...votes(2), vote({ signals: null })], ctx())).toEqual({ keep: true });
  });

  it("ignores rows that header rules decided", () => {
    expect(learnSenderPile([...votes(2), vote({ modelDecided: false })], ctx())).toEqual({
      keep: true,
    });
  });

  it("returns none for prior contact, unknown prior contact, a mark or skip inbox", () => {
    expect(learnSenderPile(votes(3), ctx({ priorContact: true }))).toEqual(none);
    expect(learnSenderPile(votes(3), ctx({ priorContact: null }))).toEqual(none);
    expect(learnSenderPile(votes(3), ctx({ mark: "noise" }))).toEqual(none);
    expect(learnSenderPile(votes(3), ctx({ mark: "important" }))).toEqual(none);
    expect(learnSenderPile(votes(3), ctx({ skipInbox: true }))).toEqual(none);
  });

  it("returns none when a row was marked Not spam or a rule put it in spam", () => {
    expect(learnSenderPile([...votes(3), vote({ notSpam: true })], ctx())).toEqual(none);
    expect(learnSenderPile([...votes(3), vote({ ruleIsSpam: true })], ctx())).toEqual(none);
  });

  it("counts only votes received after the user forgot the decision", () => {
    const forgottenAt = new Date("2026-10-10T10:00:00Z");
    const after = new Date("2026-10-11T10:00:00Z");
    expect(learnSenderPile(votes(3), ctx({ forgottenAt }))).toEqual({ keep: true });
    expect(learnSenderPile(votes(3, { receivedAt: after }), ctx({ forgottenAt }))).toEqual({
      pile: "newsletters",
      count: 3,
    });
  });

  it("clears the stored decision when a fewer-than-minimum verdict contradicts it", () => {
    const stored = ctx({ current: "newsletters" });
    expect(learnSenderPile([vote({ category: "receipt" })], stored)).toEqual(none);
    expect(learnSenderPile([vote()], stored)).toEqual({ keep: true });
    expect(learnSenderPile(votes(3, { category: "receipt" }), stored)).toEqual({
      pile: "updates",
      count: 3,
    });
  });

  it("keeps the current decision when there is no eligible vote", () => {
    expect(learnSenderPile([], ctx())).toEqual({ keep: true });
  });
});

describe("classifyPile skip inbox", () => {
  const skipping = (patch: Partial<PileInput> = {}) =>
    classifyPile(input({ skipInbox: true, ...patch }));

  it("treats a skipped sender with list headers as decided newsletters", () => {
    expect(skipping({ signals: listMail })).toEqual({
      pile: "newsletters",
      reasons: ["skip_inbox"],
    });
  });

  it("treats a skipped sender with no bulk headers as decided updates", () => {
    expect(skipping()).toEqual({ pile: "updates", reasons: ["skip_inbox"] });
    expect(skipping({ signals: null, priorContact: null }).pile).toBe("updates");
  });

  it("still decides bulk for a skipped sender the user once wrote to", () => {
    expect(skipping({ signals: listMail, priorContact: true }).pile).toBe("newsletters");
  });

  it("never lets a skip decision beat spam, forged brand mail or an important mark", () => {
    expect(
      skipping({ signals: withSignals({ categories: { ...quiet.categories, spam: true } }) }).pile,
    ).toBe("spam");
    const forged = withSignals({ auth: { dkim: "fail", spf: "fail", dmarc: "fail" } });
    expect(skipping({ signals: forged, fromName: "PayPal Support" }).pile).toBe("spam");
    expect(skipping({ senderMark: "important", signals: listMail }).pile).toBe("important");
  });

  it("leaves failed authentication to the model rather than archiving it as a skipped sender", () => {
    const forged = withSignals({ auth: { dkim: "fail", spf: "pass", dmarc: "pass" } });
    expect(skipping({ signals: forged }).pile).toBeNull();
  });
});

describe("pileFromCategory", () => {
  it("maps every triage category", () => {
    for (const category of InboxCategorySchema.options)
      expect(pileFromCategory(category), category).not.toBeUndefined();
    expect(pileFromCategory("reply")).toBe("important");
    expect(pileFromCategory("receipt")).toBe("updates");
    expect(pileFromCategory("newsletter")).toBe("newsletters");
    expect(pileFromCategory("scam")).toBe("spam");
    expect(pileFromCategory(null)).toBeNull();
    expect(pileFromCategory("something-new")).toBeNull();
  });
});

describe("resolvePile", () => {
  it("keeps the rule pile over a non-spam model verdict", () => {
    expect(resolvePile("newsletters", "personal")).toBe("newsletters");
    expect(resolvePile(null, "personal")).toBe("important");
    expect(resolvePile(null, null)).toBeNull();
  });

  it("lets the user's Not spam choice beat a model spam verdict but not a spam rule pile", () => {
    expect(resolvePile(null, "spam", true)).toBeNull();
    expect(resolvePile("newsletters", "scam", true)).toBe("newsletters");
    expect(resolvePile("spam", "spam", true)).toBe("spam");
  });

  it("lets a spam, scam or suspicious verdict beat any rule pile", () => {
    for (const category of ["spam", "scam", "suspicious"]) {
      expect(resolvePile("newsletters", category)).toBe("spam");
      expect(resolvePile("important", category)).toBe("spam");
    }
  });
});
