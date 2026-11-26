import { describe, expect, it } from "vitest";
import { firewallPageWriteAddsNothing } from "./firewall-page-markdown.js";

const line = "![i](https://example.org/c?s=PRIVATE)";

describe("firewallPageWriteAddsNothing", () => {
  it("lets plain text change freely", () => {
    expect(firewallPageWriteAddsNothing("- Safa: waiting\n", "- Safa: proof received\n")).toBe(
      true,
    );
  });
  it("allows a plain email in an appended table row, but still asks for parameterized mailto and images", () => {
    const before = "| Name | Email |\n| --- | --- |\n";
    expect(firewallPageWriteAddsNothing(before, `${before}| Shayan | shay@example.com |\n`)).toBe(
      true,
    );
    expect(firewallPageWriteAddsNothing("", "[x](mailto:a@b.test?body=secret)")).toBe(false);
    expect(firewallPageWriteAddsNothing("", "![x](https://evil.test/a)")).toBe(false);
  });
  it("asks when a fence is removed and an image goes live", () => {
    expect(firewallPageWriteAddsNothing(`\`\`\`text\n${line}\n\`\`\`\n`, `${line}\n`)).toBe(false);
  });
  it("asks when lazy continuation turns indented code into a live image", () => {
    expect(
      firewallPageWriteAddsNothing(`Notes\n\n    ${line}\n`, `Notes\ncontinued\n    ${line}\n`),
    ).toBe(false);
  });
  it("asks when a shortcut reference image resolves to an existing definition", () => {
    const before = "Notes\n\n[r]: https://attacker.test/pixel\n";
    expect(
      firewallPageWriteAddsNothing(before, `Notes\n\n![r]\n\n[r]: https://attacker.test/pixel\n`),
    ).toBe(false);
  });
});

it("asks when only the letter case of an existing address changes", () => {
  expect(
    firewallPageWriteAddsNothing(
      "![i](https://example.com/a.png)\n",
      "![i](https://example.com/A.png)\n",
    ),
  ).toBe(false);
});
