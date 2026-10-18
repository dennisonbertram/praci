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
  // Ownership figures from the Carta agent: percentages and share counts.
  [
    "You can still grant 600,000 options. Alex: 40% and River: 30%—70% combined",
    "You can still grant ••• options. Alex: •••% and River: •••%—•••% combined",
  ],
  ["4,000,000 shares, pool 15.00 %", "••• shares, pool •••%"],
])("masks %s", (input, expected) => expect(maskCurrencyText(input)).toBe(expected));

it.each([
  "12 transactions on Sep 5, 2026",
  "Q3 2026 and 2026",
  "12 options and 3 holders",
  "see https://example.com/a/1234567",
  "invoiceUSD1234.pdf",
  "100 usdt",
])("leaves %s alone", (input) => expect(maskCurrencyText(input)).toBe(input));
