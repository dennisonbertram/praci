export type AppRoute =
  | { pathname: "/agent-page"; params: { botId: string; pageId: string } }
  | { pathname: "/data-room-item"; params: { itemId: string } }
  | { pathname: "/artifact"; params: { artifactId: string } };

const BASE = "https://app.invalid";

/**
 * The screen for an in-app web path an agent wrote as a Markdown link, or null when the app has
 * none. Only these shapes open anything; the server still decides whether the viewer may see it.
 */
export function appRouteFor(href: string): AppRoute | null {
  if (!href.startsWith("/app/")) return null;
  let url: URL;
  try {
    url = new URL(href, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  const segment = (value: string | undefined) => {
    try {
      return value ? decodeURIComponent(value) : "";
    } catch {
      return "";
    }
  };
  const path = url.pathname.split("/").slice(2);
  if (path.length === 3 && path[0] === "pages") {
    const [botId, pageId] = [segment(path[1]), segment(path[2])];
    return botId && pageId ? { pathname: "/agent-page", params: { botId, pageId } } : null;
  }
  if (path.length === 2 && path[0] === "artifacts") {
    const artifactId = segment(path[1]);
    return artifactId ? { pathname: "/artifact", params: { artifactId } } : null;
  }
  if (path.length === 1 && path[0] === "data-room") {
    const itemId = url.searchParams.get("item");
    return itemId ? { pathname: "/data-room-item", params: { itemId } } : null;
  }
  return null;
}
