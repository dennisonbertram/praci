import type { EmulatedMessage } from "@rakazo/adapters";
import { ComposioEmulator, GmailApiEmulator } from "@rakazo/adapters";

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/** Today's HTML message carries a script and a remote image; the page must run and load neither. */
const OFFSITE_HTML =
  '<p id="probe">Can you do the 14th or the 21st?</p>' +
  '<script>document.getElementById("probe").textContent = "script ran";</script>' +
  '<img alt="" src="https://example.invalid/pixel.png">';

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
      attachments: [{ filename: "q3-report.pdf", mimeType: "application/pdf", size: 20_480 }],
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

/**
 * ComposioEmulator mints connection refs like `GMAIL:7`, which GmailApiEmulator's seeded
 * mailboxes do not match. Map each user's first Gmail connection to the first seeded mailbox,
 * the second to the second, so a spec knows which account holds which mail.
 */
export function createE2eComposio(): ComposioEmulator {
  const gmail = new GmailApiEmulator({ mailboxes: e2eMailboxes() });
  const seeded = gmail.accountRefs();
  const connectedByUser = new Map<string, number>();
  return new (class extends ComposioEmulator {
    override async begin(...args: Parameters<ComposioEmulator["begin"]>) {
      const result = await super.begin(...args);
      if (args[0].provider === "GMAIL") {
        const userId = args[1].userId;
        const index = connectedByUser.get(userId) ?? 0;
        connectedByUser.set(userId, index + 1);
        const target = seeded[index];
        if (target) gmail.alias(result.state, target);
      }
      return result;
    }
  })(undefined, gmail);
}
