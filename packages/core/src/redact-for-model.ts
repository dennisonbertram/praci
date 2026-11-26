const DIGIT_RUN = /\d+(?:[ .-]\d+)*/g;
const LABELLED_SECRET =
  /(\b(?:password|passcode|pin)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|“[^”]*”|‘[^’]*’|\S+)/gi;

function luhnValid(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

const isCardLength = (digits: string) => digits.length >= 13 && digits.length <= 19;

/** Redacts the card numbers inside one run of digits groups, such as "4111 1111 1111 1111 1226". */
function redactRun(run: string): string {
  const groups = [...run.matchAll(/\d+/g)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
    digits: m[0],
  }));
  let out = "";
  let at = 0;
  for (let i = 0; i < groups.length; i++) {
    let hit: { start: number; end: number } | undefined;
    let digits = "";
    // A window of whole groups, so an expiry or CVV in its own group cannot hide the card.
    for (let j = i; j < groups.length && digits.length <= 19; j++) {
      digits += groups[j]!.digits;
      if (isCardLength(digits) && luhnValid(digits))
        hit = { start: groups[i]!.start, end: groups[j]!.end };
    }
    // Inside one group longer than a card number, only its two ends can be one.
    const g = groups[i]!;
    if (!hit && g.digits.length > 19) {
      for (let len = 19; len >= 13 && !hit; len--) {
        if (luhnValid(g.digits.slice(0, len))) hit = { start: g.start, end: g.start + len };
        else if (luhnValid(g.digits.slice(-len))) hit = { start: g.end - len, end: g.end };
      }
    }
    if (hit && hit.start >= at) {
      out += run.slice(at, hit.start) + "[card]";
      at = hit.end;
      while (i + 1 < groups.length && groups[i + 1]!.start < at) i++;
    }
  }
  return out + run.slice(at);
}

/**
 * Removes what a background model call should never see in a mail snippet: Luhn-valid card numbers
 * (13 to 19 digits, spaces, dots or dashes between groups, any Unicode digits) and the value after
 * "password:", "passcode:" or "PIN:", quoted or not. One-time codes stay: they expire in minutes
 * and are what marks security mail.
 */
export function redactForModel(text: string): string {
  return text
    .normalize("NFKC")
    .replace(DIGIT_RUN, redactRun)
    .replace(LABELLED_SECRET, "$1[secret]");
}
