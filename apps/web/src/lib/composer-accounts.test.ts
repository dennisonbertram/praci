import { expect, it, vi } from "vitest";
import type { ComposerDraft } from "../components/BotToolControls";
import { recoverComposerDraft } from "./composer-accounts";

const draft: ComposerDraft = {
  connectionId: "",
  account: "",
  to: ["a@example.test"],
  cc: [],
  bcc: [],
  subject: "Hi",
  body: "Hello",
};
const accounts = [{ connectionId: "c1", label: "Work", address: "me@example.test" }];

it("asks for the thread's own Space and fills the first account", async () => {
  const list = vi.fn().mockResolvedValue({ accounts });
  const out = await recoverComposerDraft(draft, "space-a", list, () => true);
  expect(list).toHaveBeenCalledWith("space-a");
  expect(out?.draft.connectionId).toBe("c1");
});

it("drops the answer when the user or Space changed meanwhile", async () => {
  let same = true;
  const list = vi.fn(async () => {
    same = false;
    return { accounts };
  });
  expect(await recoverComposerDraft(draft, "space-a", list, () => same)).toBeNull();
});

it("keeps the draft when the lookup fails, unless the Space changed", async () => {
  const list = vi.fn().mockRejectedValue(new Error("down"));
  expect((await recoverComposerDraft(draft, "space-a", list, () => true))?.draft).toBe(draft);
  expect(await recoverComposerDraft(draft, "space-a", list, () => false)).toBeNull();
});
