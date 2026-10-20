const MAX_BODY_BYTES = 2_048;

export function json(status: number, body: unknown) {
  return Response.json(body, {
    status,
    headers: { Allow: "POST", "Cache-Control": "no-store" },
  });
}

function cancelBody(body: { cancel(): Promise<void> } | null): void {
  try {
    void body?.cancel().catch(() => undefined);
  } catch {
    // Best-effort cleanup must not delay the rejection response.
  }
}

/** Reads a POST body under the size limit. Returns null when invalid or too large. */
export async function readPostBody(request: Request): Promise<string | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isFinite(length) || length < 0 || length > MAX_BODY_BYTES) {
      cancelBody(request.body);
      return null;
    }
  }
  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        cancelBody(reader);
        return null;
      }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}
