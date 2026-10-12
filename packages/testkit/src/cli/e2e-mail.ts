import type { EmulatedMessage } from "@rakazo/adapters";
import { ComposioEmulator, GmailApiEmulator } from "@rakazo/adapters";

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
