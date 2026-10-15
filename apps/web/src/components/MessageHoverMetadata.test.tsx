import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MessageHoverMetadata } from "./MessageHoverMetadata";

describe("MessageHoverMetadata", () => {
  it("places bot actions under the bubble's right edge", () => {
    const html = renderToStaticMarkup(
      <MessageHoverMetadata side="end">
        <div data-testid="message-actions" />
      </MessageHoverMetadata>,
    );

    expect(html).toContain('data-testid="message-hover-rail"');
    expect(html).toContain("top-full");
    expect(html).toContain("end-0");
    expect(html).toContain("pt-1");
    expect(html).not.toContain("start-full");
    expect(html).not.toContain("top-1/2");
    expect(html).not.toContain("<time");
    expect(html).toContain("opacity-0");
    expect(html).toContain("@media(hover:hover)_and_(pointer:fine)");
    expect(html).toContain("group-hover/message:opacity-100");
    expect(html).toContain("focus-within:opacity-100");
  });

  it("keeps user actions under the bubble's end edge and clears the reactions row", () => {
    const html = renderToStaticMarkup(
      <MessageHoverMetadata side="start">
        <div data-testid="message-actions" />
      </MessageHoverMetadata>,
    );

    expect(html).toContain("top-full");
    expect(html).toContain("end-0");
    expect(html).not.toContain("end-full");
    expect(html).not.toContain("<time");
    expect(
      renderToStaticMarkup(
        <MessageHoverMetadata hasReactions side="start">
          <div />
        </MessageHoverMetadata>,
      ),
    ).toContain("pt-9");
  });

  it("drops the rail in-flow below the bubble on touch", () => {
    const bot = renderToStaticMarkup(
      <MessageHoverMetadata side="end">
        <div data-testid="message-actions" />
      </MessageHoverMetadata>,
    );
    const user = renderToStaticMarkup(
      <MessageHoverMetadata side="start">
        <div data-testid="message-actions" />
      </MessageHoverMetadata>,
    );

    for (const html of [bot, user]) {
      expect(html).toContain("[@media(hover:none)]:static");
      expect(html).toContain("[@media(hover:none)]:w-full");
      expect(html).toContain("[@media(hover:none)]:pt-0");
    }
    expect(bot).toContain("[@media(hover:none)]:justify-start");
    expect(user).toContain("[@media(hover:none)]:justify-end");
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
