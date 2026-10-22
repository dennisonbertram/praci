import { expect, it } from "vitest";
import { emailCompliance } from "./email-compliance";

it("requires an unsubscribe instruction and a postal address", () => {
  expect(emailCompliance("Join our beta.")).toEqual({ unsubscribe: false, postalAddress: false });
  expect(emailCompliance("Reply unsubscribe to stop these emails.")).toEqual({
    unsubscribe: true,
    postalAddress: false,
  });
  expect(emailCompliance("123 Example Street, Sample City, CA 90210")).toEqual({
    unsubscribe: false,
    postalAddress: true,
  });
  expect(
    emailCompliance(
      "Reply unsubscribe to stop these emails.\n123 Example Street, Sample City, CA 90210",
    ),
  ).toEqual({ unsubscribe: true, postalAddress: true });
});

it("recognises unsubscribe links and explicit founder-supplied international addresses", () => {
  expect(
    emailCompliance(
      "Unsubscribe: https://example.com/unsubscribe\nPostal address: 1 Example Street, Sample City, Ireland",
    ),
  ).toEqual({ unsubscribe: true, postalAddress: true });
  expect(emailCompliance("You cannot unsubscribe.\nPostal address:")).toEqual({
    unsubscribe: false,
    postalAddress: false,
  });
});
