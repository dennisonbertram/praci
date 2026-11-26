function parseOrigin(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("?") ||
    value.includes("#")
  ) {
    throw new TypeError("A server origin is required.");
  }
  if (!/^[a-z][a-z\d+.-]*:\/\/[^/?#]+$/i.test(value)) {
    throw new TypeError("Enter a server origin without credentials, path, query, or fragment.");
  }
  const authority = value.slice(value.indexOf("://") + 3);
  if (authority.includes("@")) {
    throw new TypeError("Enter a server origin without credentials, path, query, or fragment.");
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("Enter a valid server origin.");
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new TypeError("Enter a server origin without credentials, path, query, or fragment.");
  }

  return url.origin;
}

export function buildConnectLink(origin) {
  return `rakazo://connect?server=${encodeURIComponent(parseOrigin(origin))}`;
}

export function parseConnectLink(text) {
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new TypeError("Enter a server URL or connect link.");
  }

  const input = text.trim();
  if (!/^rakazo:/i.test(input)) {
    const value = /^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`;
    return parseOrigin(value);
  }

  let link;
  try {
    link = new URL(input);
  } catch {
    throw new TypeError("Enter a valid connect link.");
  }
  const authority = input.slice(input.indexOf("://") + 3).split(/[/?#]/, 1)[0];

  if (
    link.protocol !== "rakazo:" ||
    link.host.toLowerCase() !== "connect" ||
    authority.includes("@") ||
    link.username ||
    link.password ||
    (link.pathname !== "" && link.pathname !== "/") ||
    link.hash
  ) {
    throw new TypeError("Enter a valid connect link.");
  }

  const servers = link.searchParams.getAll("server");
  if (servers.length !== 1) throw new TypeError("Connect link must contain one server.");

  return parseOrigin(servers[0]);
}
