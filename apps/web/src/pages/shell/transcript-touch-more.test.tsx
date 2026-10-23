import type { ThreadMessage } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (s: string) => s, i18n: { locale: "en" } }),
  Trans: () => null,
  Plural: () => null,
}));

import { isCardOnlyMessage, reachableMoreIds } from "./transcript";

const msg = (id: string, blocks: unknown[]) => ({ id, blocks }) as unknown as ThreadMessage;
const text = msg("text", [{ kind: "text", text: "hi" }]);
const card = msg("card", [{ kind: "choice" }]);
const mixed = msg("mixed", [{ kind: "text", text: "hi" }, { kind: "emails" }]);

describe("touch More button", () => {
  it("treats only messages made of cards as card-only", () => {
    expect(isCardOnlyMessage(card)).toBe(true);
    expect(isCardOnlyMessage(text)).toBe(false);
    expect(isCardOnlyMessage(mixed)).toBe(false);
  });

  it("drops hidden buttons from the tab stops on touch only", () => {
    const all = [text, card, mixed];
    expect(reachableMoreIds(all, true)).toEqual(["text", "mixed"]);
    expect(reachableMoreIds(all, false)).toEqual(["text", "card", "mixed"]);
  });
});
