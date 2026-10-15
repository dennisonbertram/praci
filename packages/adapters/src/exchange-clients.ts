import { createHash, createHmac, createPrivateKey, createSign, randomBytes } from "node:crypto";
import type { ExchangeProvider } from "@rakazo/contracts";

// Read-only clients for Coinbase (Advanced Trade REST, CDP key + ES256 JWT) and Kraken (spot REST,
// key + HMAC-SHA512). Docs: https://docs.cdp.coinbase.com/coinbase-app/authentication-authorization/api-key-authentication
// and https://docs.kraken.com/api/docs/guides/spot-rest-auth/

/** Every request goes through `call`, which refuses a method and path that is not listed here. */
export const EXCHANGE_ALLOWED_REQUESTS = [
  "GET api.coinbase.com/api/v3/brokerage/key_permissions",
  "GET api.coinbase.com/api/v3/brokerage/accounts",
  "POST api.kraken.com/0/private/Balance",
] as const;

export type ExchangeFailureKind =
  | "invalid_key"
  | "missing_permission"
  | "can_trade"
  | "rate_limit"
  | "unavailable";

export class ExchangeError extends Error {
  constructor(
    readonly provider: ExchangeProvider,
    readonly kind: ExchangeFailureKind,
  ) {
    super(exchangeFailureMessage(provider, kind));
    this.name = "ExchangeError";
  }
}

const NAMES: Record<ExchangeProvider, string> = { coinbase: "Coinbase", kraken: "Kraken" };

/** Short and user-facing; never a payload, a key or a signature. */
export function exchangeFailureMessage(provider: ExchangeProvider, kind: ExchangeFailureKind) {
  const name = NAMES[provider];
  switch (kind) {
    case "invalid_key":
      return `${name} did not accept this key`;
    case "missing_permission":
      return provider === "kraken"
        ? "This key can't read balances"
        : "This key can't view accounts";
    case "can_trade":
      return "This key can trade or transfer. Create a view-only key";
    case "rate_limit":
      return `${name} rate limit reached, try again shortly`;
    default:
      return `${name} is not responding`;
  }
}

export interface ExchangeCredentials {
  /** Coinbase: the CDP key name. Kraken: the API key. */
  key: string;
  /** Coinbase: the EC private key (PEM). Kraken: the base64 private key. */
  secret: string;
}

export interface RawExchangeBalance {
  /** The exchange's own code, e.g. "XXBT" or "BTC". */
  code: string;
  /** Decimal string. */
  amount: string;
}

type Fetch = typeof fetch;

async function call(
  doFetch: Fetch,
  provider: ExchangeProvider,
  method: "GET" | "POST",
  host: string,
  pathAndQuery: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<Response> {
  const path = pathAndQuery.split("?")[0];
  if (!(EXCHANGE_ALLOWED_REQUESTS as readonly string[]).includes(`${method} ${host}${path}`))
    throw new Error("Exchange request is not allowed");
  let res: Response;
  try {
    res = await doFetch(`https://${host}${pathAndQuery}`, {
      ...init,
      method,
      signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(20_000)]),
    });
  } catch {
    throw new ExchangeError(provider, "unavailable");
  }
  return res;
}

const base64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

/**
 * Keys pasted on one line carry literal "\n" sequences, and a single-line input drops real newlines;
 * rebuild a PEM from the header, footer and base64 body so either form works.
 */
function normalizePem(text: string): string {
  const m = /-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/.exec(text.replace(/\\n/g, "\n"));
  if (!m) return text.trim();
  const body = (m[2] ?? "").replace(/[^A-Za-z0-9+/=]/g, "");
  return `-----BEGIN ${m[1]}-----\n${body.match(/.{1,64}/g)?.join("\n") ?? ""}\n-----END ${m[1]}-----\n`;
}

/** A CDP JWT for one request. Exported for tests; the token is valid two minutes and used once. */
export function coinbaseJwt(
  creds: ExchangeCredentials,
  method: string,
  host: string,
  path: string,
  nowSeconds: number,
  nonce = randomBytes(16).toString("hex"),
): string {
  // Keys pasted on one line carry literal "\n" sequences.
  const pem = normalizePem(creds.secret);
  const key = createPrivateKey(pem);
  const header = { alg: "ES256", kid: creds.key, nonce, typ: "JWT" };
  const payload = {
    sub: creds.key,
    iss: "cdp",
    nbf: nowSeconds,
    exp: nowSeconds + 120,
    uri: `${method} ${host}${path}`,
  };
  const input = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  // JWT wants the raw r||s signature, not DER.
  const signature = createSign("SHA256").update(input).sign({ key, dsaEncoding: "ieee-p1363" });
  return `${input}.${base64url(signature)}`;
}

function coinbaseFailure(res: Response): ExchangeError {
  if (res.status === 401) return new ExchangeError("coinbase", "invalid_key");
  if (res.status === 403) return new ExchangeError("coinbase", "missing_permission");
  if (res.status === 429) return new ExchangeError("coinbase", "rate_limit");
  return new ExchangeError("coinbase", "unavailable");
}

const COINBASE_HOST = "api.coinbase.com";

export async function fetchCoinbaseBalances(
  creds: ExchangeCredentials,
  opts: { fetch?: Fetch; now?: () => Date; signal?: AbortSignal } = {},
): Promise<RawExchangeBalance[]> {
  const doFetch = opts.fetch ?? fetch;
  const get = async (path: string, query = "") => {
    let jwt: string;
    try {
      jwt = coinbaseJwt(
        creds,
        "GET",
        COINBASE_HOST,
        path,
        Math.floor((opts.now?.() ?? new Date()).getTime() / 1000),
      );
    } catch {
      throw new ExchangeError("coinbase", "invalid_key");
    }
    const res = await call(
      doFetch,
      "coinbase",
      "GET",
      COINBASE_HOST,
      path + query,
      { headers: { Authorization: `Bearer ${jwt}`, Accept: "application/json" } },
      opts.signal,
    );
    if (!res.ok) throw coinbaseFailure(res);
    try {
      return (await res.json()) as Record<string, unknown>;
    } catch {
      throw new ExchangeError("coinbase", "unavailable");
    }
  };

  // A key that can trade or move funds is refused, so a leaked or mis-scoped key stays harmless.
  const perms = await get("/api/v3/brokerage/key_permissions");
  if (perms.can_view === false) throw new ExchangeError("coinbase", "missing_permission");
  if (perms.can_trade !== false || perms.can_transfer !== false)
    throw new ExchangeError("coinbase", "can_trade");

  type Money = { value?: unknown };
  type Account = { currency?: unknown; available_balance?: Money; hold?: Money };
  const out: RawExchangeBalance[] = [];
  let cursor = "";
  // ponytail: 10 pages of 250 accounts; raise if an account ever lists more.
  for (let page = 0; page < 10; page++) {
    const body = await get(
      "/api/v3/brokerage/accounts",
      `?limit=250${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    for (const a of (body.accounts as Account[] | undefined) ?? []) {
      const available = String(a.available_balance?.value ?? "0");
      const hold = String(a.hold?.value ?? "0");
      if (typeof a.currency !== "string") continue;
      out.push({ code: a.currency, amount: available }, { code: a.currency, amount: hold });
    }
    if (body.has_next !== true || typeof body.cursor !== "string" || !body.cursor) break;
    cursor = body.cursor;
  }
  return out;
}

/** API-Sign: base64(HMAC-SHA512(path + SHA256(nonce + body), base64-decoded secret)). */
export function krakenSignature(
  secretBase64: string,
  path: string,
  nonce: string,
  body: string,
): string {
  const digest = createHash("sha256")
    .update(nonce + body)
    .digest();
  return createHmac("sha512", Buffer.from(secretBase64, "base64"))
    .update(Buffer.concat([Buffer.from(path), digest]))
    .digest("base64");
}

function krakenFailure(errors: string[]): ExchangeError {
  const text = errors.join(" ");
  if (/Permission denied/i.test(text)) return new ExchangeError("kraken", "missing_permission");
  if (/Invalid (key|signature)|Invalid nonce/i.test(text))
    return new ExchangeError("kraken", "invalid_key");
  if (/Rate limit|Temporary lockout|Too many/i.test(text))
    return new ExchangeError("kraken", "rate_limit");
  return new ExchangeError("kraken", "unavailable");
}

const KRAKEN_HOST = "api.kraken.com";

export async function fetchKrakenBalances(
  creds: ExchangeCredentials,
  opts: { fetch?: Fetch; now?: () => Date; signal?: AbortSignal } = {},
): Promise<RawExchangeBalance[]> {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(creds.secret.trim()))
    throw new ExchangeError("kraken", "invalid_key");
  const path = "/0/private/Balance";
  const nonce = String((opts.now?.() ?? new Date()).getTime());
  const body = new URLSearchParams({ nonce }).toString();
  const res = await call(
    opts.fetch ?? fetch,
    "kraken",
    "POST",
    KRAKEN_HOST,
    path,
    {
      headers: {
        "API-Key": creds.key,
        "API-Sign": krakenSignature(creds.secret.trim(), path, nonce, body),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
    opts.signal,
  );
  if (res.status === 429) throw new ExchangeError("kraken", "rate_limit");
  if (!res.ok) throw new ExchangeError("kraken", "unavailable");
  let json: { error?: unknown; result?: unknown };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    throw new ExchangeError("kraken", "unavailable");
  }
  const errors = Array.isArray(json.error) ? json.error.map(String) : [];
  if (errors.length) throw krakenFailure(errors);
  return Object.entries((json.result ?? {}) as Record<string, unknown>).map(([code, amount]) => ({
    code,
    amount: String(amount),
  }));
}

export const fetchExchangeBalances = (
  provider: ExchangeProvider,
  creds: ExchangeCredentials,
  opts: { fetch?: Fetch; now?: () => Date; signal?: AbortSignal } = {},
) =>
  provider === "coinbase" ? fetchCoinbaseBalances(creds, opts) : fetchKrakenBalances(creds, opts);
