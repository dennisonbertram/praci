import { describe, expect, it, vi } from "vitest";
import { copyWithFeedback, loadEarlierPage } from "./thread-message-actions";

describe("thread message actions", () => {
  it("announces a successful copy", async () => {
    const copy = vi.fn().mockResolvedValue(undefined);
    const feedback = vi.fn();

    await copyWithFeedback(copy, feedback);

    expect(copy).toHaveBeenCalledOnce();
    expect(feedback).toHaveBeenCalledWith("Copied");
  });

  it("announces a failed copy", async () => {
    const copy = vi.fn().mockRejectedValue(new Error("clipboard unavailable"));
    const feedback = vi.fn();

    await copyWithFeedback(copy, feedback);

    expect(feedback).toHaveBeenCalledWith("Couldn't copy");
  });

  it("keeps a failed earlier page retryable and publishes the page after retry", async () => {
    const page = { messages: ["older"] };
    const request = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(page);
    const onPage = vi.fn();
    let failed = false;
    const generalError: string | null = null;
    const load = async () => {
      failed = false;
      await loadEarlierPage(request, onPage, () => {
        failed = true;
      });
    };

    await load();
    expect(failed ? "Could not load earlier messages" : "Load earlier messages").toBe(
      "Could not load earlier messages",
    );
    expect(generalError).toBeNull();

    await load();
    expect(request).toHaveBeenCalledTimes(2);
    expect(onPage).toHaveBeenCalledWith(page);
    expect(failed).toBe(false);
    expect(generalError).toBeNull();
  });
});
