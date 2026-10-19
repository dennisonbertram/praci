/**
 * Global stand-ins that keep stories offline. preview.tsx imports this first, because the auth
 * client keeps the `fetch` it finds when it loads.
 */

// Answer the auth session request the shell makes on load.
const originalFetch = window.fetch;
window.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return url.includes("/api/auth/get-session")
    ? Promise.resolve(
        Response.json({
          session: {
            id: "sess_demo",
            userId: "user_demo",
            expiresAt: "2099-01-01T00:00:00.000Z",
            token: "demo",
          },
          user: {
            id: "user_demo",
            name: "Demo User",
            email: "demo@example.com",
            emailVerified: true,
          },
        }),
      )
    : originalFetch(input, init);
};

// Swap remote image URLs (logo CDNs) for an empty data URI. The image fails to decode, so
// components show their letter fallback and no request leaves the browser.
const blank = "data:,";
const remote = (value: unknown) =>
  typeof value === "string" && /^https?:\/\//.test(value) && !value.startsWith(location.origin);
const setAttribute = Element.prototype.setAttribute;
Element.prototype.setAttribute = function (name: string, value: string) {
  const image = this instanceof HTMLImageElement && name === "src";
  return setAttribute.call(this, name, image && remote(value) ? blank : value);
};
const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
if (src?.set) {
  const set = src.set;
  Object.defineProperty(HTMLImageElement.prototype, "src", {
    ...src,
    set(value: string) {
      set.call(this, remote(value) ? blank : value);
    },
  });
}
