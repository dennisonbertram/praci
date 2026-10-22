// Presence checks only: they do not verify consent, address deliverability, or legal compliance.
export function emailCompliance(body: string): { unsubscribe: boolean; postalAddress: boolean } {
  const unsubscribe =
    /\breply\b[^\n.!?]{0,80}\b(?:unsubscribe|opt[ -]out|stop)\b/i.test(body) ||
    /\b(?:unsubscribe|opt[ -]out)\b[^\n]{0,80}https?:\/\/\S+/i.test(body) ||
    /https?:\/\/\S*(?:unsubscribe|opt-out)\S*/i.test(body);
  const explicitAddress =
    (/^postal address:[ \t]*([^\r\n]{1,320})$/im.exec(body)?.[1]?.trim().length ?? 0) >= 10;
  const street =
    /\b\d{1,6}\s+[\p{L}\p{N} .'-]{1,80}\s(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|boulevard|blvd|way|court|ct|place|pl)\b/iu.test(
      body,
    );
  const poBox = /\bp\.?\s*o\.?\s+box\s+\d+\b/i.test(body);
  const postcode =
    /\b(?:[A-Z]{2}\s+\d{5}(?:-\d{4})?|[A-Z]\d[A-Z]\s*\d[A-Z]\d|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i.test(
      body,
    );
  return { unsubscribe, postalAddress: explicitAddress || ((street || poBox) && postcode) };
}
