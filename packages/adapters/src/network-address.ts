import { AsyncLocalStorage } from "node:async_hooks";
import dns from "node:dns";
import { lookup } from "node:dns/promises";
import type { LookupFunction } from "node:net";
import { isIP } from "node:net";
import {
  CLOUD_METADATA_IPV4 as CLOUD_METADATA_IPV4_LIST,
  CLOUD_METADATA_IPV6 as CLOUD_METADATA_IPV6_LIST,
} from "@rakazo/contracts";

export type ResolvedAddress = { address: string; family: number };
export type ResolveHostname = (hostname: string) => Promise<ResolvedAddress[]>;

export const defaultResolveHostname: ResolveHostname = (hostname) =>
  lookup(hostname, { all: true, verbatim: true });

type PinnedDns = { hostname: string; addresses: ResolvedAddress[] };

const pinnedDns = new AsyncLocalStorage<PinnedDns>();
let dnsPinInstalled = false;

const CLOUD_METADATA_IPV4 = new Set(CLOUD_METADATA_IPV4_LIST.map(ipv4ToNumber));
/** fd7a:115c:a1e0::/48 — the Tailscale IPv6 range. */
const TAILSCALE_ULA_PREFIX = 0xfd7a115ca1e0n;

/** IPv4 special-purpose ranges (RFC 6890) that are not globally reachable unicast. The
 * documentation ranges (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24, and 2001:db8::/32 for
 * IPv6) are left out: they are not routed on the internet, and tests use them as public. */
const NON_PUBLIC_IPV4_RANGES = (
  [
    ["0.0.0.0", 8], // "this network"
    ["10.0.0.0", 8], // RFC 1918
    ["100.64.0.0", 10], // shared address space (CGNAT, Tailscale)
    ["127.0.0.0", 8], // loopback
    ["169.254.0.0", 16], // link-local, cloud metadata
    ["172.16.0.0", 12], // RFC 1918
    ["192.0.0.0", 24], // IETF protocol assignments
    ["192.88.99.0", 24], // deprecated 6to4 relay anycast
    ["192.168.0.0", 16], // RFC 1918
    ["198.18.0.0", 15], // benchmarking
    ["224.0.0.0", 4], // multicast
    ["240.0.0.0", 4], // reserved, including 255.255.255.255 broadcast
  ] as const
).map(([network, prefix]) => {
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return { network: ipv4ToNumber(network), mask };
});

function normalizeLookupHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

function familyNumber(family: unknown): number | undefined {
  if (family === "IPv4") return 4;
  if (family === "IPv6") return 6;
  return typeof family === "number" ? family : undefined;
}

function lookupOptions(options: unknown): { all?: boolean; family?: number } {
  if (options == null || typeof options === "function") return {};
  if (typeof options === "number") return { family: options };
  if (typeof options === "object") {
    const record = options as { all?: boolean; family?: unknown };
    return { all: record.all, family: familyNumber(record.family) };
  }
  return {};
}

function selectLookupAddress(
  addresses: ResolvedAddress[],
  options: { all?: boolean; family?: number },
): { all: true; addresses: ResolvedAddress[] } | { all: false; address: string; family: number } {
  const requestedFamily = typeof options.family === "number" ? options.family : 0;
  const candidates = addresses.filter(
    (entry) => requestedFamily === 0 || entry.family === requestedFamily,
  );
  if (options.all) {
    if (candidates.length === 0) throw new Error("Endpoint did not resolve to an address");
    return { all: true, addresses: candidates };
  }
  const selected = candidates[0];
  if (!selected) throw new Error("Endpoint did not resolve to an address");
  return { all: false, address: selected.address, family: selected.family };
}

function deliverLookup(
  addresses: ResolvedAddress[],
  options: { all?: boolean; family?: number },
  callback: (error: Error | null, address: string | ResolvedAddress[], family?: number) => void,
): void {
  const result = selectLookupAddress(addresses, options);
  if (result.all) callback(null, result.addresses);
  else callback(null, result.address, result.family);
}

export function createAddressCheckedLookup(
  resolve: ResolveHostname,
  validate: (addresses: ResolvedAddress[], hostname: string) => void,
): LookupFunction {
  return (hostname, options, callback) => {
    void resolve(hostname)
      .then((addresses) => {
        validate(addresses, hostname);
        deliverLookup(addresses, lookupOptions(options), callback);
      })
      .catch((error: unknown) =>
        callback(error instanceof Error ? error : new Error(String(error)), "", 0),
      );
  };
}

function pinnedAddressesFor(hostname: string): ResolvedAddress[] | undefined {
  const pin = pinnedDns.getStore();
  if (!pin) return undefined;
  if (normalizeLookupHostname(hostname) !== normalizeLookupHostname(pin.hostname)) return undefined;
  return pin.addresses;
}

function installDnsPin(): void {
  if (dnsPinInstalled) return;
  dnsPinInstalled = true;
  const originalLookup = dns.lookup.bind(dns);
  const originalPromisesLookup = dns.promises.lookup.bind(dns.promises);

  dns.lookup = ((hostname: string, options: unknown, callback?: unknown) => {
    const cb = typeof options === "function" ? options : callback;
    const pinned = pinnedAddressesFor(hostname);
    if (pinned && typeof cb === "function") {
      try {
        deliverLookup(
          pinned,
          lookupOptions(options),
          cb as (error: Error | null, address: string | ResolvedAddress[], family?: number) => void,
        );
      } catch (error) {
        cb(error instanceof Error ? error : new Error(String(error)), "", 0);
      }
      return;
    }
    return originalLookup(hostname, options as never, callback as never);
  }) as typeof dns.lookup;

  dns.promises.lookup = (async (hostname: string, options?: unknown) => {
    const pinned = pinnedAddressesFor(hostname);
    if (pinned) {
      const result = selectLookupAddress(pinned, lookupOptions(options));
      return result.all ? result.addresses : { address: result.address, family: result.family };
    }
    return originalPromisesLookup(hostname, options as never);
  }) as typeof dns.promises.lookup;
}

/** Pin `dns.lookup` for one hostname while `run` executes so Node's fetch can
 * keep the original URL hostname for TLS/SNI and still dial the already
 * validated address. No-ops for other hostnames and for callers outside this
 * async context. */
export async function withPinnedDnsLookup<T>(
  hostname: string,
  addresses: ResolvedAddress[],
  run: () => Promise<T>,
): Promise<T> {
  installDnsPin();
  return pinnedDns.run({ hostname, addresses }, run);
}

export function isLoopbackAddress(address: string): boolean {
  const value = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(value) === 4) {
    return value.split(".").map(Number)[0] === 127;
  }
  const ipv6 = parseIpv6(value);
  if (ipv6 === undefined) return false;
  // ::ffff:0:0/96 IPv4-mapped, including hex form ::ffff:7f00:1.
  if (ipv6 >> 32n === 0xffffn) return ((Number(ipv6 & 0xffffffffn) >>> 24) & 0xff) === 127;
  return ipv6 === 1n;
}

export function isPrivateAddress(address: string): boolean {
  const value = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(value) === 4) return isPrivateIpv4Number(ipv4ToNumber(value));
  const ipv6 = parseIpv6(value);
  if (ipv6 === undefined) return true;
  // ::/128 unspecified and ::1 loopback.
  if (ipv6 === 0n || ipv6 === 1n) return true;
  // ff00::/8 multicast.
  if (ipv6 >> 120n === 0xffn) return true;
  // fe80::/10 link-local and fec0::/10 deprecated site-local.
  const topTenBits = ipv6 >> 118n;
  if (topTenBits === 0x3fan || topTenBits === 0x3fbn) return true;
  // fc00::/7 unique local (ULA), including fd00::/8.
  if (ipv6 >> 121n === 0x7en) return true;
  // 64:ff9b:1::/48 local-use NAT64 (RFC 8215): translator-local, prefix length varies.
  if (ipv6 >> 80n === 0x64ff9b0001n) return true;
  // 100::/64 discard-only.
  if (ipv6 >> 64n === 0x0100000000000000n) return true;
  // 2001::/23 IETF protocol assignments, including 2001::/32 Teredo and 2001:2::/48 benchmarking.
  if (ipv6 >> 105n === 0x2001n << 7n) return true;
  const embeddedIpv4 = getEmbeddedIpv4Number(ipv6);
  if (embeddedIpv4 !== undefined) return isPrivateIpv4Number(embeddedIpv4);
  return false;
}

export function isCloudMetadataAddress(address: string): boolean {
  const value = address.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const ipv4 = mapped ?? (isIP(value) === 4 ? value : undefined);
  if (ipv4) return isCloudMetadataIpv4Number(ipv4ToNumber(ipv4));

  const ipv6 = parseIpv6(value);
  if (ipv6 === undefined) return false;
  if (CLOUD_METADATA_IPV6_LIST.some((a) => parseIpv6(a) === ipv6)) return true;
  const embeddedIpv4 = getEmbeddedIpv4Number(ipv6);
  return embeddedIpv4 !== undefined && isCloudMetadataIpv4Number(embeddedIpv4);
}

/** Hostname as URL.hostname yields it, minus IPv6 brackets and any trailing dot. */
export function normalizeUrlHostname(url: URL): string {
  return url.hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLowerCase();
}

/** Owner-gated private-LAN guard shared by Serenity and Supermemory: the
 * resolved set must be non-empty, private, and free of metadata or link-local. */
export function assertPrivateLanAddresses(
  addresses: ResolvedAddress[],
  messages: { empty?: string; blocked: string; notPrivate: string },
): void {
  if (addresses.length === 0 && messages.empty) throw new Error(messages.empty);
  if (addresses.some((e) => isCloudMetadataAddress(e.address) || isLinkLocalAddress(e.address))) {
    throw new Error(messages.blocked);
  }
  if (addresses.length === 0 || addresses.some((e) => !isPrivateAddress(e.address))) {
    throw new Error(messages.notPrivate);
  }
}

/** Tailscale gives every node a CGNAT 100.64.0.0/10 address and an
 * fd7a:115c:a1e0::/48 ULA, and MagicDNS answers with both. Callers that accept
 * a tailnet host have to accept the IPv6 half too, or the name resolves to one
 * allowed and one blocked address and the whole host is rejected. */
export function isTailscaleAddress(address: string): boolean {
  const value = address.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const ipv4 = mapped ?? (isIP(value) === 4 ? value : undefined);
  if (ipv4) {
    const [a, b] = ipv4.split(".").map(Number);
    return a === 100 && b != null && b >= 64 && b <= 127;
  }
  const ipv6 = parseIpv6(value);
  return ipv6 !== undefined && ipv6 >> 80n === TAILSCALE_ULA_PREFIX;
}

export function isLinkLocalAddress(address: string): boolean {
  const value = address.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const ipv4 = mapped ?? (isIP(value) === 4 ? value : undefined);
  if (ipv4) {
    const [a, b] = ipv4.split(".").map(Number);
    return a === 169 && b === 254;
  }

  const ipv6 = parseIpv6(value);
  if (ipv6 === undefined) return false;
  const ipv4Prefix = ipv6 >> 32n;
  if (ipv4Prefix === 0xffffn || ipv4Prefix === 0n) {
    const embeddedIpv4 = Number(ipv6 & 0xffffffffn);
    return ((embeddedIpv4 >>> 24) & 0xff) === 169 && ((embeddedIpv4 >>> 16) & 0xff) === 254;
  }
  return ipv6 >> 118n === 0x3fan;
}

function parseIpv6(value: string): bigint | undefined {
  if (isIP(value) !== 6) return undefined;
  const dottedTail = value.slice(value.lastIndexOf(":") + 1);
  const normalized = dottedTail.includes(".") ? replaceIpv4Tail(value, dottedTail) : value;
  if (!normalized) return undefined;
  const [leftValue, rightValue] = normalized.split("::", 2);
  const left = leftValue ? leftValue.split(":") : [];
  const right = rightValue ? rightValue.split(":") : [];
  const missing = 8 - left.length - right.length;
  if (!value.includes("::") && missing !== 0) return undefined;
  const groups = [...left, ...Array.from({ length: missing }, () => "0"), ...right];
  if (groups.length !== 8) return undefined;
  try {
    return groups.reduce((result, group) => (result << 16n) | BigInt(`0x${group || "0"}`), 0n);
  } catch {
    return undefined;
  }
}

function replaceIpv4Tail(value: string, tail: string): string | undefined {
  if (isIP(tail) !== 4) return undefined;
  const [a, b, c, d] = tail.split(".").map(Number);
  if (a == null || b == null || c == null || d == null) return undefined;
  const first = ((a << 8) | b).toString(16);
  const second = ((c << 8) | d).toString(16);
  return `${value.slice(0, value.lastIndexOf(":") + 1)}${first}:${second}`;
}

function ipv4ToNumber(value: string): number {
  return value.split(".").reduce((result, octet) => (result << 8) | Number(octet), 0) >>> 0;
}

function getEmbeddedIpv4Number(ipv6: bigint): number | undefined {
  const ipv4Prefix = ipv6 >> 32n;
  // ::ffff:0:0/96 IPv4-mapped and ::/96 IPv4-compatible (deprecated).
  if (ipv4Prefix === 0xffffn || ipv4Prefix === 0n) return Number(ipv6 & 0xffffffffn);
  // 64:ff9b::/96 NAT64 well-known prefix.
  if (ipv4Prefix === 0x64ff9bn << 64n) return Number(ipv6 & 0xffffffffn);
  // 2002::/16 6to4 — IPv4 lives in the next 32 bits after the prefix.
  if (ipv6 >> 112n === 0x2002n) return Number((ipv6 >> 80n) & 0xffffffffn);
  return undefined;
}

function isCloudMetadataIpv4Number(value: number): boolean {
  return CLOUD_METADATA_IPV4.has(value);
}

function isPrivateIpv4Number(value: number): boolean {
  return NON_PUBLIC_IPV4_RANGES.some(({ network, mask }) => (value & mask) >>> 0 === network);
}
