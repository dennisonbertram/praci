import type { ConnectorProxyRequest } from "@rakazo/adapter-kit";
import type { EmulatedMessage } from "@rakazo/adapters";
import { ComposioEmulator, GmailApiEmulator, parseRawMime } from "@rakazo/adapters";

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/**
 * Today's HTML message carries a script that must not run, a remote image, an inline `cid:` image,
 * and a normal and a `javascript:` link.
 */
const OFFSITE_HTML =
  '<p id="probe">Can you do the 14th or the 21st?</p>' +
  '<script>document.getElementById("probe").textContent = "script ran";</script>' +
  '<img id="remote" alt="Offsite banner" width="320" height="96" src="https://example.invalid/offsite-banner.svg">' +
  '<img id="inline" alt="Inline mark" width="48" height="48" src="cid:mark@e2e">' +
  '<p><a id="agenda" href="https://example.invalid/agenda">Agenda</a> ' +
  '<a id="unsafe" href="javascript:document.getElementById(\'probe\').remove()">Unsafe</a></p>';

/** A valid 1x1 PNG, shown at 48px by the markup above. */
const MARK_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** The bytes the Inbox e2e downloads; apps/web/e2e/inbox.spec.ts asserts the same text. */
const REPORT_PDF_TEXT = "%PDF-1.4 Q3 report";
const BUDGET_CSV_TEXT = "team,spend\nplatform,1200\n";
const REPORT_PDF = Buffer.from(REPORT_PDF_TEXT).toString("base64");
const BUDGET_CSV = Buffer.from(BUDGET_CSV_TEXT).toString("base64");

/** Two seeded mailboxes, dated against `now` so the 14-day sync window always includes them. */
export function e2eMailboxes(now = new Date()) {
  const at = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const first: EmulatedMessage[] = [
    {
      id: "e2e-a-1",
      threadId: "e2e-t-offsite",
      date: at(MINUTE_MS),
      labels: ["INBOX", "UNREAD"],
      from: "Sam Rivera <sam@example.test>",
      to: "first@example.test",
      subject: "Offsite dates",
      snippet: "Can you do the 14th or the 21st?",
      html: OFFSITE_HTML,
      inlineImages: [{ contentId: "mark@e2e", mimeType: "image/png", data: MARK_PNG }],
    },
    {
      id: "e2e-a-2",
      threadId: "e2e-t-ci",
      date: at(5 * DAY_MS),
      labels: ["INBOX"],
      from: "GitHub <ci@example.test>",
      to: "first@example.test",
      subject: "CI passed on main",
      text: "All checks have passed.",
    },
    {
      id: "e2e-a-3",
      date: at(3 * DAY_MS),
      labels: ["INBOX", "STARRED"],
      from: "Dana Cho <dana@example.test>",
      to: "first@example.test",
      subject: "Q3 report",
      text: "The report is attached.",
      attachments: [
        { filename: "q3-report.pdf", mimeType: "application/pdf", size: 0, data: REPORT_PDF },
        { filename: "budget.csv", mimeType: "text/csv", size: 0, data: BUDGET_CSV },
      ],
    },
    {
      id: "e2e-a-4",
      date: at(4 * DAY_MS),
      labels: ["INBOX", "CATEGORY_PROMOTIONS"],
      from: "Shop <shop@example.test>",
      to: "first@example.test",
      subject: "Weekend sale",
      text: "Everything is 20 percent off.",
    },
    {
      // Older than the 14-day sync window: only Gmail-side filters and search can find it.
      id: "e2e-a-5",
      date: at(40 * DAY_MS),
      labels: ["STARRED"],
      from: "Legal <legal@example.test>",
      to: "first@example.test",
      subject: "Signed contract",
      text: "The signed contract is filed.",
    },
    {
      // Cc, and formatting that a forward must keep.
      id: "e2e-a-6",
      date: at(2 * MINUTE_MS),
      labels: ["INBOX"],
      from: "Lena Park <lena@example.test>",
      to: "first@example.test, Dana Cho <dana@example.test>",
      cc: "Team <team@example.test>",
      subject: "Team sync notes",
      html: '<h2>Sync notes</h2><p>We <b>agreed</b> on <a href="https://example.invalid/plan">the plan</a>.</p><ul><li>Ship Friday</li></ul>',
    },
    {
      // A URL with no break opportunities, which must wrap inside the preview.
      id: "e2e-a-7",
      date: at(3 * MINUTE_MS),
      labels: ["INBOX"],
      from: "Ops <ops@example.test>",
      to: "first@example.test",
      subject: "Long link",
      text: `See https://example.invalid/${"segment".repeat(40)}`,
    },
  ];
  const second: EmulatedMessage[] = [
    {
      id: "e2e-b-1",
      threadId: "e2e-t-invoice",
      date: at(2 * MINUTE_MS),
      labels: ["INBOX", "UNREAD"],
      from: "Northwind Hosting <billing@example.test>",
      to: "second@example.test",
      subject: "Invoice #1043",
      text: "Your invoice for October is ready.",
    },
  ];
  return {
    "e2e-first": { address: "first@example.test", messages: first },
    "e2e-second": { address: "second@example.test", messages: second },
  };
}

/** What the Gmail emulator holds for one account: its drafts and the mail it sent. */
export type E2eGmailSnapshot = ReturnType<GmailApiEmulator["snapshot"]>;

/**
 * ComposioEmulator mints connection refs like `GMAIL:7`, which GmailApiEmulator's seeded
 * mailboxes do not match. Each user's first Gmail connection gets its own copy of the first seeded
 * mailbox, the second of the second, so a spec knows which account holds which mail and no other
 * user's spec can change it. `gmailFor` returns one user's accounts under the seeded names.
 */
export function createE2eComposio(
  mailboxes: () => Record<string, { address: string; messages: EmulatedMessage[] }> = e2eMailboxes,
  options: {
    /** A send to the user's other connected address lands in that Inbox, as with real Gmail. */
    deliverBetweenOwnAccounts?: boolean;
    /** A send to an address on this domain fails, as Gmail rejects an invalid recipient. */
    bounceDomain?: string;
  } = {},
): ComposioEmulator & {
  gmailFor(userId: string): E2eGmailSnapshot;
  /** Delivers a message to every user's copy of a seeded mailbox, as if it arrived just now. */
  deliver(seededName: string, message: EmulatedMessage): void;
} {
  const gmail = new GmailApiEmulator({ mailboxes: mailboxes() });
  const seeded = gmail.accountRefs();
  const refsByUser = new Map<string, string[]>();
  return new (class extends ComposioEmulator {
    override async begin(...args: Parameters<ComposioEmulator["begin"]>) {
      const result = await super.begin(...args);
      if (args[0].provider === "GMAIL") {
        const refs = refsByUser.get(args[1].userId) ?? [];
        const target = seeded[refs.length];
        const fresh = target ? mailboxes()[target] : undefined;
        if (target && fresh) {
          gmail.isolate(result.state, target, fresh);
          refs.push(result.state);
          refsByUser.set(args[1].userId, refs);
        }
      }
      return result;
    }

    override async proxy(request: ConnectorProxyRequest) {
      const sending = request.method === "POST" && /\/drafts\/send(\?|$)/.test(request.url);
      const id = (request.body as { id?: unknown } | undefined)?.id;
      const draft = sending
        ? gmail.draftsOf(request.accountRef).find((item) => item.id === id)
        : undefined;
      const mime = draft ? parseRawMime(draft.raw) : undefined;
      const recipients = ["To", "Cc", "Bcc"]
        .map((name) => mime?.header(name) ?? "")
        .join(",")
        .toLowerCase();
      if (options.bounceDomain && recipients.includes(`@${options.bounceDomain.toLowerCase()}`)) {
        const message = "Invalid To header";
        return {
          status: 400,
          data: { error: { code: 400, message, errors: [{ reason: "invalidArgument", message }] } },
        };
      }
      const response = await super.proxy(request);
      if (mime && response.status === 200 && options.deliverBetweenOwnAccounts) {
        const own = [...refsByUser.values()].find((refs) => refs.includes(request.accountRef));
        const from = gmail.addressOf(request.accountRef) ?? "";
        for (const ref of own ?? []) {
          const address = gmail.addressOf(ref);
          if (ref === request.accountRef || !address || !recipients.includes(address.toLowerCase()))
            continue;
          gmail.addMessage(ref, {
            id: `in-${ref}-${Date.now()}`,
            date: new Date().toISOString(),
            labels: ["INBOX", "UNREAD"],
            from,
            to: mime.header("To") ?? address,
            ...(mime.header("Cc") ? { cc: mime.header("Cc") } : {}),
            subject: mime.header("Subject") ?? "",
            ...(mime.text === undefined ? {} : { text: mime.text }),
            ...(mime.html === undefined ? {} : { html: mime.html }),
          });
        }
      }
      return response;
    }

    deliver(seededName: string, message: EmulatedMessage) {
      const index = seeded.indexOf(seededName);
      for (const refs of refsByUser.values()) {
        const ref = refs[index];
        if (ref) gmail.addMessage(ref, message);
      }
    }

    gmailFor(userId: string): E2eGmailSnapshot {
      const all = gmail.snapshot();
      const refs = refsByUser.get(userId) ?? [];
      return Object.fromEntries(
        refs.flatMap((ref, index) => {
          const name = seeded[index];
          const own = all[ref];
          return name && own ? [[name, own] as const] : [];
        }),
      );
    }
  })(undefined, gmail);
}
