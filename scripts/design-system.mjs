// Design system catalog. Finds every rendered React component, checks that each web or
// shared component file has Storybook stories, and keeps docs/design-system in sync.
//   node scripts/design-system.mjs --write   regenerate components.md and the token tables
//   node scripts/design-system.mjs --check   fail on missing stories or stale generated docs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = "docs/design-system";
const WEB_ROOTS = ["apps/web/src", "packages/ui-web/src", "packages/chat-ui/src"];
const MOBILE_ROOT = "apps/mobile";
const SWIFT_ROOTS = ["apps/ios/Sources", "apps/ios/Packages/RakazoUI/Sources"];
const SKIP_DIRS = new Set([
  "node_modules",
  ".expo",
  "ios",
  "android",
  "e2e",
  "__tests__",
  "__mocks__",
  ".storybook",
  "stories",
]);
const TEST_OR_STORY = /\.(test|spec|stories)\.tsx$/;

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, acc);
    else if (/\.(tsx?|swift)$/.test(e.name)) acc.push(rel);
  }
  return acc;
}

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const JSX = /(^|[\s(?:&|=>,{[])<(?:[A-Za-z][\w.]*(?=[\s/>])|>)/;
const DECL =
  /^(\s*)(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s+([A-Z]\w*)\s*[<(]|const\s+([A-Z]\w*)\s*(?::[^=]+)?=\s*(?:\(|async|memo\(|React\.memo\(|forwardRef|React\.forwardRef|<|function|[a-z]\w*\s*=>))/;

/** Rendered components declared in one source file. Providers that only wrap children are skipped. */
export function findComponents(source) {
  const lines = strip(source).split("\n");
  const found = [];
  lines.forEach((line, i) => {
    const m = DECL.exec(line);
    if (!m) return;
    const name = m[2] || m[3];
    const indent = m[1].length;
    let j = i + 1;
    for (; j < lines.length; j++) {
      const l = lines[j];
      if (!l.trim()) continue;
      if (l.match(/^\s*/)[0].length <= indent && !/^\s*[})\]]/.test(l) && !/^\s*\./.test(l)) break;
    }
    const body = lines.slice(i, j).join("\n");
    if (!JSX.test(body)) return;
    if (/^\s*(export\s+)?const\s+\w+\s*:\s*[^=]*(Record|Map)</.test(line)) return;
    if (
      /Providers?$/.test(name) &&
      /\bchildren\b/.test(body) &&
      (body.match(/<[A-Za-z]/g) || []).length <= 3
    )
      return;
    found.push(name);
  });
  // Badge renders through useRender(...) rather than literal JSX.
  if (/useRender\(/.test(source) && /export\s*\{[^}]*\bBadge\b/.test(source)) found.push("Badge");
  return [...new Set(found)];
}

export function findSwiftViews(source) {
  return [
    ...strip(source).matchAll(/\bstruct\s+(\w+)(?:<[^>]+>)?\s*:\s*[^{}]*\bView\b[^{}]*\{/g),
  ].map((match) => match[1]);
}

/** Resolve an import specifier from `fromFile` to a repo-relative source file, or null. */
function resolveImport(spec, fromFile, exists) {
  let base;
  if (spec.startsWith(".")) base = path.posix.join(path.posix.dirname(fromFile), spec);
  else {
    const m = /^@rakazo\/([^/]+)(\/.*)?$/.exec(spec);
    if (!m) return null;
    const pkgPath = `packages/${m[1]}/package.json`;
    if (!exists(pkgPath)) return null;
    const exp = JSON.parse(fs.readFileSync(path.join(ROOT, pkgPath), "utf8")).exports ?? {};
    const sub = m[2] ? `.${m[2]}` : ".";
    let target = exp[sub];
    if (!target) {
      for (const [k, v] of Object.entries(exp)) {
        if (k.endsWith("/*") && sub.startsWith(k.slice(0, -1)))
          target = v.replace("*", sub.slice(k.length - 1));
      }
    }
    if (typeof target !== "string") return null;
    base = path.posix.join(`packages/${m[1]}`, target);
  }
  for (const c of [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]) {
    if (exists(c) && /\.tsx?$/.test(c)) return c;
  }
  return null;
}

/**
 * Coverage rule. A source file is covered when it has a sibling `<name>.stories.tsx`, or when
 * any stories file imports it. `files` is the list of repo-relative paths, `read` returns a file's text.
 */
export function storiesFor(sourceFile, files, read) {
  const set = new Set(files);
  const exists = (f) => set.has(f);
  const sibling = sourceFile.replace(/\.tsx$/, ".stories.tsx");
  // An empty or meta-only stories file is not coverage.
  const hasStory = (f) =>
    /export\s+default\b/.test(read(f)) && /export\s+const\s+\w+/.test(read(f));
  const out = new Set(exists(sibling) && hasStory(sibling) ? [sibling] : []);
  for (const f of files) {
    if (!f.endsWith(".stories.tsx") || out.has(f) || !hasStory(f)) continue;
    for (const m of read(f).matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
      if (resolveImport(m[1], f, exists) === sourceFile) out.add(f);
    }
  }
  return [...out].sort();
}

const isWebSource = (f) =>
  f.endsWith(".tsx") &&
  !TEST_OR_STORY.test(f) &&
  !/\.native\.tsx$/.test(f) &&
  !f.endsWith("native-test-stubs.tsx");

function scan() {
  const all = [...WEB_ROOTS.flatMap((r) => walk(r)), ...walk(MOBILE_ROOT)];
  const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
  const web = [];
  for (const f of WEB_ROOTS.flatMap((r) => all.filter((a) => a.startsWith(`${r}/`)))) {
    if (!isWebSource(f)) continue;
    const names = findComponents(read(f));
    if (names.length) web.push({ file: f, names, stories: storiesFor(f, all, read) });
  }
  const mobile = [];
  for (const f of all.filter(
    (a) => a.startsWith(`${MOBILE_ROOT}/`) && a.endsWith(".tsx") && !TEST_OR_STORY.test(a),
  )) {
    const names = findComponents(read(f));
    if (names.length) mobile.push({ file: f, names });
  }
  const native = SWIFT_ROOTS.flatMap((root) => walk(root))
    .filter((file) => file.endsWith(".swift"))
    .map((file) => ({ file, names: findSwiftViews(read(file)) }))
    .filter(({ names }) => names.length);
  return { web, mobile, native };
}

const surfaceOf = (f) => (f.startsWith("apps/web") ? "web" : "shared");
const areaOf = (f) => {
  if (f.startsWith("packages/ui-web/src/components/ui/")) return "Primitives (packages/ui-web)";
  if (f.startsWith("packages/ui-web")) return "Shared web (packages/ui-web)";
  if (f.startsWith("packages/chat-ui")) return "Chat markdown (packages/chat-ui)";
  const rest = f.replace("apps/web/src/", "");
  const parts = rest.split("/");
  if (parts[0] === "components" && parts.length > 2) return `Web components/${parts[1]}`;
  if (parts[0] === "components") return "Web components";
  return `Web ${parts.length > 1 ? parts[0] : "root"}`;
};
const mobileAreaOf = (f) =>
  `Mobile ${f.split("/")[2] === "app" || f.split("/")[1] === "app" ? "app (screens)" : f.split("/")[1]}`;

export function renderComponentsMd({ web, mobile, native = [] }) {
  const rel = (to) => path.posix.relative(DOCS, to);
  const covered = web.filter((w) => w.stories.length);
  const sections = new Map();
  for (const w of web) {
    const a = areaOf(w.file);
    if (!sections.has(a)) sections.set(a, []);
    sections.get(a).push(w);
  }
  const out = [
    "<!-- Generated by `pnpm design-system`. Do not edit. -->",
    "# Component catalog",
    "",
    "Rendered React components and native SwiftUI views, grouped by area. A web or shared component file is covered when it has a sibling `<name>.stories.tsx` or a stories file that imports it. Run `pnpm design-system` after adding or moving a component.",
    "",
    `- Web and shared component files with stories: ${covered.length} of ${web.length}`,
    `- Web and shared components: ${web.reduce((n, w) => n + w.names.length, 0)}`,
    `- Mobile components: ${mobile.reduce((n, m) => n + m.names.length, 0)} in ${mobile.length} files, mobile — native story pending`,
    `- SwiftUI views: ${native.reduce((n, view) => n + view.names.length, 0)} in ${native.length} files, native story pending`,
    "",
  ];
  for (const [area, rows] of [...sections].sort(([a], [b]) => a.localeCompare(b))) {
    out.push(
      `## ${area}`,
      "",
      "| Component | File | Story file | Surface |",
      "| --- | --- | --- | --- |",
    );
    for (const w of rows.sort((a, b) => a.file.localeCompare(b.file))) {
      const story = w.stories.length
        ? w.stories.map((s) => `[${path.posix.basename(s)}](${rel(s)})`).join(", ")
        : "missing";
      out.push(
        `| ${w.names.join(", ")} | [${w.file}](${rel(w.file)}) | ${story} | ${surfaceOf(w.file)} |`,
      );
    }
    out.push("");
  }
  const msec = new Map();
  for (const m of mobile) {
    const a = mobileAreaOf(m.file);
    if (!msec.has(a)) msec.set(a, []);
    msec.get(a).push(m);
  }
  for (const [area, rows] of [...msec].sort(([a], [b]) => a.localeCompare(b))) {
    out.push(
      `## ${area}`,
      "",
      "| Component | File | Story file | Surface |",
      "| --- | --- | --- | --- |",
    );
    for (const m of rows.sort((a, b) => a.file.localeCompare(b.file))) {
      out.push(
        `| ${m.names.join(", ")} | [${m.file}](${rel(m.file)}) | mobile — native story pending | mobile |`,
      );
    }
    out.push("");
  }
  if (native.length) {
    out.push(
      "## Native iOS (SwiftUI)",
      "",
      "| Component | File | Story file | Surface |",
      "| --- | --- | --- | --- |",
    );
    for (const view of native.sort((a, b) => a.file.localeCompare(b.file))) {
      out.push(
        `| ${view.names.join(", ")} | [${view.file}](${rel(view.file)}) | native story pending | iOS |`,
      );
    }
    out.push("");
  }
  return `${out.join("\n").trimEnd()}\n`;
}

// ---- token tables, rendered into README.md between markers ----
const TOKEN_GROUPS = [
  [
    "Surfaces",
    "Page and container backgrounds with their text.",
    ["background", "foreground", "card", "card-foreground", "popover", "popover-foreground"],
  ],
  [
    "Action",
    "Ink primary for the main action; secondary for quieter fills.",
    ["primary", "primary-foreground", "secondary", "secondary-foreground"],
  ],
  [
    "Quiet and hover",
    "De-emphasized text, fills and hover states.",
    ["muted", "muted-foreground", "accent", "accent-foreground"],
  ],
  ["Lines and focus", "Borders, input fills and the focus ring.", ["border", "input", "ring"]],
  [
    "Status",
    "The only color outside ink: destructive, success, warning, working, links.",
    ["destructive", "destructive-foreground", "success", "warning", "status-working", "link"],
  ],
  [
    "Chat",
    "The user's message bubble and link favicon backing.",
    ["chat-user", "chat-user-foreground", "favicon-plate"],
  ],
  [
    "Sidebar",
    "Navigation rail.",
    [
      "sidebar",
      "sidebar-foreground",
      "sidebar-border",
      "sidebar-accent",
      "sidebar-accent-foreground",
    ],
  ],
  [
    "Overlay and scrollbar",
    "Modal scrim and scrollbar thumb.",
    ["overlay", "scrollbar", "scrollbar-hover"],
  ],
];

function parseTokensCss() {
  const css = fs.readFileSync(path.join(ROOT, "packages/ui-tokens/src/tokens.css"), "utf8");
  const block = (sel) => {
    const body = css.split(sel)[1]?.split("}")[0] ?? "";
    return Object.fromEntries(
      [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
    );
  };
  return { dark: block(':root,\n[data-theme="dark"] {'), light: block('[data-theme="light"] {') };
}

export function renderTokenTables() {
  const { dark, light } = parseTokensCss();
  const listed = new Set(TOKEN_GROUPS.flatMap((g) => g[2]));
  const missing = Object.keys(dark).filter((k) => k !== "radius" && !listed.has(k));
  if (missing.length)
    throw new Error(
      `Token(s) not assigned to a group in scripts/design-system.mjs: ${missing.join(", ")}`,
    );
  const out = [];
  for (const [title, purpose, names] of TOKEN_GROUPS) {
    out.push(
      `### ${title}`,
      "",
      purpose,
      "",
      "| Token | CSS variable | Light | Dark |",
      "| --- | --- | --- | --- |",
    );
    for (const n of names)
      out.push(
        `| \`${n.replace(/-(\w)/g, (_, c) => c.toUpperCase())}\` | \`--${n}\` | \`${light[n]}\` | \`${dark[n]}\` |`,
      );
    out.push("");
  }
  return out.join("\n").trimEnd();
}

const START = "<!-- tokens:start -->";
const END = "<!-- tokens:end -->";
function withTokens(readme) {
  const a = readme.indexOf(START);
  const b = readme.indexOf(END);
  if (a < 0 || b < a) throw new Error(`${DOCS}/README.md is missing the ${START} / ${END} markers`);
  return `${readme.slice(0, a + START.length)}\n${renderTokenTables()}\n${readme.slice(b)}`;
}

function main(mode) {
  const scan_ = scan();
  const files = {
    [`${DOCS}/components.md`]: renderComponentsMd(scan_),
    [`${DOCS}/README.md`]: withTokens(fs.readFileSync(path.join(ROOT, DOCS, "README.md"), "utf8")),
  };
  const uncovered = scan_.web.filter((w) => !w.stories.length).map((w) => w.file);
  const covered = scan_.web.length - uncovered.length;
  console.log(
    `web+shared files with stories: ${covered}/${scan_.web.length}; mobile files: ${scan_.mobile.length} (native story pending)`,
  );
  if (mode === "--write") {
    for (const [f, text] of Object.entries(files)) fs.writeFileSync(path.join(ROOT, f), text);
    console.log(`wrote ${Object.keys(files).join(", ")}`);
    return 0;
  }
  if (mode !== "--check") {
    console.error("usage: node scripts/design-system.mjs --write | --check");
    return 2;
  }
  let bad = false;
  if (uncovered.length) {
    bad = true;
    console.error(
      `Component files without stories (${uncovered.length}):\n${uncovered.map((f) => `  ${f}`).join("\n")}`,
    );
  }
  for (const [f, text] of Object.entries(files)) {
    if (fs.readFileSync(path.join(ROOT, f), "utf8") !== text) {
      bad = true;
      console.error(`${f} is out of date. Run \`pnpm design-system\` and commit the result.`);
    }
  }
  return bad ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv[2]));
}
