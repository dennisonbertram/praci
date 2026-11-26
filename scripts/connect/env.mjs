import { createRequire } from "node:module";
import { isIP } from "node:net";
import { domainToASCII } from "node:url";

const dotenv = createRequire(new URL("../../packages/db/package.json", import.meta.url))("dotenv");
const ENV_KEYS = ["RAKAZO_TRUSTED_ORIGINS", "RAKAZO_ALLOWED_HOSTS"];
const ENV_KEY_SET = new Set(ENV_KEYS);

export function parseConnectEnv(text) {
  return dotenv.parse(text);
}

export function mergeConnectEnv(
  text,
  origin,
  host,
  { shellEnv = {}, fileEnv: providedFileEnv, parseEnv = parseConnectEnv } = {},
) {
  if (!isExactOrigin(origin)) return { text, lines: [], error: "RAKAZO_TRUSTED_ORIGINS" };
  if (!isAllowedHost(host)) return { text, lines: [], error: "RAKAZO_ALLOWED_HOSTS" };
  if (typeof parseEnv !== "function")
    return { text, lines: [], error: "unsupported:RAKAZO_TRUSTED_ORIGINS" };

  let fileEnv;
  try {
    fileEnv = providedFileEnv ?? parseEnv(text);
  } catch {
    return { text, lines: [], error: "unsupported:RAKAZO_TRUSTED_ORIGINS" };
  }

  const pending = [];
  const shellNotes = [];
  for (const key of ENV_KEYS) {
    const target = key === "RAKAZO_TRUSTED_ORIGINS" ? origin : host;
    const hasShellValue = Object.hasOwn(shellEnv, key);
    const shellValue = shellEnv[key];
    const hasFileValue = Object.hasOwn(fileEnv, key);
    const fileValue = fileEnv[key];
    if (hasShellValue && !isValidValue(key, shellValue))
      return { text, lines: [], error: `shell-invalid:${key}` };

    if (hasFileValue && !isValidValue(key, fileValue)) return { text, lines: [], error: key };

    const shellEntries = parseEntries(shellValue);
    const fileEntries = parseEntries(fileValue);
    const fileHasTarget = fileEntries.some((entry) => matchesEntry(key, entry, target));
    if (hasShellValue && (!fileHasTarget || !sameEntries(shellEntries, fileEntries))) {
      shellNotes.push(formatShellNote(key, shellEntries));
    }
    if (fileHasTarget) continue;
    pending.push({ key, target, entries: fileEntries });
  }

  const withShellNotes = (result) => (shellNotes.length === 0 ? result : { ...result, shellNotes });
  if (pending.length === 0) return withShellNotes({ text, lines: [] });

  const scanned = scanAssignments(text);
  if (scanned.unclosed) return unsupported(text, pending[0].key);

  const replacements = [];
  const appended = [];
  const expected = new Map();
  for (const { key, target, entries } of pending) {
    const candidates = scanned.assignments.filter((assignment) => assignment.key === key);
    const parsedCandidates = [];
    for (const candidate of candidates) {
      let parsed;
      try {
        parsed = parseEnv(text.slice(candidate.start, candidate.end));
      } catch {
        return unsupported(text, key);
      }
      if (!Object.hasOwn(parsed, key)) return unsupported(text, key);
      parsedCandidates.push({ ...candidate, parsedValue: parsed[key] });
    }

    const hasFileValue = Object.hasOwn(fileEnv, key);
    const parsedCandidatesExist = parsedCandidates.length > 0;
    if (hasFileValue !== parsedCandidatesExist) return unsupported(text, key);
    if (hasFileValue && parsedCandidates.at(-1).parsedValue !== fileEnv[key])
      return unsupported(text, key);

    const last = parsedCandidates.at(-1);
    if (last) {
      if (last.multiline) return unsupported(text, key);
      const updatedLine = appendTarget(last, target);
      if (updatedLine === null) return unsupported(text, key);
      replacements.push({ start: last.start, end: last.lineEnd, line: updatedLine });
    } else {
      appended.push(`${key}=${target}`);
    }
    expected.set(key, [...entries, target]);
  }

  let updatedText = text;
  for (const replacement of replacements.sort((a, b) => b.start - a.start))
    updatedText =
      updatedText.slice(0, replacement.start) +
      replacement.line +
      updatedText.slice(replacement.end);

  if (appended.length > 0) {
    const hadTrailingNewline = text.endsWith("\n");
    const lineEnding = splitLines(text).find((line) => line.ending)?.ending ?? "\n";
    if (updatedText && !updatedText.endsWith("\n")) updatedText += lineEnding;
    updatedText += appended.join(lineEnding);
    if (hadTrailingNewline) updatedText += lineEnding;
  }

  let updatedEnv;
  try {
    updatedEnv = parseEnv(updatedText);
  } catch {
    return unsupported(text, pending[0].key);
  }
  for (const [key, values] of expected) {
    if (!sameEntries(parseEntries(updatedEnv[key]), values)) return unsupported(text, key);
  }
  for (const key of new Set([...Object.keys(fileEnv), ...Object.keys(updatedEnv)])) {
    if (ENV_KEY_SET.has(key)) continue;
    if (fileEnv[key] !== updatedEnv[key]) return unsupported(text, pending[0].key);
  }

  const lines = ENV_KEYS.filter((key) => expected.has(key)).map(
    (key) => `${key}=${expected.get(key).join(",")}`,
  );
  return withShellNotes({ text: updatedText, lines });
}

function unsupported(text, key) {
  return { text, lines: [], error: `unsupported:${key}` };
}

function isValidValue(key, value) {
  if (typeof value !== "string") return false;
  const rawEntries = value.split(",");
  if (key === "RAKAZO_TRUSTED_ORIGINS" && rawEntries.some((entry) => /\p{Cc}/u.test(entry)))
    return false;
  const validEntry = key === "RAKAZO_TRUSTED_ORIGINS" ? isExactOrigin : isAllowedHost;
  return parseEntries(value).every(validEntry);
}

function formatShellNote(key, entries) {
  return entries.length > 0
    ? `Shell value (takes precedence over .env): ${key}=${entries.join(",")}`
    : `Shell value (takes precedence over .env): ${key} is empty`;
}

function parseEntries(value) {
  if (typeof value !== "string" || value === "") return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function sameEntries(actual, expected) {
  return (
    actual.length === expected.length && actual.every((entry, index) => entry === expected[index])
  );
}

function splitLines(text) {
  const lines = [];
  let start = 0;
  while (start < text.length) {
    const newline = text.indexOf("\n", start);
    const newlineIndex = newline === -1 ? text.length : newline;
    const contentEnd =
      newlineIndex > start && text[newlineIndex - 1] === "\r" ? newlineIndex - 1 : newlineIndex;
    const next = newline === -1 ? text.length : newline + 1;
    lines.push({
      content: text.slice(start, contentEnd),
      ending: text.slice(contentEnd, next),
      start,
      lineEnd: contentEnd,
      next,
    });
    start = next;
  }
  return lines;
}

function parseAssignment(line) {
  const match = /^(\s*(?:export\s+)?)([\w.-]+)(\s*=\s*|\s*:\s+)(.*)$/.exec(line.content);
  if (!match) return null;
  const prefix = `${match[1]}${match[2]}${match[3]}`;
  return {
    key: match[2],
    content: line.content,
    prefix,
    rawValue: match[4],
    start: line.start,
    end: line.next,
    lineEnd: line.lineEnd,
    valueStart: prefix.length,
  };
}

function scanAssignments(text) {
  const assignments = [];
  let quote;
  let multilineAssignment;
  for (const line of splitLines(text)) {
    if (quote) {
      if (findClosingQuote(line.content, -1, quote) === -1) continue;
      multilineAssignment.multiline = true;
      multilineAssignment.lineEnd = line.lineEnd;
      multilineAssignment.end = line.next;
      assignments.push(multilineAssignment);
      quote = undefined;
      multilineAssignment = undefined;
      continue;
    }

    const assignment = parseAssignment(line);
    if (!assignment) continue;
    const leading = assignment.rawValue.match(/^\s*/)?.[0].length ?? 0;
    const quoteStart = assignment.valueStart + leading;
    const valueQuote = assignment.content[quoteStart];
    if (!['"', "'", "`"].includes(valueQuote)) {
      assignments.push(assignment);
      continue;
    }

    const quoteEnd = findClosingQuote(assignment.content, quoteStart, valueQuote);
    if (quoteEnd === -1) {
      quote = valueQuote;
      multilineAssignment = assignment;
      continue;
    }
    assignment.quoteStart = quoteStart;
    assignment.quoteEnd = quoteEnd;
    assignments.push(assignment);
  }
  return { assignments, unclosed: Boolean(quote) };
}

function findClosingQuote(line, openingIndex, quote) {
  let escaped = false;
  for (let index = openingIndex + 1; index < line.length; index += 1) {
    const character = line[index];
    if (escaped) escaped = false;
    else if (character === "\\") escaped = true;
    else if (character === quote) return index;
  }
  return -1;
}

function appendTarget(assignment, target) {
  const raw = assignment.rawValue;
  const leading = raw.match(/^\s*/)?.[0].length ?? 0;
  const quoteStart = assignment.valueStart + leading;
  const quote = assignment.content[quoteStart];

  if (["'", '"', "`"].includes(quote)) {
    const quoteEnd = findClosingQuote(assignment.content, quoteStart, quote);
    if (quoteEnd === -1) return null;
    const inner = assignment.content.slice(quoteStart + 1, quoteEnd);
    const innerLeading = inner.match(/^\s*/)?.[0] ?? "";
    const remainder = inner.slice(innerLeading.length);
    const innerTrailing = remainder.match(/\s*$/)?.[0] ?? "";
    const current = remainder.slice(0, remainder.length - innerTrailing.length);
    const merged = current ? `${current},${target}` : target;
    return (
      assignment.content.slice(0, quoteStart + 1) +
      innerLeading +
      merged +
      innerTrailing +
      assignment.content.slice(quoteEnd)
    );
  }

  const commentIndex = raw.indexOf("#");
  const valueEnd = commentIndex === -1 ? raw.length : commentIndex;
  const value = raw.slice(0, valueEnd);
  const valueLeading = value.match(/^\s*/)?.[0] ?? "";
  const remainder = value.slice(valueLeading.length);
  const valueTrailing = remainder.match(/\s*$/)?.[0] ?? "";
  const current = remainder.slice(0, remainder.length - valueTrailing.length);
  const merged = current ? `${current},${target}` : target;
  return (
    assignment.content.slice(0, assignment.valueStart) +
    valueLeading +
    merged +
    valueTrailing +
    raw.slice(valueEnd)
  );
}

function matchesEntry(key, entry, target) {
  if (key === "RAKAZO_TRUSTED_ORIGINS") return new URL(entry).origin === target;
  const normalized = entry.toLowerCase();
  const targetHost = target.toLowerCase();
  return (
    normalized === targetHost ||
    (normalized.startsWith(".") &&
      (targetHost === normalized.slice(1) || targetHost.endsWith(normalized)))
  );
}

function isExactOrigin(value) {
  if (typeof value !== "string" || /[\s\p{Cc}]/u.test(value)) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      !value.includes("?") &&
      !value.includes("#") &&
      !value.includes("*")
    );
  } catch {
    return false;
  }
}

function isAllowedHost(value) {
  if (typeof value !== "string" || !value || /[\s\\/@?#%]/.test(value)) return false;
  const candidate = value.startsWith(".") ? value.slice(1) : value;
  if (!candidate) return false;
  if (candidate.startsWith("[") && candidate.endsWith("]"))
    return isIP(candidate.slice(1, -1)) === 6;
  if (candidate.includes(":")) return false;

  const ascii = domainToASCII(candidate);
  if (!ascii || ascii.length > 253) return false;
  const labels = ascii.replace(/\.$/, "").split(".");
  return labels.every(
    (label) =>
      label.length > 0 && label.length <= 63 && /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label),
  );
}
