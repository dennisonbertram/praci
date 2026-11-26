/** Removes external-link parameters that can select another space or start work automatically. */
export function sanitizeExternalPath(path: string): string {
  const schemeMatch = path.match(/^[a-z][a-z\d+.-]*:\/\//i);
  const withoutScheme = schemeMatch ? path.slice(schemeMatch[0].length) : path;
  const rawRoute = schemeMatch
    ? `/${withoutScheme.replace(/^\/+/, "").split(/[/?#]/, 1)[0]}`
    : withoutScheme.split(/[?#]/, 1)[0];
  // Expo Router matches "/thread/" and "/Thread" the same way, so compare a normalised name.
  const route = (rawRoute ?? "").replace(/\/+$/, "").toLowerCase() || "/";

  if (route === "/computer") return "/";
  const thread = route === "/thread" || route === "/group-thread";
  if (!thread && route !== "/new-space") return path;

  const normalized =
    schemeMatch && !withoutScheme.startsWith("/") ? `/${withoutScheme.replace(/^\/+/, "")}` : path;
  const hashIndex = normalized.indexOf("#");
  const fragment = hashIndex === -1 ? "" : normalized.slice(hashIndex);
  const beforeFragment = hashIndex === -1 ? normalized : normalized.slice(0, hashIndex);
  const queryIndex = beforeFragment.indexOf("?");
  if (queryIndex === -1) return `${beforeFragment}${fragment}`;

  const pathname = beforeFragment.slice(0, queryIndex);
  const query = beforeFragment
    .slice(queryIndex + 1)
    .split("&")
    .filter((part) => {
      const key = part.split("=", 1)[0] ?? "";
      let decodedKey = key;
      try {
        decodedKey = decodeURIComponent(key.replaceAll("+", " "));
      } catch {
        // Keep malformed query keys; they do not match a parameter being removed.
      }
      return thread ? decodedKey !== "spaceId" : decodedKey !== "spaceId" && decodedKey !== "name";
    })
    .join("&");

  return `${pathname}${query ? `?${query}` : ""}${fragment}`;
}
