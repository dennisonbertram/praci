import { InboxCategorySchema, type MailSignals } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { classifyPile, type PileInput, pileFromCategory, resolvePile } from "./mail-piles.js";

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

  it("lets updates win over newsletters when both signals exist", () => {
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

  it("lets a spam, scam or suspicious verdict beat any rule pile", () => {
    for (const category of ["spam", "scam", "suspicious"]) {
      expect(resolvePile("newsletters", category)).toBe("spam");
      expect(resolvePile("important", category)).toBe("spam");
    }
  });
});
