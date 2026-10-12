import type { MailProvider } from "@rakazo/adapter-kit";
import type { MailEmulator } from "../gmail-api-emulator.js";

/** Behavior every MailProvider must show against a seeded Gmail emulator. */
export async function assertMailConformance(
  _provider: MailProvider,
  _emulator: Pick<MailEmulator, "gmail" | "accounts">,
): Promise<void> {
  throw new Error("not implemented");
}
