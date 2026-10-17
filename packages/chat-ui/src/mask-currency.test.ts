import { expect, it } from "vitest";
import { maskCurrencyText } from "./mask-currency";

it.each([
  ["You spent $73,781.83 in Sep", "You spent $••• in Sep"],
  ["raised $1.2M and $450k", "raised $••• and $•••"],
  ["down -$300 or $-1,234.56", "down -$••• or $•••"],
  ["€2,000 £5 ¥900 ₹73,781.83", "€••• £••• ¥••• ₹•••"],
  ["€1.234,56 and €1 234,56", "€••• and €•••"],
  ["USD 1,200 due, usd 5", "$••• due, $•••"],
  ["1,200 USD or 1.234,56 EUR or 1 234,56 €", "$••• or $••• or $•••"],
  ["$2 million", "$•••"],
  ["$50, paid. And $73,781.83.", "$•••, paid. And $•••."],
])("masks %s", (input, expected) => expect(maskCurrencyText(input)).toBe(expected));

it.each([
  "12 transactions on Sep 5, 2026",
  "Q3 2026 and 2026",
  "4,000,000 shares",
  "see https://example.com/a/1234567",
  "invoiceUSD1234.pdf",
  "100 usdt",
])("leaves %s alone", (input) => expect(maskCurrencyText(input)).toBe(input));

it.each([
  [
    "You have 9.2 months of runway, so cash would run out around July 23, 2027.",
    "You have ••• months of runway, so cash would run out around •••.",
  ],
  ["Runway: 9.2 months (cash runs out July 2027)", "Runway: ••• months (cash runs out •••)"],
  ["Runway is 14 mo.", "Runway is ••• mo."],
  ["Run-out date: 2027-07-23", "Run-out date: •••"],
])("masks the runway figures in %s", (input, expected) =>
  expect(maskCurrencyText(input)).toBe(expected),
);

it.each([
  "Payroll went up 3 months ago.",
  "The board meets on July 23, 2027.",
  "Runway work starts Monday. It took 3 months.",
])("leaves months and dates outside a runway sentence alone: %s", (input) =>
  expect(maskCurrencyText(input)).toBe(input),
);
