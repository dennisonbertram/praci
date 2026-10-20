import { MAIL_PUSH_PATH } from "@rakazo/adapters";
import { getLogger } from "@rakazo/logging";
import type { Hono } from "hono";
import { readBoundedBody } from "./http-body.js";

export { MAIL_PUSH_PATH };

const MAX_BODY_BYTES = 64 * 1024;

/**
 * Receives Gmail push messages from a Pub/Sub push subscription. The request is verified before
 * anything else, and the message is used only to wake a sync for the mailbox it names: the
 * history id and every other field are ignored, because sync reads its own cursor.
 */
export function mountMailPushRoute(
  app: Hono,
  deps: {
    verify: (authorization: string | null | undefined) => Promise<boolean>;
    wake: (emailAddress: string) => Promise<number>;
  },
): void {
  app.post(MAIL_PUSH_PATH, async (c) => {
    if (!(await deps.verify(c.req.header("authorization"))))
      return c.json({ error: "Unauthorized" }, 401);
    const raw = await readBoundedBody(c.req.raw, MAX_BODY_BYTES);
    if (raw === null) return c.json({ error: "Payload too large" }, 413);

    const address = emailAddressOf(raw);
    // A signed but unreadable message is acknowledged, or Pub/Sub would deliver it for days.
    if (!address) {
      getLogger().warn("gmail push message could not be read");
      return c.body(null, 204);
    }
    try {
      await deps.wake(address);
    } catch (error) {
      // A non-2xx makes Pub/Sub deliver the message again.
      getLogger().error("gmail push wake failed", error);
      return c.json({ error: "Wake failed" }, 500);
    }
    return c.body(null, 204);
  });
}

function emailAddressOf(raw: string): string | undefined {
  try {
    const data = (JSON.parse(raw) as { message?: { data?: unknown } })?.message?.data;
    if (typeof data !== "string") return undefined;
    const address = (
      JSON.parse(Buffer.from(data, "base64").toString("utf8")) as { emailAddress?: unknown }
    )?.emailAddress;
    return typeof address === "string" && address ? address : undefined;
  } catch {
    return undefined;
  }
}
