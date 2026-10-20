import { parse as parseShellCommand } from "shell-quote";

const SHELL_INTERPRETER_NAMES = /^(?:bash|sh|dash|zsh|ksh|fish)$/;
const STATIC_SHELL_EXPANSIONS: Readonly<Record<string, string>> = {
  HOME: "/home/rakazo",
  LOGNAME: "rakazo",
  PATH: "/home/rakazo/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
  PWD: "/home/rakazo",
  TMPDIR: "/tmp",
  USER: "rakazo",
  WORKSPACE: "/home/rakazo/workspace",
  XDG_CONFIG_HOME: "/home/rakazo/.config",
};
const SAFE_SHELL_CONTROL_OPS = new Set([
  "&&",
  "||",
  ";",
  "|",
  "&",
  ">",
  "<",
  ">>",
  ">&",
  "<&",
  "&>",
]);
/** Commands whose stdin heredoc is code, not data. Versioned names are matched separately. */
const HEREDOC_INTERPRETERS = new Set([
  "ash",
  "bash",
  "bun",
  "csh",
  "dash",
  "deno",
  "elixir",
  "fish",
  "julia",
  "ksh",
  "lua",
  "node",
  "nodejs",
  "perl",
  "php",
  "powershell",
  "pwsh",
  "pypy",
  "pypy3",
  "python",
  "python2",
  "python3",
  "ruby",
  "sh",
  "tcsh",
  "zsh",
]);
/** Stdin sinks. Any other heredoc consumer can run the body. */
const HEREDOC_DATA_SINKS = new Set(["cat", "tee"]);
const COMMAND_WRAPPERS = new Set([
  "builtin",
  "command",
  "env",
  "exec",
  "nice",
  "nohup",
  "stdbuf",
  "time",
]);
const LITERAL_KEY_PREFIX = "RKZLIT";

type ShellSeparator = "pipe" | "and" | "or" | "seq" | "background";
type PreparedDesktopCommand =
  | { command: string; literals: Readonly<Record<string, string>> }
  | { reason: string };
type AssignmentEntry = { name: string; value: string | null };
type PendingHeredoc = {
  delimiter: string;
  quoted: boolean;
  stripTabs: boolean;
  names?: string[];
};

function isHeredocInterpreter(name: string): boolean {
  if (HEREDOC_INTERPRETERS.has(name)) return true;
  return /^(?:python|ruby|perl|php|node)[\d.]+$/.test(name);
}

function isLiteralActivatePath(text: string): boolean {
  return /(?:^|\/)bin\/activate$/.test(text);
}

/**
 * Collapse repeated slashes and `.` / `..` without reading the filesystem.
 * A relative `..` that escapes the visible prefix stays in the result.
 * Undefined only when the path contains a null byte.
 */
function lexicalPath(path: string): string | undefined {
  if (path.includes("\0")) return undefined;
  const absolute = path.startsWith("/");
  const stack: string[] = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (absolute && stack.length === 0) continue;
      if (stack.length === 0 || stack.at(-1) === "..") stack.push("..");
      else stack.pop();
      continue;
    }
    stack.push(part);
  }
  if (absolute) return `/${stack.join("/")}`;
  return stack.join("/");
}

/** A write can plant `bin/activate`, or the path contains a null byte. */
function isActivateWritePath(path: string): boolean {
  const normalized = lexicalPath(path);
  if (normalized === undefined) return true;
  return isLiteralActivatePath(normalized);
}

/** Refuse planting a script that `source …/bin/activate` would later run unchecked. */
export function protectedActivateScriptWriteRefusal(path: string): string | undefined {
  return isActivateWritePath(path) ? "activate script" : undefined;
}

function unresolvedVariableReason(name: string): string {
  const trimmed = name.replaceAll(/[\r\n]/g, "").slice(0, 48);
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) return `unresolved variable $${trimmed}`;
  return `unresolved variable \${${trimmed}}`;
}

/** Quote-removed literal, or undefined when the word expands, globs, or runs a command. */
function literalCommandToken(raw: string): string | undefined {
  let text = "";
  let quote: "'" | '"' | undefined;
  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];
    if (quote === "'") {
      if (character === "'") quote = undefined;
      else text += character;
      continue;
    }
    if (character === "\\") {
      const next = raw[index + 1];
      if (next === undefined || next === "$" || next === "`") return undefined;
      text += next;
      index += 1;
      continue;
    }
    if (quote === '"') {
      if (character === '"') quote = undefined;
      else if (character === "$" || character === "`") return undefined;
      else text += character;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "$" || character === "`" || character === "*" || character === "?") {
      return undefined;
    }
    text += character;
  }
  if (quote) return undefined;
  return text;
}

function literalAssignmentValue(raw: string): string | undefined {
  let value = "";
  let quote: "'" | '"' | undefined;
  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];
    if (quote === "'") {
      if (character === "'") quote = undefined;
      else value += character;
      continue;
    }
    if (character === "\\") {
      const next = raw[index + 1];
      if (next === undefined) return undefined;
      const quotedLiteralEscape =
        quote === '"' &&
        next !== '"' &&
        next !== "\\" &&
        next !== "$" &&
        next !== "`" &&
        next !== "\n";
      value += quotedLiteralEscape ? `\\${next}` : next;
      index += 1;
      continue;
    }
    if (quote === '"') {
      if (character === '"') quote = undefined;
      else if (character === "$" || character === "`") return undefined;
      else value += character;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "$" || character === "`") return undefined;
    value += character;
  }
  if (quote) return undefined;
  return value;
}

function parseAssignment(raw: string): AssignmentEntry | undefined {
  if (raw.startsWith("'") || raw.startsWith('"')) return undefined;
  const append = /^([A-Za-z_][A-Za-z0-9_]*)\+=/.exec(raw);
  if (append?.[1]) return { name: append[1], value: null };
  const match = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(raw);
  if (!match?.[1]) return undefined;
  const value = literalAssignmentValue(raw.slice(match[0].length));
  return { name: match[1], value: value ?? null };
}

function assignmentEntries(words: readonly string[]): AssignmentEntry[] | undefined {
  if (words.length === 0) return undefined;
  let index = 0;
  if (literalCommandToken(words[0] ?? "") === "export") index = 1;
  if (index >= words.length) return undefined;
  const entries: AssignmentEntry[] = [];
  for (; index < words.length; index += 1) {
    const parsed = parseAssignment(words[index] ?? "");
    if (!parsed) return undefined;
    entries.push(parsed);
  }
  return entries;
}

function isRawAssignment(raw: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*(?:\+?=)/.test(raw);
}

function primaryCommandIndex(words: readonly string[]): number | undefined {
  let index = 0;
  while (index < words.length) {
    const raw = words[index] ?? "";
    if (isRawAssignment(raw)) {
      index += 1;
      continue;
    }
    const text = literalCommandToken(raw);
    if (text === undefined) return undefined;
    if (text === "!") {
      index += 1;
      continue;
    }
    const base = text.split("/").at(-1) ?? text;
    if (COMMAND_WRAPPERS.has(base)) {
      index += 1;
      while (
        index < words.length &&
        (literalCommandToken(words[index] ?? "") ?? "").startsWith("-")
      ) {
        index += 1;
      }
      continue;
    }
    return index;
  }
  return undefined;
}

function commandBasename(words: readonly string[]): string | undefined {
  if (words.length === 0 || assignmentEntries(words)) return undefined;
  const commandIndex = primaryCommandIndex(words);
  if (commandIndex === undefined) return "";
  const text = literalCommandToken(words[commandIndex] ?? "");
  if (!text) return "";
  return (text.split("/").at(-1) ?? "").toLowerCase();
}

function isUnsafeSource(words: readonly string[]): boolean {
  const commandIndex = primaryCommandIndex(words);
  if (commandIndex === undefined) return false;
  const primary = literalCommandToken(words[commandIndex] ?? "");
  // Only the exact builtins. A variable path can hide an arbitrary script.
  if (primary !== "source" && primary !== ".") return false;
  const argument = words[commandIndex + 1];
  if (argument === undefined) return true;
  const text = literalCommandToken(argument);
  if (text === undefined) return true;
  return !isLiteralActivatePath(text);
}

const EXTERNAL_ASSIGNMENT_COMMANDS = new Set([
  "declare",
  "getopts",
  "local",
  "mapfile",
  "read",
  "readarray",
  "readonly",
  "typeset",
]);
const ACTIVATE_DESTINATION_COMMANDS = new Set(["cp", "install", "ln", "mv"]);

function commandBaseAt(words: readonly string[], index: number): string | undefined {
  const text = literalCommandToken(words[index] ?? "");
  if (!text) return undefined;
  return (text.split("/").at(-1) ?? text).toLowerCase();
}

function identifierFromToken(token: string | undefined): string | undefined {
  if (token && /^[A-Za-z_][A-Za-z0-9_]*$/.test(token)) return token;
  return undefined;
}

/** A redirect or writer operand, resolved when it is one tracked literal. */
function activateOperand(
  raw: string,
  words: readonly string[],
  env: ReadonlyMap<string, string>,
): string | undefined {
  const literal = literalCommandToken(raw);
  if (literal !== undefined) return literal;
  const bare = raw.replaceAll(/['"]/g, "");
  if (isLiteralActivatePath(bare)) return bare;
  const match = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$|^\$([A-Za-z_][A-Za-z0-9_]*)$/.exec(bare);
  const name = match?.[1] ?? match?.[2];
  if (!name) return undefined;
  for (const word of words) {
    const parsed = parseAssignment(word);
    if (!parsed) break;
    if (parsed.name === name && parsed.value !== null) return parsed.value;
  }
  return env.get(name);
}

function isActivateWriteTarget(
  op: string,
  raw: string,
  words: readonly string[],
  env: ReadonlyMap<string, string>,
): boolean {
  if (op !== ">" && op !== ">>" && op !== "&>" && op !== ">&") return false;
  const text = activateOperand(raw, words, env);
  if (text === undefined) return false;
  if (op === ">&" && /^\d+$/.test(text)) return false;
  return isActivateWritePath(text);
}

function commandWritesActivateScript(
  words: readonly string[],
  env: ReadonlyMap<string, string>,
): boolean {
  const index = primaryCommandIndex(words);
  if (index === undefined) return false;
  const base = commandBaseAt(words, index);
  if (!base) return false;
  const args = words.slice(index + 1);
  if (base === "dd") {
    return args.some((raw) => {
      const token = literalCommandToken(raw);
      return Boolean(token?.startsWith("of=") && isActivateWritePath(token.slice("of=".length)));
    });
  }
  if (base === "tee") {
    return args.some((raw) => {
      const token = literalCommandToken(raw);
      if (token === "--" || (token?.startsWith("-") && token !== "-")) return false;
      const value = activateOperand(raw, words, env);
      return value !== undefined && isActivateWritePath(value);
    });
  }
  if (!ACTIVATE_DESTINATION_COMMANDS.has(base)) return false;
  return copyCommandWritesActivate(base, args, words, env);
}

const COPY_ARGUMENT_LETTERS: Record<string, string> = {
  cp: "tS",
  install: "gmotS",
  ln: "tS",
  mv: "tS",
};

const COPY_LONG_ARGUMENTS = new Set([
  "--group",
  "--mode",
  "--owner",
  "--strip-program",
  "--suffix",
  "--target-directory",
]);

/** `cp -t dir file` writes `dir/file`, not `file`. The same `-t` form applies to install, ln, and mv. */
function copyCommandWritesActivate(
  base: string,
  args: readonly string[],
  words: readonly string[],
  env: ReadonlyMap<string, string>,
): boolean {
  const letters = COPY_ARGUMENT_LETTERS[base] ?? "t";
  let targetDir: string | undefined;
  const sources: string[] = [];
  let hiddenSource = false;
  let recursive = false;
  let options = true;
  for (let index = 0; index < args.length; index += 1) {
    const raw = args[index] ?? "";
    const token = literalCommandToken(raw);
    if (options && token === "--") {
      options = false;
      continue;
    }
    if (options && token?.startsWith("--")) {
      const eq = token.indexOf("=");
      const name = eq === -1 ? token : token.slice(0, eq);
      let value = eq === -1 ? undefined : token.slice(eq + 1);
      if (COPY_LONG_ARGUMENTS.has(name) && eq === -1) {
        index += 1;
        value = index < args.length ? activateOperand(args[index] ?? "", words, env) : undefined;
      }
      if (name === "--recursive" || name === "--archive") recursive = true;
      if (name === "--target-directory") {
        if (value === undefined) return true;
        targetDir = value;
      }
      continue;
    }
    if (options && token?.startsWith("-") && token !== "-") {
      for (let cursor = 1; cursor < token.length; cursor += 1) {
        const letter = token[cursor] ?? "";
        if (base === "cp" && (letter === "a" || letter === "r" || letter === "R")) recursive = true;
        if (!letters.includes(letter)) continue;
        const rest = token.slice(cursor + 1);
        let value: string | undefined;
        if (rest.length > 0) value = rest;
        else if (index + 1 < args.length) {
          index += 1;
          value = activateOperand(args[index] ?? "", words, env);
        }
        if (letter === "t") {
          if (value === undefined) return true;
          targetDir = value;
        }
        break;
      }
      continue;
    }
    const value = token === undefined ? activateOperand(raw, words, env) : token;
    if (value === undefined) {
      hiddenSource = true;
      continue;
    }
    sources.push(value);
  }
  if (targetDir !== undefined) {
    if (hiddenSource) return true;
    const directory = targetDir;
    if (transfersBinDirectory(base, recursive, true, directory, sources)) return true;
    return sources.some((source) => copiedIntoActivates(directory, source));
  }
  const destination = sources.at(-1);
  if (
    destination !== undefined &&
    transfersBinDirectory(
      base,
      recursive,
      isDirectoryDestination(destination),
      destination,
      sources.slice(0, -1),
    )
  ) {
    return true;
  }
  return destination !== undefined && isActivateWritePath(destination);
}

function lastPathComponent(path: string): string {
  const stripped = path.replace(/\/+$/, "");
  const collapsed = lexicalPath(stripped) ?? stripped;
  const slash = collapsed.lastIndexOf("/");
  return slash === -1 ? collapsed : collapsed.slice(slash + 1);
}

function isDirectoryDestination(path: string): boolean {
  return path.endsWith("/") || lastPathComponent(path) === "." || lastPathComponent(path) === "..";
}

/**
 * Placing a directory named bin onto another bin, or into a directory, can
 * plant bin/activate. A destination that merely ends in bin is a file rename.
 */
function transfersBinDirectory(
  base: string,
  recursive: boolean,
  destIsDirectory: boolean,
  destination: string,
  sources: readonly string[],
): boolean {
  if (base !== "mv" && base !== "ln" && !(base === "cp" && recursive)) return false;
  if (!sources.some((source) => lastPathComponent(source) === "bin")) return false;
  if (lastPathComponent(destination) === "bin") return true;
  return destIsDirectory;
}

function copiedIntoActivates(directory: string, source: string): boolean {
  const stripped = source.replace(/\/+$/, "");
  const slash = stripped.lastIndexOf("/");
  const name = slash === -1 ? stripped : stripped.slice(slash + 1);
  if (name === "" || name === "." || name === "..") return isActivateWritePath(directory);
  const prefix = directory.endsWith("/") ? directory : `${directory}/`;
  return isActivateWritePath(`${prefix}${name}`);
}

function printfAssignedName(args: readonly string[]): string | null | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const token = literalCommandToken(args[index] ?? "");
    if (token === undefined) return null;
    if (token === "--") return undefined;
    if (token === "-v") {
      return identifierFromToken(literalCommandToken(args[index + 1] ?? "")) ?? null;
    }
    if (token.startsWith("-v")) return identifierFromToken(token.slice(2)) ?? null;
    if (token.startsWith("-")) continue;
    return undefined;
  }
  return undefined;
}

/**
 * Variables a command may assign outside a plain assignment list.
 * `clear` drops every tracked literal: the target was not a fixed name, a
 * nameref can retarget one, or a sourced script can assign anything.
 * Undefined means this command cannot.
 */
function externalAssignments(
  words: readonly string[],
): { clear: boolean; names: readonly string[] } | undefined {
  const index = primaryCommandIndex(words);
  if (index === undefined) return undefined;
  const base = commandBaseAt(words, index);
  if (!base) return { clear: true, names: [] };
  const args = words.slice(index + 1);
  if (base === "source" || base === ".") return { clear: true, names: [] };
  if (base === "for") {
    const name = identifierFromToken(literalCommandToken(args[0] ?? ""));
    if (!name) return { clear: true, names: [] };
    return { clear: false, names: [name] };
  }
  if (base === "printf") {
    const target = printfAssignedName(args);
    if (target === undefined) return undefined;
    if (target === null) return { clear: true, names: [] };
    return { clear: false, names: [target] };
  }
  if (!EXTERNAL_ASSIGNMENT_COMMANDS.has(base)) return undefined;
  const names: string[] = [];
  if (base === "read") names.push("REPLY");
  if (base === "mapfile" || base === "readarray") names.push("MAPFILE");
  if (base === "getopts") names.push("OPTARG", "OPTIND");
  const namerefCommand =
    base === "declare" || base === "local" || base === "readonly" || base === "typeset";
  let options = true;
  let nameref = false;
  for (const raw of args) {
    const token = literalCommandToken(raw);
    if (token === undefined) return { clear: true, names };
    if (options && token === "--") {
      options = false;
      continue;
    }
    if (options && token.startsWith("-")) {
      // `-n` retargets a later assignment. Drop every literal instead of following it.
      if (namerefCommand && !token.startsWith("--") && token.slice(1).includes("n")) nameref = true;
      continue;
    }
    const parsed = parseAssignment(raw);
    if (parsed) {
      names.push(parsed.name);
      continue;
    }
    const name = identifierFromToken(token);
    if (name) names.push(name);
  }
  if (nameref) return { clear: true, names: [] };
  return { clear: false, names };
}

function readHeredocDelimiter(
  source: string,
  start: number,
): { end: number; delimiter: string; quoted: boolean } | undefined {
  let index = start;
  while (source[index] === " " || source[index] === "\t") index += 1;
  const first = source[index];
  if (first === undefined || first === "\n" || first === "#") return undefined;
  let delimiter = "";
  let quoted = false;
  let quote: "'" | '"' | undefined;
  while (index < source.length) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = undefined;
      else delimiter += character;
      index += 1;
      continue;
    }
    if (character === "'" || character === '"') {
      quoted = true;
      quote = character;
      index += 1;
      continue;
    }
    if (character === "\\") {
      const next = source[index + 1];
      if (next === undefined || next === "\n") return undefined;
      quoted = true;
      delimiter += next;
      index += 2;
      continue;
    }
    if (character !== undefined && /[\s|&;<>()]/.test(character)) break;
    delimiter += character ?? "";
    index += 1;
  }
  if (quote || delimiter.length === 0) return undefined;
  return { end: index, delimiter, quoted };
}

function readHeredocBody(
  source: string,
  start: number,
  delimiter: string,
  stripTabs: boolean,
): { end: number; content: string } | undefined {
  let index = start;
  while (index <= source.length) {
    const lineEnd = source.indexOf("\n", index);
    const end = lineEnd === -1 ? source.length : lineEnd;
    const compared = stripTabs
      ? source.slice(index, end).replace(/^\t+/, "")
      : source.slice(index, end);
    if (compared === delimiter) {
      return {
        end: lineEnd === -1 ? source.length : lineEnd + 1,
        content: source.slice(start, index),
      };
    }
    if (lineEnd === -1) return undefined;
    index = lineEnd + 1;
  }
  return undefined;
}

/** Unquoted heredoc bodies expand even inside quote characters. */
function heredocBodyHazard(body: string): string | undefined {
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (character === "\\") {
      const next = body[index + 1];
      if (next === "$" || next === "`" || next === "\\" || next === "\n") {
        index += 1;
        continue;
      }
    }
    if (character === "`") return "backtick";
    if (character === "$" && body[index + 1] === "(") {
      return body[index + 2] === "(" ? "arithmetic expansion" : "command substitution";
    }
  }
  return undefined;
}

function matchingBrace(body: string, openIndex: number): number | undefined {
  let depth = 1;
  let index = openIndex + 1;
  while (index < body.length) {
    const character = body[index];
    if (character === "'") {
      const end = body.indexOf("'", index + 1);
      if (end === -1) return undefined;
      index = end + 1;
      continue;
    }
    if (character === '"') {
      index += 1;
      while (index < body.length && body[index] !== '"') {
        if (body[index] === "\\" && index + 1 < body.length) index += 2;
        else index += 1;
      }
      if (index >= body.length) return undefined;
      index += 1;
      continue;
    }
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
    index += 1;
  }
  return undefined;
}

function matchingParen(body: string, openIndex: number): number | undefined {
  let depth = 1;
  let index = openIndex + 1;
  while (index < body.length) {
    const character = body[index];
    if (character === "'") {
      const end = body.indexOf("'", index + 1);
      if (end === -1) return undefined;
      index = end + 1;
      continue;
    }
    if (character === '"') {
      index += 1;
      while (index < body.length && body[index] !== '"') {
        if (body[index] === "\\" && index + 1 < body.length) index += 2;
        else index += 1;
      }
      if (index >= body.length) return undefined;
      index += 1;
      continue;
    }
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === "(") depth += 1;
    else if (character === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
    index += 1;
  }
  return undefined;
}

/** Literal text of a double-quoted span, plus command-substitution interiors. */
function readDoubleQuoted(
  body: string,
  start: number,
): { end: number; literal: string; dynamic: boolean; interiors: string[] } | undefined {
  let literal = "";
  let dynamic = false;
  const interiors: string[] = [];
  let index = start;
  while (index < body.length) {
    const character = body[index];
    if (character === '"') {
      if (dynamic && literal.length > 0) return undefined;
      return { end: index + 1, literal: dynamic ? "" : literal, dynamic, interiors };
    }
    if (character === "\\") {
      const next = body[index + 1];
      if (next === undefined) return undefined;
      literal += next;
      index += 2;
      continue;
    }
    if (character === "`") return undefined;
    if (character === "$" && body[index + 1] === "(") {
      if (body[index + 2] === "(") return undefined;
      const close = matchingParen(body, index + 1);
      if (close === undefined) return undefined;
      interiors.push(body.slice(index + 2, close));
      dynamic = true;
      index = close + 1;
      continue;
    }
    if (character === "$") {
      dynamic = true;
      if (body[index + 1] === "{") {
        const close = body.indexOf("}", index + 2);
        if (close === -1) return undefined;
        index = close + 1;
        continue;
      }
      if (/[A-Za-z_]/.test(body[index + 1] ?? "")) {
        index += 2;
        while (index < body.length && /[A-Za-z0-9_]/.test(body[index] ?? "")) index += 1;
        continue;
      }
      index += 1;
      continue;
    }
    literal += character ?? "";
    index += 1;
  }
  return undefined;
}

/**
 * Shell words of a quoted heredoc body. Adjacent quotes concatenate, so
 * `pk''ill` is `pkill`. Undefined when a word's text cannot be known.
 */
function quotedHeredocWords(body: string): string[] | undefined {
  const words: string[] = [];
  let word = "";
  let active = false;
  const commit = () => {
    if (!active) return;
    words.push(word);
    word = "";
    active = false;
  };
  let index = 0;
  while (index < body.length) {
    const character = body[index] ?? "";
    if (!active && character === "#") {
      const newline = body.indexOf("\n", index);
      index = newline === -1 ? body.length : newline + 1;
      continue;
    }
    if (character === "'") {
      const end = body.indexOf("'", index + 1);
      if (end === -1) return undefined;
      word += body.slice(index + 1, end);
      active = true;
      index = end + 1;
      continue;
    }
    if (character === '"') {
      const quoted = readDoubleQuoted(body, index + 1);
      if (!quoted) return undefined;
      if (quoted.dynamic && quoted.literal.length > 0) return undefined;
      if (quoted.dynamic) {
        for (const interior of quoted.interiors) {
          const inner = quotedHeredocWords(interior);
          if (!inner) return undefined;
          words.push(...inner);
        }
        index = quoted.end;
        continue;
      }
      word += quoted.literal;
      active = true;
      index = quoted.end;
      continue;
    }
    if (character === "\\") {
      const next = body[index + 1];
      if (next === undefined) return undefined;
      if (next !== "\n") {
        word += next;
        active = true;
      }
      index += 2;
      continue;
    }
    if (character === "`") return undefined;
    if (character === "$" && (body[index + 1] === "'" || body[index + 1] === '"')) {
      return undefined;
    }
    if (character === "$" && body[index + 1] === "(") {
      if (body[index + 2] === "(" || active) return undefined;
      const close = matchingParen(body, index + 1);
      if (close === undefined) return undefined;
      const inner = quotedHeredocWords(body.slice(index + 2, close));
      if (!inner) return undefined;
      words.push(...inner);
      index = close + 1;
      continue;
    }
    if (character === "$") {
      // A parameter glued to literals (`pk$ill`, `$a'pkill'`) hides the word.
      if (active) return undefined;
      const end = skipPlainParameter(body, index);
      if (end === undefined) return undefined;
      const next = body[end] ?? "";
      if (next !== "" && !" \t\n;&|<>(){}".includes(next)) return undefined;
      index = end;
      continue;
    }
    if (" \t\n;&|<>(){}".includes(character)) {
      if (character === "<" && body[index + 1] === "(") return undefined;
      // `{pk,ill}` is brace expansion. A brace group is `{` then a separator.
      if (
        character === "{" &&
        body[index + 1] !== undefined &&
        !" \t\n;&|<>(){}".includes(body[index + 1] ?? "")
      ) {
        return undefined;
      }
      commit();
      index += 1;
      continue;
    }
    word += character;
    active = true;
    index += 1;
  }
  commit();
  return words;
}

function wordsHaveLifecycleHazard(words: readonly string[]): boolean {
  let sawService = false;
  let sawServiceAction = false;
  for (const word of words) {
    const folded = word.toLowerCase();
    if (/(?:\.browser-profiles|--user-data-dir)/.test(folded)) return true;
    if (/(?:\/tmp\/\.x11-unix|\/tmp\/\.x\d+-lock)/.test(folded)) return true;
    const base = folded.split("/").at(-1) ?? "";
    if (/^(?:kill|pkill|killall|xkill)$/.test(base)) return true;
    if (base === "systemctl" || base === "service") sawService = true;
    if (/^(?:stop|restart|kill)$/.test(base)) sawServiceAction = true;
  }
  return sawService && sawServiceAction;
}

/** Drop quotes, backslashes, and `$`, and skip a `#` comment that starts a word. */
function normalizedHeredocWords(body: string): string[] {
  let text = "";
  let quote: "'" | '"' | undefined;
  let atWordStart = true;
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index] ?? "";
    if (quote) {
      if (character === quote) quote = undefined;
      else if (character !== "\\" && character !== "$") {
        text += character;
        atWordStart = false;
      }
      continue;
    }
    if (atWordStart && character === "#") {
      const newline = body.indexOf("\n", index);
      index = newline === -1 ? body.length : newline;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "\\" || character === "$") continue;
    if (character === " " || character === "\t" || character === "\n") atWordStart = true;
    else atWordStart = false;
    text += character;
  }
  return text.split(/[\s;&|<>(){}]+/).filter((word) => word.length > 0);
}

/**
 * A quoted body is data. Refuse when a lifecycle word is visible, including one
 * assembled across a command substitution (`p$(printf k)ill`). A later shell
 * call would run that file without seeing this body.
 */
function quotedHeredocLifecycleHazard(body: string): boolean {
  const words = quotedHeredocWords(body);
  if (words && wordsHaveLifecycleHazard(words)) return true;
  if (wordsHaveLifecycleHazard(normalizedHeredocWords(body))) return true;
  return splicedLifecycleHazard(body);
}

type SplicePiece = { segments: string[]; holes: string[][] };

const SPLICE_SOLO_COMMANDS = ["kill", "pkill", "killall", "xkill"];
const SPLICE_SERVICE_COMMANDS = ["systemctl", "service"];
const SPLICE_PATHS = [".browser-profiles", "--user-data-dir", "/tmp/.x11-unix"];

function affixMatches(first: string, last: string, value: string): boolean {
  return (
    value.length > first.length + last.length && value.startsWith(first) && value.endsWith(last)
  );
}

/** `p$(…)ill` still names `pkill` when the hole's output is not a visible literal. */
function spliceAffixKind(piece: SplicePiece): "solo" | "service" | undefined {
  if (piece.holes.length === 0) return undefined;
  const first = (piece.segments[0] ?? "").toLowerCase();
  const last = (piece.segments[piece.segments.length - 1] ?? "").toLowerCase();
  if (first.length === 0 || last.length === 0) return undefined;
  if (SPLICE_SOLO_COMMANDS.some((name) => affixMatches(first, last, name))) return "solo";
  if (SPLICE_PATHS.some((path) => affixMatches(first, last, path))) return "solo";
  if (first === "/tmp/.x" && last === "-lock") return "solo";
  if (SPLICE_SERVICE_COMMANDS.some((name) => affixMatches(first, last, name))) return "service";
  return undefined;
}

function pieceCandidates(piece: SplicePiece): { words: string[]; overflow: boolean } {
  if (piece.holes.length === 0) {
    const word = piece.segments[0] ?? "";
    return { words: word.length > 0 ? [word] : [], overflow: false };
  }
  const limit = 48;
  let current = [piece.segments[0] ?? ""];
  let overflow = false;
  for (let hole = 0; hole < piece.holes.length; hole += 1) {
    const inserts = piece.holes[hole] ?? [""];
    const tail = piece.segments[hole + 1] ?? "";
    const next: string[] = [];
    for (const prefix of current) {
      for (const insert of inserts) {
        if (next.length >= limit) {
          overflow = true;
          break;
        }
        next.push(`${prefix}${insert}${tail}`);
      }
      if (overflow) break;
    }
    current = next;
    if (overflow) break;
  }
  return { words: current.filter((word) => word.length > 0), overflow };
}

function substitutionInserts(interior: string, depth: number): string[] {
  if (depth > 6) return [""];
  const inserts = new Set<string>([""]);
  const parsed = quotedHeredocWords(interior);
  for (const word of parsed ?? normalizedHeredocWords(interior)) inserts.add(word);
  const nested = splicePieces(interior, depth + 1);
  if (!nested) return [...inserts];
  for (const piece of nested) {
    for (const word of pieceCandidates(piece).words) inserts.add(word);
  }
  return [...inserts];
}

/** Shell words of a quoted body, with command-substitution holes kept in place. */
function splicePieces(body: string, depth = 0): SplicePiece[] | undefined {
  if (depth > 6) return undefined;
  const pieces: SplicePiece[] = [];
  let segments = [""];
  let holes: string[][] = [];
  let active = false;
  const commit = () => {
    if (active || holes.length > 0) pieces.push({ segments, holes });
    segments = [""];
    holes = [];
    active = false;
  };
  const append = (text: string) => {
    if (text.length === 0) return;
    segments[segments.length - 1] = `${segments[segments.length - 1] ?? ""}${text}`;
    active = true;
  };
  const addHole = (inserts: readonly string[]) => {
    holes.push([...inserts]);
    segments.push("");
    active = true;
  };
  const expansionAt = (
    start: number,
  ): { end: number; inserts: string[] } | "literal" | undefined => {
    const next = body[start + 1];
    if (next !== "(") return "literal";
    const close = matchingParen(body, start + 1);
    if (close === undefined) return undefined;
    const interior = body.slice(start + 2, close);
    if (next === "(" && body[start + 2] === "(") {
      return { end: close + 1, inserts: ["", ...normalizedHeredocWords(interior)] };
    }
    return { end: close + 1, inserts: substitutionInserts(interior, depth + 1) };
  };
  const backtickAt = (start: number): { end: number; inserts: string[] } | undefined => {
    let cursor = start + 1;
    let interior = "";
    while (cursor < body.length) {
      const character = body[cursor] ?? "";
      if (character === "\\" && cursor + 1 < body.length) {
        interior += body[cursor + 1] ?? "";
        cursor += 2;
        continue;
      }
      if (character === "`") {
        return { end: cursor + 1, inserts: substitutionInserts(interior, depth + 1) };
      }
      interior += character;
      cursor += 1;
    }
    return undefined;
  };
  const parameterAt = (start: number): { end: number } | undefined => {
    const next = body[start + 1];
    if (next === "{") {
      const match = /^\{[A-Za-z_][A-Za-z0-9_]*\}/.exec(body.slice(start + 1));
      if (match) return { end: start + 1 + match[0].length };
      const close = matchingBrace(body, start + 1);
      if (close === undefined) return undefined;
      return { end: close + 1 };
    }
    if (next && /[A-Za-z_]/.test(next)) {
      let cursor = start + 2;
      while (cursor < body.length && /[A-Za-z0-9_]/.test(body[cursor] ?? "")) cursor += 1;
      return { end: cursor };
    }
    if (next && /[0-9*@#?$!-]/.test(next)) return { end: start + 2 };
    return undefined;
  };

  const finish = (): SplicePiece[] => {
    commit();
    return pieces;
  };
  let index = 0;
  let quote: "'" | '"' | undefined;
  while (index < body.length) {
    const character = body[index] ?? "";
    if (quote === "'") {
      if (character === "'") quote = undefined;
      else append(character);
      index += 1;
      continue;
    }
    if (character === "\\") {
      const next = body[index + 1];
      if (next === undefined) return finish();
      if (next !== "\n") append(next);
      index += 2;
      continue;
    }
    if (quote === '"') {
      if (character === '"') {
        quote = undefined;
        index += 1;
        continue;
      }
      if (character === "`") {
        const tick = backtickAt(index);
        if (!tick) return finish();
        addHole(tick.inserts);
        index = tick.end;
        continue;
      }
      if (character === "$" && body[index + 1] === "(") {
        const expansion = expansionAt(index);
        if (expansion === undefined || expansion === "literal") return finish();
        addHole(expansion.inserts);
        index = expansion.end;
        continue;
      }
      if (character === "$") {
        const parameter = parameterAt(index);
        if (!parameter) return finish();
        addHole([""]);
        index = parameter.end;
        continue;
      }
      append(character);
      index += 1;
      continue;
    }
    if (!active && holes.length === 0 && (segments[0] ?? "") === "" && character === "#") {
      const newline = body.indexOf("\n", index);
      index = newline === -1 ? body.length : newline + 1;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      active = true;
      index += 1;
      continue;
    }
    if (character === "`") {
      const tick = backtickAt(index);
      if (!tick) return finish();
      addHole(tick.inserts);
      index = tick.end;
      continue;
    }
    if (character === "$" && body[index + 1] === "(") {
      const expansion = expansionAt(index);
      if (expansion === undefined || expansion === "literal") return finish();
      addHole(expansion.inserts);
      index = expansion.end;
      continue;
    }
    if (character === "$") {
      const parameter = parameterAt(index);
      if (!parameter) {
        append("$");
        index += 1;
        continue;
      }
      addHole([""]);
      index = parameter.end;
      continue;
    }
    if (" \t\n;&|<>(){}".includes(character)) {
      commit();
      index += 1;
      continue;
    }
    append(character);
    index += 1;
  }
  return finish();
}

function kmpFailure(target: string): number[] {
  const failure = Array<number>(target.length).fill(0);
  let matched = 0;
  for (let index = 1; index < target.length; index += 1) {
    while (matched > 0 && target[index] !== target[matched]) matched = failure[matched - 1] ?? 0;
    if (target[index] === target[matched]) {
      matched += 1;
      failure[index] = matched;
    }
  }
  return failure;
}

function kmpStep(
  state: number,
  character: string,
  target: string,
  failure: readonly number[],
): number {
  let next = state;
  while (next > 0 && (next === target.length || target[next] !== character)) {
    next = failure[next - 1] ?? 0;
  }
  if (target[next] === character) next += 1;
  return next;
}

function foldedSplice(piece: SplicePiece): { segments: string[]; holes: string[][] } {
  return {
    segments: piece.segments.map((segment) => segment.toLowerCase()),
    holes: piece.holes.map((inserts) => inserts.map((insert) => insert.toLowerCase())),
  };
}

/** Some combination of the visible hole texts is exactly `target`. */
function spliceEquals(
  segments: readonly string[],
  holes: readonly (readonly string[])[],
  target: string,
): boolean {
  let positions = new Set<number>();
  const first = segments[0] ?? "";
  if (target.startsWith(first)) positions.add(first.length);
  for (let hole = 0; hole < holes.length; hole += 1) {
    const segment = segments[hole + 1] ?? "";
    const next = new Set<number>();
    for (const position of positions) {
      for (const insert of holes[hole] ?? [""]) {
        if (!target.startsWith(insert, position)) continue;
        const after = position + insert.length;
        if (target.startsWith(segment, after)) next.add(after + segment.length);
      }
    }
    positions = next;
    if (positions.size === 0) return false;
  }
  return positions.has(target.length);
}

/**
 * Walks every combination without building it. `contains` is a hit anywhere;
 * `ends` means some combination ends with `target`.
 */
function scanSpliceTarget(
  segments: readonly string[],
  holes: readonly (readonly string[])[],
  target: string,
): { contains: boolean; ends: boolean } {
  const failure = kmpFailure(target);
  let states = new Set<number>([0]);
  let contains = false;
  const apply = (text: string) => {
    for (const character of text) {
      const next = new Set<number>();
      for (const state of states) {
        const stepped = kmpStep(state, character, target, failure);
        if (stepped === target.length) contains = true;
        next.add(stepped);
      }
      states = next;
    }
  };
  apply(segments[0] ?? "");
  for (let index = 0; index < holes.length; index += 1) {
    const start = states;
    const merged = new Set<number>();
    for (const insert of holes[index] ?? [""]) {
      states = new Set(start);
      apply(insert);
      for (const state of states) merged.add(state);
    }
    states = merged;
    apply(segments[index + 1] ?? "");
  }
  return { contains, ends: states.has(target.length) };
}

const X_LOCK_PREFIX = "/tmp/.x";
const X_LOCK_SUFFIX = "-lock";

function consumeXLock(states: Set<string>, text: string): boolean {
  for (const character of text) {
    const next = new Set<string>();
    for (const key of states) {
      const parts = key.split(",");
      const pre = Number(parts[0] ?? 0);
      const digit = Number(parts[1] ?? 0);
      const lock = Number(parts[2] ?? 0);
      const add = (prefix: number, seenDigit: number, lockPos: number) => {
        next.add(`${prefix},${seenDigit},${lockPos}`);
      };
      const expected = X_LOCK_SUFFIX[lock];
      if (lock > 0) {
        if (expected !== undefined && character === expected) add(pre, digit, lock + 1);
      } else if (pre === X_LOCK_PREFIX.length) {
        if (/\d/.test(character)) add(pre, 1, 0);
        else if (digit === 1 && character === "-") add(pre, 1, 1);
      } else if (character === X_LOCK_PREFIX[pre]) {
        add(pre + 1, 0, 0);
      }
      if (character === "/") add(1, 0, 0);
      else add(0, 0, 0);
    }
    if ([...next].some((key) => key.endsWith(`,${X_LOCK_SUFFIX.length}`))) return true;
    states.clear();
    for (const key of next) states.add(key);
  }
  return false;
}

/** `/tmp/.x<digits>-lock` assembled from the visible pieces. */
function spliceContainsXLock(
  segments: readonly string[],
  holes: readonly (readonly string[])[],
): boolean {
  let states = new Set<string>(["0,0,0"]);
  if (consumeXLock(states, segments[0] ?? "")) return true;
  for (let index = 0; index < holes.length; index += 1) {
    const start = new Set(states);
    const merged = new Set<string>();
    for (const insert of holes[index] ?? [""]) {
      const clone = new Set(start);
      if (consumeXLock(clone, insert)) return true;
      for (const state of clone) merged.add(state);
    }
    states = merged;
    if (consumeXLock(states, segments[index + 1] ?? "")) return true;
  }
  return false;
}

function basenamePossible(
  segments: readonly string[],
  holes: readonly (readonly string[])[],
  name: string,
): boolean {
  return spliceEquals(segments, holes, name) || scanSpliceTarget(segments, holes, `/${name}`).ends;
}

/**
 * The candidate list is capped. A dropped combination still counts when the
 * visible pieces can form a lifecycle word; a dash-joined command substitution
 * cannot, so ordinary script text stays allowed.
 */
function overflowLifecycle(piece: SplicePiece): {
  hazard: boolean;
  service: boolean;
  action: boolean;
} {
  const { segments, holes } = foldedSplice(piece);
  const none = { hazard: false, service: false, action: false };
  if (holes.length === 0) return none;
  for (const name of ["kill", "pkill", "killall", "xkill"]) {
    if (basenamePossible(segments, holes, name))
      return { hazard: true, service: false, action: false };
  }
  for (const snippet of [".browser-profiles", "--user-data-dir", "/tmp/.x11-unix"]) {
    if (scanSpliceTarget(segments, holes, snippet).contains) {
      return { hazard: true, service: false, action: false };
    }
  }
  if (spliceContainsXLock(segments, holes)) return { hazard: true, service: false, action: false };
  return {
    hazard: false,
    service: ["systemctl", "service"].some((name) => basenamePossible(segments, holes, name)),
    action: ["stop", "restart", "kill"].some((name) => basenamePossible(segments, holes, name)),
  };
}

function splicedLifecycleHazard(body: string): boolean {
  const pieces = splicePieces(body);
  if (!pieces) return false;
  const words: string[] = [];
  let serviceAffix = false;
  let overflowService = false;
  let overflowAction = false;
  for (const piece of pieces) {
    const produced = pieceCandidates(piece);
    words.push(...produced.words);
    if (produced.overflow) {
      const extra = overflowLifecycle(piece);
      if (extra.hazard) return true;
      if (extra.service) overflowService = true;
      if (extra.action) overflowAction = true;
    }
    const kind = spliceAffixKind(piece);
    if (kind === "solo") return true;
    if (kind === "service") serviceAffix = true;
  }
  if (wordsHaveLifecycleHazard(words)) return true;
  const sawAction =
    overflowAction ||
    words.some((word) =>
      /^(?:stop|restart|kill)$/.test((word.split("/").at(-1) ?? "").toLowerCase()),
    );
  return (serviceAffix || overflowService) && sawAction;
}

function quotedHeredocBodyIsDynamic(body: string): boolean {
  if (body.includes("`")) return true;
  for (let index = 0; index < body.length - 1; index += 1) {
    if (body[index] !== "$") continue;
    const next = body[index + 1] ?? "";
    if (next === "(" || next === "{" || /[A-Za-z0-9_*@#?$!-]/.test(next)) return true;
  }
  return false;
}

/** `$name` or `${name}` only. Anything else can hide the word that runs. */
function skipPlainParameter(body: string, index: number): number | undefined {
  const next = body[index + 1];
  if (next === undefined) return undefined;
  if (next === "{") {
    const match = /^\{[A-Za-z_][A-Za-z0-9_]*\}/.exec(body.slice(index + 1));
    if (!match) return undefined;
    return index + 1 + match[0].length;
  }
  if (/[A-Za-z_]/.test(next)) {
    let cursor = index + 2;
    while (cursor < body.length && /[A-Za-z0-9_]/.test(body[cursor] ?? "")) cursor += 1;
    return cursor;
  }
  if (/[0-9*@#?$!-]/.test(next)) return index + 2;
  return undefined;
}

function normalizeWrittenPath(path: string): string {
  const collapsed = path.replaceAll(/\/+/g, "/");
  const stripped = collapsed.startsWith("./") ? collapsed.slice(2) : collapsed;
  return stripped.length > 1 && stripped.endsWith("/") ? stripped.slice(0, -1) : stripped;
}

function isFileWriteRedirect(op: string, target: string): boolean {
  if (op === ">" || op === ">>" || op === "&>") return true;
  return op === ">&" && !/^\d+$/.test(target);
}

function teeDestinationPaths(words: readonly string[]): string[] {
  const index = primaryCommandIndex(words);
  if (index === undefined) return [];
  if (commandBaseAt(words, index) !== "tee") return [];
  const paths: string[] = [];
  for (const raw of words.slice(index + 1)) {
    const token = literalCommandToken(raw);
    if (!token || token === "--" || (token.startsWith("-") && token !== "-")) continue;
    paths.push(normalizeWrittenPath(token));
  }
  return paths;
}

function pathTail(path: string): string | undefined {
  const base = normalizeWrittenPath(path)
    .split("/")
    .filter((part) => part.length > 0)
    .at(-1);
  if (base === undefined || base === "." || base === "..") return undefined;
  return base;
}

function resolveExecutionPath(cwd: string | undefined, command: string): string | undefined {
  const joined =
    command.startsWith("/") || cwd === undefined || cwd === ""
      ? command
      : `${cwd.replace(/\/$/, "")}/${command}`;
  const collapsed = lexicalPath(joined);
  if (collapsed === undefined) return undefined;
  return normalizeWrittenPath(collapsed);
}

function nextHeredocCwd(cwd: string | undefined, args: readonly string[]): string | undefined {
  let options = true;
  let target: string | undefined;
  let sawTarget = false;
  for (const raw of args) {
    const token = literalCommandToken(raw);
    if (token === undefined) return undefined;
    if (options && token === "--") {
      options = false;
      continue;
    }
    if (options && token.startsWith("-") && token !== "-") continue;
    target = token;
    sawTarget = true;
    break;
  }
  if (!sawTarget || target === undefined || target === "-" || target.startsWith("~"))
    return undefined;
  if (target.startsWith("/")) return lexicalPath(target) ?? undefined;
  if (cwd === undefined) return undefined;
  return resolveExecutionPath(cwd, target);
}

function executesWrittenHeredoc(
  words: readonly string[],
  outputs: ReadonlySet<string>,
  bodyDynamic: boolean,
  dir: { cwd: string | undefined },
): boolean {
  if (outputs.size === 0 || words.length === 0) return false;
  const index = primaryCommandIndex(words);
  if (index === undefined) return bodyDynamic;
  const command = literalCommandToken(words[index] ?? "");
  if (!command) return bodyDynamic;
  const base = (command.split("/").at(-1) ?? command).toLowerCase();
  if (base === "cd") return false;
  const matchesWritten = (raw: string) => {
    const token = literalCommandToken(raw);
    if (token === undefined) return false;
    const resolved = resolveExecutionPath(dir.cwd, token);
    if (resolved !== undefined && outputs.has(resolved)) return true;
    // A relative write has no known absolute directory. An absolute path matches
    // only a recorded path, not a shared basename or suffix.
    if (token.startsWith("/")) return false;
    // `cd -` leaves the directory unknown, so a later relative name can still be the file.
    if (dir.cwd !== undefined) return false;
    const name = pathTail(token);
    if (name === undefined) return false;
    for (const output of outputs) {
      if (pathTail(output) === name) return true;
    }
    return false;
  };
  if (base === "chmod") return words.slice(index + 1).some((raw) => matchesWritten(raw));
  return matchesWritten(words[index] ?? "");
}

function braceExpansionHazard(raw: string): string | undefined {
  if (raw.includes("`")) return "backtick";
  for (let index = 0; index < raw.length - 1; index += 1) {
    if (raw[index] !== "$" || raw[index + 1] !== "(") continue;
    return raw[index + 2] === "(" ? "arithmetic expansion" : "command substitution";
  }
  return undefined;
}

function readExpansion(
  source: string,
  start: number,
): { end: number; name: string; raw: string; simple: boolean } | undefined {
  if (source[start] !== "$") return undefined;
  const next = source[start + 1];
  if (next === undefined || next === "(") return undefined;
  if (next === "{") {
    let depth = 1;
    let cursor = start + 2;
    while (cursor < source.length && depth > 0) {
      if (source[cursor] === "{" && source[cursor - 1] === "$") depth += 1;
      else if (source[cursor] === "}") depth -= 1;
      if (depth > 0) cursor += 1;
    }
    if (depth !== 0) return undefined;
    const inner = source.slice(start + 2, cursor);
    return {
      end: cursor + 1,
      name: inner,
      raw: source.slice(start, cursor + 1),
      simple: /^[A-Za-z_][A-Za-z0-9_]*$/.test(inner),
    };
  }
  if (/[A-Za-z_]/.test(next)) {
    let cursor = start + 2;
    while (cursor < source.length && /[A-Za-z0-9_]/.test(source[cursor] ?? "")) cursor += 1;
    const name = source.slice(start + 1, cursor);
    return { end: cursor, name, raw: source.slice(start, cursor), simple: true };
  }
  if (/[0-9*@#?$!-]/.test(next)) {
    return { end: start + 2, name: next, raw: source.slice(start, start + 2), simple: false };
  }
  return undefined;
}

function freshLiteralKey(source: string, used: Set<string>): string {
  let serial = used.size;
  let key = `${LITERAL_KEY_PREFIX}${serial}`;
  while (source.includes(key) || used.has(key)) {
    serial += 1;
    key = `${LITERAL_KEY_PREFIX}${serial}`;
  }
  used.add(key);
  return key;
}

function isHeredocDataSinkPipeline(names: readonly string[]): boolean {
  return names.length > 0 && names.every((name) => HEREDOC_DATA_SINKS.has(name));
}

/** Shell, source, or a wrapper that can hide them. Used after a heredoc was consumed. */
function isShellOrSourceCommand(words: readonly string[]): boolean {
  const base = commandBasename(words);
  if (!base) return false;
  return (
    base === "source" ||
    base === "." ||
    base === "sudo" ||
    base === "busybox" ||
    isHeredocInterpreter(base)
  );
}

/**
 * Drop comments and quoted heredoc bodies, and substitute literal assignments.
 * Returns a short refusal when the command is dynamic in a way the later
 * tokenizer cannot see (quotes hiding a substitution, a heredoc that is not
 * data for cat or tee, a quoted body that names a lifecycle command, a shell,
 * source, sudo, or busybox after that heredoc, a later command that runs a
 * path that heredoc wrote, source of anything but a
 * literal activate path, or a write that can plant that activate script).
 */
function prepareDesktopGuardCommand(source: string): PreparedDesktopCommand {
  const env = new Map<string, string>();
  const literals: Record<string, string> = {};
  const usedKeys = new Set<string>();
  const pending: PendingHeredoc[] = [];
  let heredocConsumed = false;
  let heredocDynamic = false;
  const heredocDir: { cwd: string | undefined } = { cwd: "" };
  const heredocOutputs = new Set<string>();
  const pipelineWrites: string[] = [];
  let pipelineHasHeredoc = false;
  const simpleWrites: string[] = [];
  let pipelineNames: string[] = [];
  let commandWords: string[] = [];
  let out = "";
  let rawWord = "";
  let quote: "'" | '"' | undefined;
  let wordQuoted = false;
  let atWordStart = true;
  let redirectNext = false;
  let redirectOp = "";
  let activateWrite = false;
  // IFS changes how unquoted expansions split. Refuse instead of guessing the fields.
  let substituteLiterals = true;
  let guaranteed = true;
  let inPipeline = false;
  let index = 0;

  const finishWord = () => {
    if (rawWord.length === 0 && !wordQuoted) return;
    const raw = rawWord;
    rawWord = "";
    wordQuoted = false;
    atWordStart = true;
    if (redirectNext) {
      redirectNext = false;
      if (isActivateWriteTarget(redirectOp, raw, commandWords, env)) activateWrite = true;
      const target = literalCommandToken(raw);
      if (target && isFileWriteRedirect(redirectOp, target)) {
        simpleWrites.push(normalizeWrittenPath(target));
      }
      redirectOp = "";
      return;
    }
    commandWords.push(raw);
  };

  const forgetExternalAssignments = (words: readonly string[]) => {
    const assigned = externalAssignments(words);
    if (!assigned) return;
    if (assigned.clear) {
      substituteLiterals = false;
      env.clear();
      return;
    }
    for (const name of assigned.names) {
      env.delete(name);
      if (name === "IFS") substituteLiterals = false;
    }
  };

  const endSimple = (kind: ShellSeparator): string | undefined => {
    finishWord();
    const words = commandWords;
    commandWords = [];
    // Only sinks in this pipeline survive, so their redirects are the heredoc's output.
    // Resolve them in the directory this command runs in, before a later cd moves.
    if (pipelineHasHeredoc) {
      const placed = (path: string) => resolveExecutionPath(heredocDir.cwd, path);
      for (const path of simpleWrites) {
        const resolved = placed(path);
        if (resolved !== undefined) pipelineWrites.push(resolved);
      }
      for (const path of teeDestinationPaths(words)) {
        const resolved = placed(path);
        if (resolved !== undefined) pipelineWrites.push(resolved);
      }
    }
    simpleWrites.length = 0;
    // A pipeline or background cd runs in a subshell, so the parent directory stays.
    const commandIndex = primaryCommandIndex(words);
    if (
      kind !== "pipe" &&
      kind !== "background" &&
      !inPipeline &&
      commandIndex !== undefined &&
      commandBaseAt(words, commandIndex) === "cd"
    ) {
      heredocDir.cwd = nextHeredocCwd(heredocDir.cwd, words.slice(commandIndex + 1));
    }
    // Remember the write across a pending heredoc so a dangerous body can still
    // refuse as heredoc. A harmless body is refused once that body is consumed.
    if (activateWrite || commandWritesActivateScript(words, env)) activateWrite = true;
    if (activateWrite && pending.length === 0) return "activate script";
    if (
      heredocConsumed &&
      (isShellOrSourceCommand(words) ||
        executesWrittenHeredoc(words, heredocOutputs, heredocDynamic, heredocDir))
    ) {
      return "heredoc";
    }
    const guaranteedBefore = guaranteed;
    if (isUnsafeSource(words)) return "source";
    const base = commandBasename(words);
    if (base !== undefined) pipelineNames.push(base);
    const entries = assignmentEntries(words);
    if (entries?.some((entry) => entry.name === "IFS")) substituteLiterals = false;
    // A builtin, loop, or sourced script can replace a literal this command still trusts.
    forgetExternalAssignments(words);
    const pipeMember = inPipeline || kind === "pipe";
    if (!pipeMember && kind !== "background") {
      if (entries) {
        for (const entry of entries) {
          // A non-guaranteed write must not replace a value this command might still use.
          if (!guaranteedBefore || entry.value === null) env.delete(entry.name);
          else env.set(entry.name, entry.value);
        }
      }
    } else if (kind === "background") {
      for (const entry of entries ?? []) env.delete(entry.name);
    }
    if (kind === "pipe") {
      inPipeline = true;
      guaranteed = false;
      return undefined;
    }
    for (const heredoc of pending) {
      if (!heredoc.names) heredoc.names = [...pipelineNames];
    }
    pipelineNames = [];
    inPipeline = false;
    if (kind === "and") {
      const stable = assignmentEntries(words)?.every((entry) => entry.value !== null) ?? false;
      guaranteed = guaranteedBefore && stable && !pipeMember;
    } else if (kind === "or" || kind === "background") guaranteed = false;
    else guaranteed = true;
    if (pending.length === 0) {
      pipelineWrites.length = 0;
      pipelineHasHeredoc = false;
    }
    return undefined;
  };

  const appendExpansion = (): string | undefined => {
    const next = source[index + 1];
    if (next === "(") {
      return source[index + 2] === "(" ? "arithmetic expansion" : "command substitution";
    }
    const expansion = readExpansion(source, index);
    if (!expansion) {
      out += "$";
      rawWord += "$";
      index += 1;
      atWordStart = false;
      return undefined;
    }
    rawWord += expansion.raw;
    if (!expansion.simple) {
      const hazard = braceExpansionHazard(expansion.raw);
      if (hazard) return hazard;
      out += expansion.raw;
    } else {
      const value = env.get(expansion.name);
      if (value === undefined || !substituteLiterals) out += expansion.raw;
      else {
        const key = freshLiteralKey(source, usedKeys);
        literals[key] = value;
        out += `$${key}`;
      }
    }
    index = expansion.end;
    atWordStart = false;
    return undefined;
  };

  while (index < source.length) {
    const character = source[index];
    if (quote === "'") {
      out += character ?? "";
      rawWord += character ?? "";
      if (character === "'") quote = undefined;
      index += 1;
      continue;
    }
    if (quote === '"') {
      if (character === "\\") {
        const next = source[index + 1];
        out += character ?? "";
        rawWord += character ?? "";
        if (next !== undefined) {
          out += next;
          rawWord += next;
          index += 2;
          continue;
        }
      } else if (character === '"') {
        quote = undefined;
        out += character;
        rawWord += character;
      } else if (character === "`") return { reason: "backtick" };
      else if (character === "$") {
        const reason = appendExpansion();
        if (reason) return { reason };
        continue;
      } else {
        out += character ?? "";
        rawWord += character ?? "";
      }
      index += 1;
      continue;
    }
    if (character === "\\") {
      const next = source[index + 1];
      if (next === "\n") {
        index += 2;
        continue;
      }
      out += "\\";
      rawWord += "\\";
      atWordStart = false;
      if (next !== undefined) {
        out += next;
        rawWord += next;
        index += 2;
        continue;
      }
      index += 1;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      wordQuoted = true;
      atWordStart = false;
      out += character;
      rawWord += character;
      index += 1;
      continue;
    }
    if (character === "#" && atWordStart) {
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }
    if (character === "#") {
      // shell-quote treats a mid-word # as a comment and drops the rest of the string.
      out += "\\#";
      rawWord += "#";
      atWordStart = false;
      index += 1;
      continue;
    }
    if (character === " " || character === "\t") {
      finishWord();
      out += character;
      atWordStart = true;
      index += 1;
      continue;
    }
    if (character === "\n") {
      const separated = endSimple("seq");
      if (separated) return { reason: separated };
      if (pending.length === 0) {
        out += "\n";
        atWordStart = true;
        index += 1;
        continue;
      }
      if (pending.some((heredoc) => !isHeredocDataSinkPipeline(heredoc.names ?? []))) {
        return { reason: "heredoc" };
      }
      let cursor = index + 1;
      for (const heredoc of pending) {
        const body = readHeredocBody(source, cursor, heredoc.delimiter, heredoc.stripTabs);
        if (!body) return { reason: "heredoc" };
        if (heredoc.quoted) {
          if (quotedHeredocLifecycleHazard(body.content)) return { reason: "heredoc" };
          if (quotedHeredocBodyIsDynamic(body.content)) heredocDynamic = true;
        } else {
          const hazard = heredocBodyHazard(body.content);
          if (hazard) return { reason: hazard };
          out += body.content;
        }
        cursor = body.end;
      }
      for (const path of pipelineWrites) heredocOutputs.add(path);
      pipelineWrites.length = 0;
      pipelineHasHeredoc = false;
      pending.length = 0;
      heredocConsumed = true;
      out += "\n";
      atWordStart = true;
      index = cursor;
      continue;
    }
    if (character === "<" && source.startsWith("<<<", index)) return { reason: "herestring" };
    if (character === "<" && source[index + 1] === "<") {
      finishWord();
      let cursor = index + 2;
      const stripTabs = source[cursor] === "-";
      if (stripTabs) cursor += 1;
      const delimiter = readHeredocDelimiter(source, cursor);
      if (!delimiter) return { reason: "heredoc" };
      // Quoted delimiters suppress expansion. Unquoted bodies still expand, so they are scanned below.
      pending.push({ delimiter: delimiter.delimiter, quoted: delimiter.quoted, stripTabs });
      pipelineHasHeredoc = true;
      index = delimiter.end;
      atWordStart = true;
      continue;
    }
    if ((character === "<" || character === ">") && source[index + 1] === "(") {
      return { reason: "subshell" };
    }
    if (character === "`") return { reason: "backtick" };
    if (character === "$") {
      const reason = appendExpansion();
      if (reason) return { reason };
      continue;
    }
    if (character === "(" || character === ")") return { reason: "subshell" };
    const multi = ["&&", "||", ";;", "|&", ">>", ">&", "<&", "&>"].find((op) =>
      source.startsWith(op, index),
    );
    if (
      multi ||
      character === ";" ||
      character === "|" ||
      character === "&" ||
      character === ">" ||
      character === "<"
    ) {
      const op = multi ?? character ?? "";
      const redirect =
        op === ">" || op === "<" || op === ">>" || op === ">&" || op === "<&" || op === "&>";
      if (redirect && !wordQuoted && /^\d+$/.test(rawWord)) {
        rawWord = "";
        atWordStart = true;
      }
      if (redirect) {
        finishWord();
        out += op;
        atWordStart = true;
        redirectOp = op;
        redirectNext = true;
        index += op.length;
        continue;
      }
      // The redirect target is still the current word. Consume it before this
      // separator clears the redirect, or `> path;` is inspected as an argument.
      if (redirectNext) finishWord();
      out += op;
      atWordStart = true;
      redirectNext = false;
      index += op.length;
      const kind: ShellSeparator =
        op === "|" || op === "|&"
          ? "pipe"
          : op === "&&"
            ? "and"
            : op === "||"
              ? "or"
              : op === "&"
                ? "background"
                : "seq";
      const separated = endSimple(kind);
      if (separated) return { reason: separated };
      continue;
    }
    out += character ?? "";
    rawWord += character ?? "";
    atWordStart = false;
    index += 1;
  }

  const separated = endSimple("seq");
  if (separated) return { reason: separated };
  if (quote || pending.length > 0)
    return { reason: quote ? "uninspectable shell syntax" : "heredoc" };
  return { command: out, literals };
}

function shellCFlagProgram(words: readonly string[], interpreterIndex: number): string | undefined {
  for (let index = interpreterIndex + 1; index < words.length; index += 1) {
    const word = words[index] ?? "";
    if (word.startsWith("--command=")) return word.slice("--command=".length);
    // bash -c / -lc / -ce and fish --command: the next argument is the program string.
    if (word === "--command" || /^-[^-]*c/.test(word)) return words[index + 1];
  }
  return undefined;
}

function preserveShellCommandBoundaries(command: string): string {
  let quote: "'" | '"' | undefined;
  let result = "";
  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    const next = command[index + 1];
    if (character === "\\" && quote !== "'") {
      if (next === "\n") {
        index += 1;
        continue;
      }
      // Keep escaped characters intact; an escaped quote is not a boundary.
      result += character;
      if (next !== undefined) {
        result += next;
        index += 1;
      }
      continue;
    }
    if (character === quote) quote = undefined;
    else if (!quote && (character === "'" || character === '"')) quote = character;
    result += character === "\n" && !quote ? "\n;" : character;
  }
  return result;
}

function shellTokenReason(entry: object): string | undefined {
  if ("comment" in entry) return "comment";
  if ("expansion" in entry && typeof entry.expansion === "string") {
    const hazard = braceExpansionHazard(entry.expansion);
    // The value is chosen by the shell after this guard, so it cannot be checked.
    return hazard ?? unresolvedVariableReason(entry.expansion);
  }
  if (!("op" in entry) || typeof entry.op !== "string") return "uninspectable shell syntax";
  if (entry.op === "glob") return undefined;
  if (entry.op === "(" || entry.op === ")" || entry.op === "<(") return "subshell";
  if (entry.op === "<<<") return "herestring";
  if (SAFE_SHELL_CONTROL_OPS.has(entry.op)) return undefined;
  return "unsupported shell syntax";
}

function tokenizeProtectedShellCommand(
  command: string,
  literals: Readonly<Record<string, string>>,
): { words: string[] } | { reason: string } {
  try {
    // shell-quote treats newlines as whitespace. Preserve command boundaries for
    // the dot builtin, after folding shell line continuations.
    const separated = preserveShellCommandBoundaries(command);
    const parsed = parseShellCommand<{ expansion: string }>(
      separated,
      (name) => literals[name] ?? STATIC_SHELL_EXPANSIONS[name] ?? { expansion: name },
      { splitUnquoted: true },
    );
    const words: string[] = [];
    let commandPosition = true;
    let redirectTarget = false;
    for (const [index, entry] of parsed.entries()) {
      if (typeof entry === "string") {
        // Backtick fragments are not fully tokenized; treat them as dynamic.
        if (entry.includes("`")) return { reason: "backtick" };
        const folded = entry.toLowerCase();
        // `find .`, `git add .`, and `git -C .` use a path, not the
        // executable `. script` builtin. Keep the path out of the builtin scan.
        words.push(entry === "." && (!commandPosition || redirectTarget) ? "./" : entry);
        if (redirectTarget) {
          redirectTarget = false;
          continue;
        }
        const next = parsed[index + 1];
        if (
          commandPosition &&
          /^\d+$/.test(folded) &&
          typeof next === "object" &&
          next !== null &&
          "op" in next &&
          /^[<>]/.test(next.op)
        ) {
          // A leading file descriptor belongs to a redirect, not the command.
        } else if (commandPosition && /^(?:then|do|else)$/.test(folded)) {
          commandPosition = true;
        } else if (commandPosition && (folded === "coproc" || folded === "function")) {
          return { reason: folded };
        } else if (
          commandPosition &&
          (/^(?:command|builtin|exec|time|if|elif|while|until|!|\{)$/.test(folded) ||
            folded.startsWith("-") ||
            /^[a-z_][a-z0-9_]*=/.test(folded))
        ) {
          // Shell prefixes and assignments leave the command word pending.
        } else commandPosition = false;
        continue;
      }
      if (typeof entry !== "object" || entry === null)
        return { reason: "uninspectable shell syntax" };
      if (
        "op" in entry &&
        entry.op === "glob" &&
        "pattern" in entry &&
        typeof entry.pattern === "string"
      ) {
        words.push(entry.pattern);
        continue;
      }
      const reason = shellTokenReason(entry);
      if (reason) return { reason };
      if ("op" in entry && typeof entry.op === "string" && SAFE_SHELL_CONTROL_OPS.has(entry.op)) {
        if (["&&", "||", ";", "|", "&"].includes(entry.op)) {
          commandPosition = true;
          redirectTarget = false;
        } else redirectTarget = true;
      }
    }
    return { words };
  } catch {
    return { reason: "uninspectable shell syntax" };
  }
}

function protectedWordRefusal(words: readonly string[]): string | undefined {
  for (const word of words) {
    const base = (word.split("/").at(-1) ?? "").toLowerCase();
    if (/^(?:kill|pkill|killall|xkill)$/.test(base)) return `protected command ${base}`;
  }
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index] ?? "";
    const base = (word.split("/").at(-1) ?? "").toLowerCase();
    if (base !== "eval" && base !== "source" && word !== ".") continue;
    const next = words[index + 1];
    // Virtualenv activation is the one source form that does not run an arbitrary script.
    if ((word === "source" || word === ".") && next && isLiteralActivatePath(next)) continue;
    return base === "eval" ? "eval" : "source";
  }
  const service = words
    .map((word) => (word.split("/").at(-1) ?? "").toLowerCase())
    .find((word) => word === "systemctl" || word === "service");
  if (service) {
    const action = words.find((word) => /^(?:stop|restart|kill)$/.test(word.toLowerCase()));
    if (action) return `${service} ${action.toLowerCase()}`;
  }
  for (const word of words) {
    const folded = word.toLowerCase();
    if (/(?:\.browser-profiles|--user-data-dir)/.test(folded)) return "browser profile path";
    if (/(?:\/tmp\/\.x11-unix|\/tmp\/\.x\d+-lock)/.test(folded)) return "X11 path";
  }
  for (let index = 0; index < words.length; index += 1) {
    const name = (words[index]?.split("/").at(-1) ?? "").toLowerCase();
    if (!SHELL_INTERPRETER_NAMES.test(name)) continue;
    const program = shellCFlagProgram(words, index);
    if (!program) continue;
    const nested = protectedComputerLifecycleRefusal(program);
    if (nested) return nested;
  }
  return undefined;
}

/** Short reason the desktop-protection guard refuses `command`, when it does. */
export function protectedComputerLifecycleRefusal(command: string): string | undefined {
  const prepared = prepareDesktopGuardCommand(command);
  if ("reason" in prepared) return prepared.reason;
  const tokenized = tokenizeProtectedShellCommand(prepared.command, prepared.literals);
  if ("reason" in tokenized) return tokenized.reason;
  return protectedWordRefusal(tokenized.words);
}

export function isProtectedComputerLifecycleCommand(command: string): boolean {
  return protectedComputerLifecycleRefusal(command) !== undefined;
}

export function desktopProtectionGuardMessage(reason: string): string {
  return `This command was not run: desktop-protection guard: ${reason}. Shell access is still available. Do not stop or restart browser or desktop processes.`;
}
