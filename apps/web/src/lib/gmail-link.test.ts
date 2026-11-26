import { expect, it } from "vitest";
import { gmailThreadUrl } from "./gmail-link";

it("points at the account's thread, with /u/0/ and Drafts as fallbacks", () => {
  expect(gmailThreadUrl("me@example.test", "t2")).toBe(
    "https://mail.google.com/mail/u/me%40example.test/#all/t2",
  );
  expect(gmailThreadUrl(undefined, "t2")).toBe("https://mail.google.com/mail/u/0/#all/t2");
  expect(gmailThreadUrl("me@example.test", null)).toBe(
    "https://mail.google.com/mail/u/me%40example.test/#drafts",
  );
});
