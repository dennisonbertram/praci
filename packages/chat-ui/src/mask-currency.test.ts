import { expect, it } from "vitest";
import { maskCurrencyText } from "./mask-currency";

it.each([
  ["You spent $73,781.83 in Sep", "You spent $••• in Sep"],
  ["raised $1.2M and $450k", "raised $••• and $•••"],
  ["check size $250K–500K", "check size $•••–•••"],
  ["check size $250K - 500K", "check size $••• - •••"],
  ["check size €250.000,00–500.000,00", "check size €•••–•••"],
  ["check size $2K–3,500.50", "check size $•••–•••"],
  ["check size $250K to 500K", "check size $••• to •••"],
  ["check size $250K–50%", "check size $•••–50%"],
  ["check size $250K—$500K", "check size $•••—$•••"],
  ["down -$300 or $-1,234.56", "down -$••• or $•••"],
  ["€2,000 £5 ¥900 ₹73,781.83", "€••• £••• ¥••• ₹•••"],
  ["€1.234,56 and €1 234,56", "€••• and €•••"],
  ["USD 1,200 due, usd 5", "$••• due, $•••"],
  ["1,200 USD or 1.234,56 EUR", "$••• or $•••"],
  ["1 234,56 € and 1,200 ¥ or 900 ₹", "€••• and ¥••• or ₹•••"],
  ["-1.234,56 €", "-€•••"],
  ["$2 million", "$•••"],
  ["$50, paid. And $73,781.83.", "$•••, paid. And $•••."],
  // Share counts written with thousands groups.
  ["You can still grant 600,000 options.", "You can still grant ••• options."],
  ["4,000,000 shares", "••• shares"],
])("masks %s", (input, expected) => expect(maskCurrencyText(input)).toBe(expected));

it.each([
  "12 transactions on Sep 5, 2026",
  "Q3 2026 and 2026",
  "12 options and 3 holders",
  "see https://example.com/a/1234567",
  "invoiceUSD1234.pdf",
  "100 usdt",
  "12–24 months of runway",
  "250K–500K options",
])("leaves %s alone", (input) => expect(maskCurrencyText(input)).toBe(input));

// Hide amounts covers money only: runway, run-out dates and ownership percentages stay readable.
it.each([
  "You have 24.2 months of runway, so cash would run out around July 23, 2027.",
  "Runway: 9.2 months (cash runs out July 2027)",
  "Run-out date: 2027-07-23",
  "Alex: 40% and River: 30%, pool 15.00 %",
  "24.2 mo",
])("leaves runway and percentages alone: %s", (input) =>
  expect(maskCurrencyText(input)).toBe(input),
);

it("masks a pin's money and keeps its months", () => {
  expect(maskCurrencyText("$1,234.50")).toBe("$•••");
  expect(maskCurrencyText("9.2 mo")).toBe("9.2 mo");
});
