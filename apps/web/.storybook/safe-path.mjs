import { isAbsolute, join, relative } from "node:path";

/** Joins a URL path onto root, or returns null when the result would leave root. */
export function insideRoot(root, urlPath) {
  const path = join(root, urlPath);
  const rel = relative(root, path);
  return rel.startsWith("..") || isAbsolute(rel) ? null : path;
}
