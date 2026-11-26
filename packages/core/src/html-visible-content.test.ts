import { describe, expect, it } from "vitest";
import { htmlHasVisibleContent } from "./html-visible-content.js";

describe("htmlHasVisibleContent", () => {
  it("ignores styles, scripts, comments, and nonbreaking spaces", () => {
    expect(htmlHasVisibleContent("<style>x</style><script>x</script><!-- x -->&nbsp;")).toBe(false);
  });

  it("recognizes visible text and media elements", () => {
    expect(htmlHasVisibleContent("<p>Hello</p>")).toBe(true);
    expect(htmlHasVisibleContent("<img src='x'>")).toBe(true);
    expect(htmlHasVisibleContent("<svg></svg>")).toBe(true);
    expect(htmlHasVisibleContent("<video></video>")).toBe(true);
  });
});
