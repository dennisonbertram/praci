import type { ParsedStatement } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { checkStatement, createRuntimeExtract, parseStatement } from "./index.js";

const bytes = (s: string) => new TextEncoder().encode(s);
const parse = (fileName: string, body: string, deps = {}) =>
  parseStatement({ fileName, bytes: bytes(body) }, deps);

const OFX1 = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>USD
<BANKACCTFROM><BANKID>000111222<ACCTID>9876543210<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260301120000
<DTEND>20260331120000
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260305120000.000<TRNAMT>-12.34<FITID>A1<NAME>EXAMPLE COFFEE<MEMO>Card 1111</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260310<TRNAMT>1,000.10<FITID>A2<NAME>EXAMPLE PAYROLL</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>987.76<DTASOF>20260331</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
<SIGNONMSGSRSV1><SONRS><FI><ORG>Example Bank</ORG></FI></SONRS></SIGNONMSGSRSV1>
</OFX>`;

const OFX2 = `<?xml version="1.0"?><?OFX OFXHEADER="200" VERSION="211"?>
<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><CCACCTFROM><ACCTID>4111111111114321</ACCTID></CCACCTFROM>
<BANKTRANLIST><DTSTART>20260101</DTSTART><DTEND>20260131</DTEND>
<STMTTRN><DTPOSTED>20260102</DTPOSTED><TRNAMT>-45.00</TRNAMT><FITID>X9</FITID><NAME>EXAMPLE &amp; SONS</NAME></STMTTRN>
<STMTTRN><DTPOSTED>20260120</DTPOSTED><TRNAMT>20.00</TRNAMT><FITID>X10</FITID><NAME>PAYMENT</NAME></STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>-25.00</BALAMT><DTASOF>20260131</DTASOF></LEDGERBAL></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1>
<SIGNONMSGSRSV1><SONRS><FI><ORG>Example Card</ORG></FI></SONRS></SIGNONMSGSRSV1></OFX>`;

describe("OFX", () => {
  it("reads 1.x SGML: signs, FITID, last4 only, period, closing", async () => {
    const { statement, check } = await parse("export.ofx", OFX1);
    expect(statement).toMatchObject({
      parser: "ofx",
      institution: "Example Bank",
      accountLast4: "3210",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
      openingBalanceCents: null,
      closingBalanceCents: 98776,
    });
    expect(
      statement.transactions.map((t) => [t.date, t.amountCents, t.externalId, t.description]),
    ).toEqual([
      ["2026-03-05", -1234, "A1", "EXAMPLE COFFEE - Card 1111"],
      ["2026-03-10", 100010, "A2", "EXAMPLE PAYROLL"],
    ]);
    expect(JSON.stringify(statement)).not.toContain("9876543210");
    expect(check.balances).toBe("unavailable");
    expect(statement.accountKind).toBe("checking");
  });

  it("reads savings accounts as savings", async () => {
    const { statement } = await parse("s.ofx", OFX1.replace("CHECKING", "SAVINGS"));
    expect(statement.accountKind).toBe("savings");
  });

  it("rejects a non-USD statement, by CURDEF or by a transaction's currency", async () => {
    await expect(parse("eur.ofx", OFX1.replace("<CURDEF>USD", "<CURDEF>EUR"))).rejects.toThrow(
      "Only USD",
    );
    const foreignTxn = OFX1.replace(
      "<TRNAMT>-12.34",
      "<TRNAMT>-12.34<CURRENCY><CURRATE>0.9<CURSYM>EUR</CURRENCY>",
    );
    await expect(parse("eur2.ofx", foreignTxn)).rejects.toThrow("EUR");
    const usdTxn = OFX1.replace(
      "<TRNAMT>-12.34",
      "<TRNAMT>-12.34<CURRENCY><CURRATE>1<CURSYM>USD</CURRENCY>",
    );
    await expect(parse("usd.ofx", usdTxn)).resolves.toBeTruthy();
  });

  it("reads 2.x XML credit card statements", async () => {
    const { statement } = await parse("card.qfx", OFX2);
    expect(statement.accountLast4).toBe("4321");
    expect(statement.accountKind).toBe("card");
    expect(statement.closingBalanceCents).toBe(-2500);
    expect(statement.transactions.map((t) => [t.amountCents, t.externalId, t.description])).toEqual(
      [
        [-4500, "X9", "EXAMPLE & SONS"],
        [2000, "X10", "PAYMENT"],
      ],
    );
  });
});

describe("CSV", () => {
  it("maps an Amount column, reads running balances, derives institution from the file name", async () => {
    const { statement, check } = await parse(
      "example_bank_march.csv",
      'Posting Date,Description,Amount,Balance\n2026-03-02,EXAMPLE COFFEE,-5.50,94.50\n2026-03-03,EXAMPLE PAYROLL,"1,000.00",1094.50\n',
    );
    expect(statement).toMatchObject({
      institution: "example bank",
      openingBalanceCents: 10000,
      closingBalanceCents: 109450,
    });
    expect(statement.warnings.join()).toContain("file name");
    expect(check).toEqual({ balances: "match", differenceCents: 0 });
  });

  it("names the institution from the file name without dates or copy markers", async () => {
    const body = "Date,Description,Amount\n2026-03-02,Coffee,-5.00\n";
    const names = [
      "checking-2026-07.csv",
      "checking_2026-08-31.csv",
      "Checking (1).csv",
      "checking copy.csv",
      "Checking July 2026.csv",
      "checking 08-2026.csv",
      "checking-20260731.csv",
    ];
    for (const name of names) {
      expect((await parse(name, body)).statement.institution).toBe("checking");
    }
    expect((await parse("savings-2026-07.csv", body)).statement.institution).toBe("savings");
    // A name that is only a date keeps something to show.
    expect((await parse("2026-07.csv", body)).statement.institution).toBeTruthy();
  });

  it("maps Debit/Credit columns with semicolons and flips newest-first files", async () => {
    const { statement } = await parse(
      "x.csv",
      "Transaction Date;Payee;Debit;Credit\n25/03/2026;EXAMPLE RENT;800.00;\n02/03/2026;EXAMPLE PAYROLL;;1500.00\n",
    );
    expect(statement.transactions.map((t) => [t.date, t.amountCents])).toEqual([
      ["2026-03-02", 150000],
      ["2026-03-25", -80000],
    ]);
    expect(statement.warnings.join()).not.toContain("ambiguous");
    expect(statement.openingBalanceCents).toBeNull();
  });

  it("warns when day/month order cannot be known", async () => {
    const { statement } = await parse(
      "x.csv",
      "Date,Description,Amount\n03/04/2026,EXAMPLE,-1.00\n",
    );
    expect(statement.transactions[0]!.date).toBe("2026-03-04");
    expect(statement.warnings.join()).toContain("ambiguous");
  });
});

// Invented statement text in the layout of a Wells Fargo business checking statement.
function fakeWellsFargo(opts: { closing: string; pageBreak?: boolean }) {
  const row = (d: string, desc: string, credit: string, debit: string, bal: string) =>
    `      ${d.padEnd(8)}${" ".repeat(10)}${desc.padEnd(60)}${credit.padStart(12)}${debit.padStart(14)}${bal.padStart(14)}`;
  const heading = `      Date      Number Description${" ".repeat(46)}${"Credits".padStart(12)}${"Debits".padStart(14)}${"balance".padStart(14)}`;
  return [
    "Navigate Business Checking SM",
    "March 31, 2026      Page 1 of 3",
    "Statement period activity summary                 Account number: 1234567890 (primary account)",
    "        Beginning balance on 3/1                       $1,000.00        EXAMPLE CORP",
    `        Ending balance on 3/31                         $${opts.closing}        123 Example St`,
    "Wells Fargo Bank, N.A.",
    "Transaction history",
    `                Check${" ".repeat(60)}${"Deposits/".padStart(12)}${"Withdrawals/".padStart(14)}${"Ending daily".padStart(14)}`,
    heading,
    row("3/2", "Example Transfer Ex-0001 Example Corp", "500.00", "", "1,500.00"),
    row("3/5", "WT 000001-000002 Example Bank /Bnf=Example Vendor", "", "250.25", "1,249.75"),
    `${" ".repeat(32)}Insurance Agency Ref# 0001`,
    `${" ".repeat(32)}Trn#0000001 Rfb# 0002`,
    ...(opts.pageBreak
      ? [
          "March 31, 2026      Page 2 of 3",
          "",
          "Transaction history (continued)",
          "Navigate Business Checking SM",
          heading,
        ]
      : []),
    row("3/20", "1042   Example Landlord", "", "100.00", "1,149.75"),
    row("3/31", "Interest Payment", "0.50", "", "1,150.25"),
    `      Totals${" ".repeat(60)}${"$500.50".padStart(12)}${"$350.25".padStart(14)}`,
    "      The Ending Daily Balance does not reflect any pending withdrawals.",
    "Monthly service fee summary",
  ].join("\n");
}

describe("Wells Fargo PDF", () => {
  const run = (text: string) =>
    parseStatement({ fileName: "s.pdf", bytes: bytes("%PDF-1.7") }, { pdfText: async () => text });

  it("reads columns, multi-line descriptions, check numbers, page breaks, and matches", async () => {
    const { statement, check } = await run(
      fakeWellsFargo({ closing: "1,150.25", pageBreak: true }),
    );
    expect(statement).toMatchObject({
      parser: "wells-fargo-pdf",
      accountName: "Navigate Business Checking",
      accountLast4: "7890",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
      openingBalanceCents: 100000,
      closingBalanceCents: 115025,
      warnings: [],
    });
    expect(statement.transactions.map((t) => [t.date, t.amountCents, t.balanceCents])).toEqual([
      ["2026-03-02", 50000, 150000],
      ["2026-03-05", -25025, 124975],
      ["2026-03-20", -10000, 114975],
      ["2026-03-31", 50, 115025],
    ]);
    expect(statement.transactions[1]!.description).toBe(
      "WT 000001-000002 Example Bank /Bnf=Example Vendor Insurance Agency Ref# 0001 Trn#0000001 Rfb# 0002",
    );
    expect(statement.transactions[2]!.description).toBe("Check 1042 Example Landlord");
    expect(check).toEqual({ balances: "match", differenceCents: 0 });
  });

  it("drops the '<' footnote marker and ignores the legend line", async () => {
    const text = fakeWellsFargo({ closing: "1,150.25" })
      .replace(
        "Example Transfer Ex-0001 Example Corp",
        "<  Business to Business ACH Debit".padEnd(37),
      )
      .replace(
        "      Totals",
        `${" ".repeat(32)}<  Business to Business ACH: If this is a business account, this transaction has a return time frame of one business day.\n      Totals`,
      );
    const { statement } = await run(text);
    expect(statement.warnings).toEqual([]);
    expect(statement.transactions).toHaveLength(4);
    expect(statement.transactions[0]!.description).toBe("Business to Business ACH Debit");
    expect(statement.transactions[3]!.description).toBe("Interest Payment");
  });

  it("reports a mismatch when the ending balance disagrees", async () => {
    const { check } = await run(fakeWellsFargo({ closing: "1,160.25" }));
    expect(check).toEqual({ balances: "mismatch", differenceCents: 1000 });
  });

  it("warns at the first line whose running balance breaks", async () => {
    const text = fakeWellsFargo({ closing: "1,150.25" }).replace("1,249.75", "1,200.00");
    const { statement } = await run(text);
    expect(statement.warnings).toEqual(["Running balance breaks at line 2 (2026-03-05)."]);
  });
});

describe("model-read PDF", () => {
  const pdf = (extract: (t: string, s: object) => Promise<unknown>) =>
    parseStatement(
      { fileName: "other.pdf", bytes: bytes("%PDF-1.7") },
      { pdfText: async () => "Some Other Bank statement\nBalance $900.00", extract },
    );
  const read = {
    institution: "Other Bank",
    accountName: null,
    accountLast4: "1111",
    periodStart: "2026-02-01",
    periodEnd: "2026-02-28",
    openingBalanceCents: 1000,
    closingBalanceCents: 900,
    transactions: [
      {
        date: "2026-02-03",
        description: "EXAMPLE",
        amountCents: -50,
        balanceCents: null,
        externalId: null,
      },
    ],
  };

  it("validates the model's JSON, flags it as model-read and still checks balances", async () => {
    const seen: object[] = [];
    const { statement, check } = await pdf(async (_t, s) => {
      seen.push(s);
      return read;
    });
    expect(seen[0]).toMatchObject({ type: "object" });
    expect(statement.parser).toBe("model-pdf");
    expect(statement.warnings[0]).toContain("AI model");
    expect(check).toEqual({ balances: "mismatch", differenceCents: -50 });
  });

  it("rejects a statement the model reports in another currency", async () => {
    await expect(pdf(async () => ({ ...read, currency: "eur" }))).rejects.toThrow(
      "This statement is in EUR. Only USD statements can be imported.",
    );
    const usd = await pdf(async () => ({ ...read, currency: "USD" }));
    expect(usd.statement.currency).toBe("USD");
  });

  it("without a model currency, needs a $ or USD in the text", async () => {
    const noSign = (text: string) =>
      parseStatement(
        { fileName: "o.pdf", bytes: bytes("%PDF-1.7") },
        { pdfText: async () => text, extract: async () => read },
      );
    await expect(noSign("Some Other Bank\nBalance 900,00 EUR")).rejects.toThrow("USD");
    await expect(noSign("Some Other Bank\nBalance 900.00")).rejects.toThrow("USD");
    await expect(noSign("Some Other Bank\nBalance USD 900.00")).resolves.toBeTruthy();
    await expect(noSign("Some Other Bank\nBalance $900.00")).resolves.toBeTruthy();
  });

  it("fails clearly on invalid model output or a missing model", async () => {
    await expect(pdf(async () => ({ institution: "x" }))).rejects.toThrow("model's reading");
    await expect(
      parseStatement(
        { fileName: "o.pdf", bytes: bytes("%PDF-1") },
        { pdfText: async () => "text" },
      ),
    ).rejects.toThrow("No model");
  });

  it("createRuntimeExtract parses the model's answer and rejects invalid JSON", async () => {
    const runtimeWith = (text: string) =>
      ({
        run: async function* () {
          yield { type: "done", text };
        },
      }) as never;
    const ctx = { spaceId: "s", userId: "u" } as never;
    const extract = createRuntimeExtract(runtimeWith('Here:\n{"a":1}'), {} as never, ctx);
    expect(await extract("t", {})).toEqual({ a: 1 });
    await expect(
      createRuntimeExtract(runtimeWith("{nope}"), {} as never, ctx)("t", {}),
    ).rejects.toThrow("invalid JSON");
  });
});

describe("registry", () => {
  it("prefers the Wells Fargo parser over the model fallback, and rejects unknown files", async () => {
    const deps = {
      pdfText: async () => fakeWellsFargo({ closing: "1,150.25" }),
      extract: async () => {
        throw new Error("model used");
      },
    };
    expect(
      (await parseStatement({ fileName: "a.pdf", bytes: bytes("%PDF-1.4") }, deps)).statement
        .parser,
    ).toBe("wells-fargo-pdf");
    await expect(parse("notes.txt", "hello world")).rejects.toThrow("not supported");
  });

  it("checkStatement is unavailable without an opening balance", () => {
    const base = { transactions: [], warnings: [] } as unknown as ParsedStatement;
    expect(
      checkStatement({ ...base, openingBalanceCents: null, closingBalanceCents: 5 }).balances,
    ).toBe("unavailable");
  });
});
