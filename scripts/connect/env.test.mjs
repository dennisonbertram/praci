import { describe, expect, it } from "vitest";
import { mergeConnectEnv, parseConnectEnv } from "./env.mjs";

const parseEnv = parseConnectEnv;
const origin = "https://my-mac.example.ts.net";
const host = "my-mac.example.ts.net";

function merge(text, shellEnv = {}) {
  return mergeConnectEnv(text, origin, host, { shellEnv, parseEnv });
}

describe("mergeConnectEnv", () => {
  it("uses the repository dotenv parser by default", () => {
    expect(mergeConnectEnv("", origin, host)).toEqual({
      text: `RAKAZO_TRUSTED_ORIGINS=${origin}\nRAKAZO_ALLOWED_HOSTS=${host}`,
      lines: [`RAKAZO_TRUSTED_ORIGINS=${origin}`, `RAKAZO_ALLOWED_HOSTS=${host}`],
    });
  });

  it("adds both settings to an empty file", () => {
    expect(merge("")).toEqual({
      text: `RAKAZO_TRUSTED_ORIGINS=${origin}\nRAKAZO_ALLOWED_HOSTS=${host}`,
      lines: [`RAKAZO_TRUSTED_ORIGINS=${origin}`, `RAKAZO_ALLOWED_HOSTS=${host}`],
    });
  });

  it("appends one missing origin and host without changing other lines or comments", () => {
    const input =
      "# retained comment\n\nWEB_ORIGIN=http://web.example.test\nRAKAZO_TRUSTED_ORIGINS=https://a.example.test\n# retained tail\n";
    const result = merge(input);

    expect(result.text).toBe(
      `# retained comment\n\nWEB_ORIGIN=http://web.example.test\nRAKAZO_TRUSTED_ORIGINS=https://a.example.test,${origin}\n# retained tail\nRAKAZO_ALLOWED_HOSTS=${host}\n`,
    );
    expect(result.lines).toEqual([
      `RAKAZO_TRUSTED_ORIGINS=https://a.example.test,${origin}`,
      `RAKAZO_ALLOWED_HOSTS=${host}`,
    ]);
  });

  it("appends after many values and preserves inline comments", () => {
    const input = `RAKAZO_TRUSTED_ORIGINS=https://a.example.test,https://b.example.test # keep this\nRAKAZO_ALLOWED_HOSTS=a.example.test,b.example.test`;
    const result = merge(input);

    expect(result.text).toBe(
      `RAKAZO_TRUSTED_ORIGINS=https://a.example.test,https://b.example.test,${origin} # keep this\nRAKAZO_ALLOWED_HOSTS=a.example.test,b.example.test,${host}`,
    );
    expect(result.lines).toEqual([
      `RAKAZO_TRUSTED_ORIGINS=https://a.example.test,https://b.example.test,${origin}`,
      `RAKAZO_ALLOWED_HOSTS=a.example.test,b.example.test,${host}`,
    ]);
  });

  it("uses dotenv compact-comment parsing and never prints comment text", () => {
    const input =
      "RAKAZO_TRUSTED_ORIGINS=https://old.example.test#synthetic-comment-secret\nRAKAZO_ALLOWED_HOSTS=old.example.test#synthetic-host-comment\n";
    const result = merge(input);

    expect(result.text).toBe(
      `RAKAZO_TRUSTED_ORIGINS=https://old.example.test,${origin}#synthetic-comment-secret\nRAKAZO_ALLOWED_HOSTS=old.example.test,${host}#synthetic-host-comment\n`,
    );
    expect(result.lines).toEqual([
      `RAKAZO_TRUSTED_ORIGINS=https://old.example.test,${origin}`,
      `RAKAZO_ALLOWED_HOSTS=old.example.test,${host}`,
    ]);
    expect(result.lines.join("\n")).not.toContain("synthetic");
  });

  it("preserves quoted values and backticks while returning comment-free assignments", () => {
    const input =
      'RAKAZO_TRUSTED_ORIGINS="https://old.example.test" # synthetic-origin-comment\nRAKAZO_ALLOWED_HOSTS=`old.example.test` # synthetic-host-comment\n';
    const result = merge(input);

    expect(result.text).toBe(
      `RAKAZO_TRUSTED_ORIGINS="https://old.example.test,${origin}" # synthetic-origin-comment\n` +
        `RAKAZO_ALLOWED_HOSTS=\`old.example.test,${host}\` # synthetic-host-comment\n`,
    );
    expect(result.lines).toEqual([
      `RAKAZO_TRUSTED_ORIGINS=https://old.example.test,${origin}`,
      `RAKAZO_ALLOWED_HOSTS=old.example.test,${host}`,
    ]);
    expect(result.lines.join("\n")).not.toContain("synthetic");
  });

  it("does not treat target-looking lines inside unrelated multiline values as assignments", () => {
    const input = [
      'OTHER="first',
      "RAKAZO_TRUSTED_ORIGINS=https://inside.example.test",
      "RAKAZO_ALLOWED_HOSTS=inside.example.test",
      "last",
      '"',
      "",
    ].join("\n");
    const result = merge(input);

    expect(result.text).toBe(
      `${input}RAKAZO_TRUSTED_ORIGINS=${origin}\nRAKAZO_ALLOWED_HOSTS=${host}\n`,
    );
    expect(parseEnv(result.text).OTHER).toBe(parseEnv(input).OTHER);
    expect(result.lines).toEqual([
      `RAKAZO_TRUSTED_ORIGINS=${origin}`,
      `RAKAZO_ALLOWED_HOSTS=${host}`,
    ]);
  });

  it("updates only the effective duplicate assignment", () => {
    const input =
      "RAKAZO_TRUSTED_ORIGINS=https://first.example.test\nRAKAZO_TRUSTED_ORIGINS=https://last.example.test\nRAKAZO_ALLOWED_HOSTS=old.example.test\n";
    const result = merge(input);

    expect(result.text).toBe(
      `RAKAZO_TRUSTED_ORIGINS=https://first.example.test\nRAKAZO_TRUSTED_ORIGINS=https://last.example.test,${origin}\nRAKAZO_ALLOWED_HOSTS=old.example.test,${host}\n`,
    );
    expect(result.lines).toEqual([
      `RAKAZO_TRUSTED_ORIGINS=https://last.example.test,${origin}`,
      `RAKAZO_ALLOWED_HOSTS=old.example.test,${host}`,
    ]);
  });

  it("adds values to empty assignments", () => {
    const input = "RAKAZO_TRUSTED_ORIGINS=\nRAKAZO_ALLOWED_HOSTS=\n";
    expect(merge(input)).toEqual({
      text: `RAKAZO_TRUSTED_ORIGINS=${origin}\nRAKAZO_ALLOWED_HOSTS=${host}\n`,
      lines: [`RAKAZO_TRUSTED_ORIGINS=${origin}`, `RAKAZO_ALLOWED_HOSTS=${host}`],
    });
  });

  it("does not duplicate settings already present", () => {
    const input = `RAKAZO_TRUSTED_ORIGINS=https://a.example.test,${origin}\nRAKAZO_ALLOWED_HOSTS=other.example.test,${host}\n`;
    expect(merge(input)).toEqual({ text: input, lines: [] });
  });

  it("is unchanged after the merged text is applied a second time", () => {
    const first = merge("");
    expect(merge(first.text)).toEqual({ text: first.text, lines: [] });
  });

  it("does not rewrite invalid existing origins", () => {
    const input =
      "RAKAZO_TRUSTED_ORIGINS=https://a.example.test/path\nRAKAZO_ALLOWED_HOSTS=old.example.test\n";
    expect(merge(input)).toEqual({
      text: input,
      lines: [],
      error: "RAKAZO_TRUSTED_ORIGINS",
    });
  });

  it.each(["\n", "\t", " "])("rejects origins ending in %j before URL normalization", (suffix) => {
    const invalidOrigin = `${origin}${suffix}`;
    expect(new URL(invalidOrigin).origin).toBe(origin);
    expect(mergeConnectEnv("", invalidOrigin, host)).toEqual({
      text: "",
      lines: [],
      error: "RAKAZO_TRUSTED_ORIGINS",
    });
  });

  it("rejects control characters embedded in configured origins", () => {
    const input = `RAKAZO_TRUSTED_ORIGINS="${origin}\n"\n`;
    expect(merge(input)).toEqual({
      text: input,
      lines: [],
      error: "RAKAZO_TRUSTED_ORIGINS",
    });
  });

  it("rejects credential-looking allowed hosts without returning their values", () => {
    const input = `RAKAZO_TRUSTED_ORIGINS=${origin}\nRAKAZO_ALLOWED_HOSTS=user:synthetic-password@host.example.test\n`;
    const result = merge(input);

    expect(result).toEqual({ text: input, lines: [], error: "RAKAZO_ALLOWED_HOSTS" });
    expect(JSON.stringify({ lines: result.lines, error: result.error })).not.toContain(
      "synthetic-password",
    );
  });

  it("fails closed for multiline target assignments", () => {
    const input = `RAKAZO_TRUSTED_ORIGINS=${origin}\nRAKAZO_ALLOWED_HOSTS="one.example.test,\ntwo.example.test"\n`;
    const result = merge(input);

    expect(result).toEqual({
      text: input,
      lines: [],
      error: "unsupported:RAKAZO_ALLOWED_HOSTS",
    });
    expect(JSON.stringify({ lines: result.lines, error: result.error })).not.toContain(
      "one.example.test",
    );
  });

  it("preserves CRLF line endings", () => {
    const input = `# keep\r\nRAKAZO_TRUSTED_ORIGINS=https://a.example.test\r\n`;
    expect(merge(input).text).toBe(
      `# keep\r\nRAKAZO_TRUSTED_ORIGINS=https://a.example.test,${origin}\r\nRAKAZO_ALLOWED_HOSTS=${host}\r\n`,
    );
  });

  it("preserves the absence of a trailing newline", () => {
    const input = "WEB_ORIGIN=http://web.example.test";
    expect(merge(input).text).toBe(
      `WEB_ORIGIN=http://web.example.test\nRAKAZO_TRUSTED_ORIGINS=${origin}\nRAKAZO_ALLOWED_HOSTS=${host}`,
    );
  });

  it("writes missing file values even when the shell already contains the target", () => {
    expect(
      merge("", {
        RAKAZO_TRUSTED_ORIGINS: origin,
        RAKAZO_ALLOWED_HOSTS: host,
      }),
    ).toEqual({
      text: `RAKAZO_TRUSTED_ORIGINS=${origin}\nRAKAZO_ALLOWED_HOSTS=${host}`,
      lines: [`RAKAZO_TRUSTED_ORIGINS=${origin}`, `RAKAZO_ALLOWED_HOSTS=${host}`],
      shellNotes: [
        `Shell value (takes precedence over .env): RAKAZO_TRUSTED_ORIGINS=${origin}`,
        `Shell value (takes precedence over .env): RAKAZO_ALLOWED_HOSTS=${host}`,
      ],
    });
  });

  it("writes file targets and notes valid shell values that lack those targets", () => {
    const shellEnv = {
      RAKAZO_TRUSTED_ORIGINS: "https://shell.example.test",
      RAKAZO_ALLOWED_HOSTS: "shell.example.test",
    };
    expect(merge("", shellEnv)).toEqual({
      text: `RAKAZO_TRUSTED_ORIGINS=${origin}\nRAKAZO_ALLOWED_HOSTS=${host}`,
      lines: [`RAKAZO_TRUSTED_ORIGINS=${origin}`, `RAKAZO_ALLOWED_HOSTS=${host}`],
      shellNotes: [
        "Shell value (takes precedence over .env): RAKAZO_TRUSTED_ORIGINS=https://shell.example.test",
        "Shell value (takes precedence over .env): RAKAZO_ALLOWED_HOSTS=shell.example.test",
      ],
    });
  });

  it("does not rewrite when both file and shell values already contain the targets", () => {
    const input = `RAKAZO_TRUSTED_ORIGINS=${origin}\nRAKAZO_ALLOWED_HOSTS=${host}\n`;
    expect(
      merge(input, {
        RAKAZO_TRUSTED_ORIGINS: origin,
        RAKAZO_ALLOWED_HOSTS: host,
      }),
    ).toEqual({ text: input, lines: [] });
  });

  it("preserves differing shell and file values while appending only to the file values", () => {
    const input =
      "RAKAZO_TRUSTED_ORIGINS=https://file.example.test\nRAKAZO_ALLOWED_HOSTS=file.example.test\n";
    const result = merge(input, {
      RAKAZO_TRUSTED_ORIGINS: "https://shell.example.test",
      RAKAZO_ALLOWED_HOSTS: "shell.example.test",
    });

    expect(result).toEqual({
      text: `RAKAZO_TRUSTED_ORIGINS=https://file.example.test,${origin}\nRAKAZO_ALLOWED_HOSTS=file.example.test,${host}\n`,
      lines: [
        `RAKAZO_TRUSTED_ORIGINS=https://file.example.test,${origin}`,
        `RAKAZO_ALLOWED_HOSTS=file.example.test,${host}`,
      ],
      shellNotes: [
        "Shell value (takes precedence over .env): RAKAZO_TRUSTED_ORIGINS=https://shell.example.test",
        "Shell value (takes precedence over .env): RAKAZO_ALLOWED_HOSTS=shell.example.test",
      ],
    });
    expect(result.text).not.toContain("shell.example.test");
  });

  it("rejects invalid shell values without returning or displaying them", () => {
    const input = `RAKAZO_TRUSTED_ORIGINS=${origin}\nRAKAZO_ALLOWED_HOSTS=${host}\n`;
    const invalid = "https://user:synthetic-secret@host.example.test";
    const result = merge(input, {
      RAKAZO_TRUSTED_ORIGINS: invalid,
      RAKAZO_ALLOWED_HOSTS: host,
    });

    expect(result).toEqual({
      text: input,
      lines: [],
      error: "shell-invalid:RAKAZO_TRUSTED_ORIGINS",
    });
    expect(JSON.stringify(result)).not.toContain(invalid);
    expect(JSON.stringify(result)).not.toContain("synthetic-secret");
  });

  it("validates file values independently of satisfied shell values", () => {
    const input = "RAKAZO_TRUSTED_ORIGINS=https://invalid.example.test/path\n";
    expect(
      merge(input, {
        RAKAZO_TRUSTED_ORIGINS: origin,
        RAKAZO_ALLOWED_HOSTS: host,
      }),
    ).toEqual({
      text: input,
      lines: [],
      error: "RAKAZO_TRUSTED_ORIGINS",
    });
  });
});
