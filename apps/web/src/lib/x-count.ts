const URL_CANDIDATE =
  /(?:https?:\/\/|www\.)[^\s<>"']+|(?<![\p{L}\p{N}_@])(?:[\p{L}\p{N}-]+\.)+[\p{L}]{2,63}(?:[/?#][^\s<>"']*)?/giu;

function weighted(text: string): number {
  let count = 0;
  for (const character of text) {
    const point = character.codePointAt(0)!;
    count +=
      point <= 0x10ff ||
      (point >= 0x2000 && point <= 0x200d) ||
      (point >= 0x2010 && point <= 0x201f) ||
      (point >= 0x2032 && point <= 0x2037)
        ? 1
        : 2;
  }
  return count;
}

function trimUrl(candidate: string): string {
  let url = candidate.replace(/[.,!?;:'"]+$/, "");
  for (const [open, close] of [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
  ] as const) {
    while (url.endsWith(close) && url.split(close).length > url.split(open).length) {
      url = url.slice(0, -1);
    }
  }
  return url;
}

export function xCount(text: string): number {
  const normalised = text.normalize("NFC");
  let count = 0;
  let offset = 0;
  for (const match of normalised.matchAll(URL_CANDIDATE)) {
    const candidate = trimUrl(match[0]);
    if (normalised[match.index + candidate.length] === "@") continue;
    try {
      const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
      if (!url.hostname.includes(".") || url.username || url.password) continue;
    } catch {
      continue;
    }
    count += weighted(normalised.slice(offset, match.index)) + 23;
    offset = match.index + candidate.length;
  }
  return count + weighted(normalised.slice(offset));
}
