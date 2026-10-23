import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MessageHoverMetadata } from "./MessageHoverMetadata";

describe("MessageHoverMetadata", () => {
  it("places bot actions in the gutter beside the bubble's bottom corner", () => {
    const html = renderToStaticMarkup(
      <MessageHoverMetadata side="end">
        <div data-testid="message-actions" />
      </MessageHoverMetadata>,
    );

    expect(html).toContain('data-testid="message-hover-rail"');
    // Beside the bubble, not under it: under it the rail covered the next message's text.
    expect(html).toContain("start-full");
    expect(html).toContain("bottom-0");
    expect(html).not.toMatch(/(^|\s)top-full/);
    expect(html).not.toContain("<time");
    expect(html).toContain("opacity-0");
    expect(html).toContain("@media(hover:hover)_and_(pointer:fine)");
    expect(html).toContain("group-hover/message:opacity-100");
    expect(html).toContain("focus-within:opacity-100");
  });

  it("places user actions in the gutter on the bubble's start side", () => {
    const html = renderToStaticMarkup(
      <MessageHoverMetadata hasReactions side="start">
        <div data-testid="message-actions" />
      </MessageHoverMetadata>,
    );

    expect(html).toContain("end-full");
    expect(html).not.toMatch(/(^|\s)top-full/);
    expect(html).not.toContain("<time");
  });

  it("drops the rail below the bubble only in a narrow transcript, which has no gutter", () => {
    const html = renderToStaticMarkup(
      <MessageHoverMetadata side="end">
        <div data-testid="message-actions" />
      </MessageHoverMetadata>,
    );
    expect(html).toContain("@max-sm:[@media(hover:hover)]:top-full");
    expect(html).toContain("@max-sm:[@media(hover:hover)]:start-0");
    // The time sits on its own line under the bubble, so the buttons start below it.
    expect(html).toContain("@max-sm:[@media(hover:hover)]:mt-6");
  });

  it("keeps the rail in the gutter on touch and hides it on cards and full-width rows", () => {
    const render = (props: { below?: boolean; hideOnTouch?: boolean }) =>
      renderToStaticMarkup(
        <MessageHoverMetadata side="end" {...props}>
          <div data-testid="message-actions" />
        </MessageHoverMetadata>,
      );
    const text = render({});
    // No touch override moves it under the bubble, where it covered the next message and card controls.
    expect(text).not.toContain("[@media(hover:none)]:top-full");
    expect(text).not.toContain("[@media(hover:none)]:hidden");
    expect(text).toContain("[@media(hover:none)]:p-0");
    expect(render({ hideOnTouch: true })).toContain("[@media(hover:none)]:hidden");
    // A mixed full-width message keeps its rail, in the line reserved under the row.
    const mixed = render({ below: true });
    expect(mixed).not.toContain("[@media(hover:none)]:hidden");
    expect(mixed).toContain("[@media(hover:none)]:top-full");
    expect(render({ below: true, hideOnTouch: true })).toContain("[@media(hover:none)]:hidden");
  });

  it("pins the rail open while a nested menu is active", () => {
    const html = renderToStaticMarkup(
      <MessageHoverMetadata pinned side="end">
        <div data-testid="message-actions" />
      </MessageHoverMetadata>,
    );

    expect(html).toContain("pointer-events-auto opacity-100");
    expect(html).not.toContain("group-hover/message:opacity-100");
  });
});
