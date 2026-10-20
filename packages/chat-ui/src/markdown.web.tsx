import type { MouseEvent, ReactNode } from "react";
import { createContext, memo, useCallback, useContext, useRef, useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { HastNode } from "./table-utils";
import "./markdown.web.css";
import "./markdown-table.css";
import { droppedTableHtmlText } from "@rakazo/contracts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@rakazo/ui-web";
import { CheckIcon, CopyIcon, GlobeIcon, ImageIcon } from "./icons";
import type { ChatMarkdownProps } from "./markdown";
import {
  closeUnterminatedFence,
  HideAmountsContext,
  inlineMarkdownImageSrc,
  LinkFaviconsPausedContext,
  linkFaviconOrigin,
  linkLabel,
  markdownLinkDisplayParts,
  markdownLinkRequiresConfirmation,
  markRemoteImageLoaded,
  plainTextLinkParts,
  RemoteImagesContext,
  remoteImageRenders,
  remoteMarkdownImage,
  sanitizeMarkdownUrl,
  useLinkFavicon,
} from "./markdown";
import { useMarkdownLinkCopy } from "./markdown-link-prompt";
import { MarkdownTable, MarkdownTableSourceContext } from "./markdown-table";
import { currencyMatches, isRunwayLabel, maskCurrencyText, maskRunwayCell } from "./mask-currency";

function preserveSkippedTableText() {
  return (tree: HastNode) => {
    const walk = (node: HastNode, inTableCell = false) => {
      const insideCell = inTableCell || node.tagName === "th" || node.tagName === "td";
      if (!node.children) return;
      node.children = node.children.flatMap((child) => {
        if (insideCell && child.type === "raw") {
          const value = droppedTableHtmlText(child.value ?? "");
          return value === null ? child : { type: "text", value };
        }
        walk(child, insideCell);
        return child;
      });
    };
    walk(tree);
  };
}

const BLOCK_TAGS = new Set([
  "p",
  "li",
  "td",
  "th",
  "tr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "pre",
  "blockquote",
  "div",
  "ul",
  "ol",
  "table",
]);

const textOf = (n: HastNode): string =>
  n.type === "text" ? (n.value ?? "") : (n.children ?? []).map(textOf).join("");
const textNodes = (n: HastNode): HastNode[] =>
  n.type === "text" ? [n] : (n.children ?? []).flatMap(textNodes);
const rowsOf = (n: HastNode): HastNode[] =>
  n.tagName === "tr" ? [n] : (n.children ?? []).flatMap(rowsOf);

/** Table cells are separate blocks, so `Runway | 9.2 months` has no runway sentence. Mask the value
 * cells of a row whose first cell says runway, or of a column whose header does. */
function maskRunwayCells(table: HastNode) {
  const rows = rowsOf(table).map((tr) => (tr.children ?? []).filter((c) => c.tagName));
  const header = rows[0]?.map((c) => isRunwayLabel(textOf(c))) ?? [];
  rows.forEach((cells, r) => {
    const rowLabel = r > 0 && cells[0] && isRunwayLabel(textOf(cells[0]));
    cells.forEach((cell, i) => {
      if (r > 0 && ((rowLabel && i > 0) || header[i]))
        for (const t of textNodes(cell)) t.value = maskRunwayCell(t.value ?? "");
    });
  });
}

/** Masks currency in the page text. A run is one block's text across inline nodes, so `$**1,200**` is caught. Also alt and title. */
function maskAmounts() {
  return (tree: HastNode) => {
    const flush = (run: HastNode[]) => {
      const text = run.map((n) => n.value ?? "").join("");
      const matches = currencyMatches(text);
      if (matches.length === 0) return;
      let offset = 0;
      for (const node of run) {
        const value = node.value ?? "";
        let out = "";
        for (let i = 0; i < value.length; i++) {
          const pos = offset + i;
          const m = matches.find((x) => pos >= x.start && pos < x.end);
          if (!m) out += value[i];
          else if (pos === m.start) out += m.replacement;
        }
        node.value = out;
        offset += value.length;
      }
    };
    const walk = (node: HastNode, run: HastNode[]): HastNode[] => {
      for (const key of ["alt", "title"]) {
        const v = node.properties?.[key];
        if (typeof v === "string")
          node.properties = { ...node.properties, [key]: maskCurrencyText(v) };
      }
      if (node.tagName === "table") maskRunwayCells(node);
      const block = node.tagName !== undefined && BLOCK_TAGS.has(node.tagName);
      let current = run;
      if (block) {
        flush(current);
        current = [];
      }
      for (const child of node.children ?? []) {
        if (child.type === "text" && typeof child.value === "string") current.push(child);
        else current = walk(child, current);
      }
      if (block) {
        flush(current);
        return [];
      }
      return current;
    };
    flush(walk(tree, []));
  };
}

function CodeBlock(props: React.ComponentPropsWithoutRef<"pre">) {
  const preRef = useRef<HTMLPreElement>(null);
  const resetTimerRef = useRef<number | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!navigator.clipboard) return;
    const text = preRef.current?.textContent ?? "";
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        window.clearTimeout(resetTimerRef.current);
        resetTimerRef.current = window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="rk-chat-markdown-pre-wrap">
      <pre {...props} ref={preRef} />
      <button
        type="button"
        className="rk-chat-markdown-copy"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy code"}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  );
}

type EnclosingLink = false | "open" | "rejected";

const InsideLinkContext = createContext<EnclosingLink>(false);

const ConfirmLinkContext = createContext<(url: string) => void>(() => undefined);
/** Set by the app to open its own /app/ links through its router instead of a page load. */
const NavigateContext = createContext<((href: string) => void) | undefined>(undefined);

function pageOrigin() {
  if (typeof window === "undefined") return null;
  const origin = window.location.origin;
  return origin && origin !== "null" ? origin : null;
}

function holdExternalLink(event: MouseEvent<HTMLAnchorElement>, request: (url: string) => void) {
  if (event.button !== 0 && event.button !== 1) return;
  const destination = event.currentTarget.href;
  if (!destination || !markdownLinkRequiresConfirmation(destination, pageOrigin())) return;
  event.preventDefault();
  request(destination);
}

function ExternalLinkUrl({ url }: { url: string }) {
  const parts = markdownLinkDisplayParts(url);
  if (!parts) return url;
  return (
    <>
      {parts.before}
      <strong className="font-semibold">{parts.host}</strong>
      {parts.after}
    </>
  );
}

function ExternalLinkAlert({ url, onDismiss }: { url: string; onDismiss: () => void }) {
  const copy = useMarkdownLinkCopy();
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader className="place-items-start text-left">
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription className="break-all text-left text-foreground">
            <ExternalLinkUrl url={url} />
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              window.open(url, "_blank", "noopener,noreferrer");
              onDismiss();
            }}
          >
            {copy.open}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function useExternalLinkConfirm() {
  const [url, setUrl] = useState<string | null>(null);
  const request = useCallback((destination: string) => {
    setUrl(destination);
  }, []);
  const dialog = url ? <ExternalLinkAlert url={url} onDismiss={() => setUrl(null)} /> : null;
  return { request, dialog };
}

function ConfirmableAnchor({ href, ...props }: React.ComponentPropsWithoutRef<"a">) {
  const request = useContext(ConfirmLinkContext);
  const navigate = useContext(NavigateContext);
  // An in-app path such as /app/finance opens in place, like any other link in the app.
  const inApp = typeof href === "string" && href.startsWith("/") && !href.startsWith("//");
  return (
    <a
      {...props}
      // In-app links read as part of the app (text colour, medium weight), not as web links.
      className={
        inApp ? [props.className, "rk-chat-app-link"].filter(Boolean).join(" ") : props.className
      }
      href={href}
      target={inApp ? undefined : "_blank"}
      rel={inApp ? undefined : "noreferrer noopener"}
      onClick={(event) => {
        const plain =
          event.button === 0 && !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
        if (navigate && plain && typeof href === "string" && href.startsWith("/app/")) {
          event.preventDefault();
          navigate(href);
          return;
        }
        holdExternalLink(event, request);
      }}
      onAuxClick={(event) => holdExternalLink(event, request)}
    />
  );
}

type MarkdownHast = {
  type?: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: MarkdownHast[];
};

function hastString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function linkHost(href: string): string {
  try {
    return new URL(href).host || href;
  } catch {
    return href;
  }
}

function soleRemoteImage(node: MarkdownHast | undefined):
  | {
      href: string;
      host: string;
      alt?: string;
      title?: string;
    }
  | undefined {
  const parts = (node?.children ?? []).filter((child) => {
    if (child.type === "text") return Boolean(child.value?.trim());
    return child.type === "element";
  });
  const only = parts.length === 1 ? parts[0] : undefined;
  if (only?.tagName !== "img") return undefined;
  const remote = remoteMarkdownImage(hastString(only.properties?.src) ?? "");
  if (!remote) return undefined;
  return {
    ...remote,
    alt: hastString(only.properties?.alt),
    title: hastString(only.properties?.title),
  };
}

function RemoteImageButton({
  image,
  alt,
  title,
  onLoad,
}: {
  image: { href: string; host: string };
  alt?: string;
  title?: string;
  onLoad: () => void;
}) {
  return (
    <button
      type="button"
      className="rk-chat-markdown-image"
      title={title}
      onClick={() => {
        markRemoteImageLoaded(image.href);
        onLoad();
      }}
    >
      <ImageIcon />
      {alt ? <span>{alt}</span> : null}
      <span className="rk-chat-markdown-image-host">{image.host}</span>
    </button>
  );
}

function MarkdownImage({ src = "", alt, title }: { src?: string; alt?: string; title?: string }) {
  const enclosingLink = useContext(InsideLinkContext);
  const loadRemote = useContext(RemoteImagesContext);
  const remote = remoteMarkdownImage(src);
  // Bumping this redraws after a tap. Whether the image shows is read from the current URL.
  const [, setRevision] = useState(0);
  const rejectedLink = enclosingLink === "rejected";
  if (inlineMarkdownImageSrc(src)) {
    return <img src={src} alt={alt ?? ""} title={title} loading="lazy" />;
  }
  if (remote && remoteImageRenders(remote.href, loadRemote, rejectedLink)) {
    return (
      <img
        src={remote.href}
        alt={alt ?? ""}
        title={title}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }
  if (!remote || enclosingLink !== false) return alt || remote?.host || src;
  return (
    <RemoteImageButton
      image={remote}
      alt={alt}
      title={title}
      onLoad={() => setRevision((revision) => revision + 1)}
    />
  );
}

function LinkedRemoteImage({
  href,
  image,
  alt,
  title,
}: {
  href: string;
  image: { href: string; host: string };
  alt?: string;
  title?: string;
}) {
  const loadRemote = useContext(RemoteImagesContext);
  const [, setRevision] = useState(0);
  if (remoteImageRenders(image.href, loadRemote, false)) {
    return (
      <ConfirmableAnchor href={href}>
        <img
          src={image.href}
          alt={alt ?? ""}
          title={title}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </ConfirmableAnchor>
    );
  }
  return (
    <span className="rk-chat-markdown-linked-image">
      <RemoteImageButton
        image={image}
        alt={alt}
        title={title}
        onLoad={() => setRevision((revision) => revision + 1)}
      />
      <ConfirmableAnchor href={href}>{linkHost(href)}</ConfirmableAnchor>
    </span>
  );
}

/** The label when it is plain text, the only kind that can be a bare URL. */
function hastText(node: MarkdownHast | undefined): string | undefined {
  const children = node?.children ?? [];
  if (!children.every((child) => child.type === "text")) return undefined;
  return children.map((child) => child.value ?? "").join("");
}

function hastHasImage(node: MarkdownHast | undefined): boolean {
  return (node?.children ?? []).some((child) => child.tagName === "img" || hastHasImage(child));
}

function LinkFavicon({ href }: { href: string }) {
  const { icon, unusable } = useLinkFavicon(href);
  return (
    <span
      aria-hidden="true"
      className={icon ? "rk-chat-link-tile rk-chat-link-tile-icon" : "rk-chat-link-tile"}
    >
      {icon ? (
        <img
          src={icon}
          alt=""
          draggable={false}
          onLoad={(event) => {
            // A 1×1 image is a tracking pixel, not an icon.
            const image = event.currentTarget;
            if (image.naturalWidth <= 1 || image.naturalHeight <= 1) unusable();
          }}
          onError={unusable}
        />
      ) : (
        <GlobeIcon />
      )}
    </span>
  );
}

/** A link to a website, drawn with its site icon before the label. */
function WebsiteLink({
  href,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"a"> & { href: string; children: ReactNode }) {
  return (
    <ConfirmableAnchor {...props} href={href} className="rk-chat-link">
      <LinkFavicon href={href} />
      {/* bdi: direction characters in a label cannot reorder the text around the link. */}
      <bdi className="rk-chat-link-label">{children}</bdi>
    </ConfirmableAnchor>
  );
}

function MarkdownAnchor({
  node,
  ...props
}: React.ComponentPropsWithoutRef<"a"> & { node?: MarkdownHast }) {
  const loadRemote = useContext(RemoteImagesContext);
  const href = typeof props.href === "string" ? props.href : "";
  const image = href ? soleRemoteImage(node) : undefined;
  if (image && !remoteImageRenders(image.href, loadRemote, false)) {
    return <LinkedRemoteImage href={href} image={image} alt={image.alt} title={image.title} />;
  }
  // urlTransform blanks unsafe URLs. Keep their text without a link that opens the app again.
  const opens = Boolean(props.href);
  const text = hastText(node);
  const link =
    opens && linkFaviconOrigin(href) && !hastHasImage(node) ? (
      <WebsiteLink {...props} href={href}>
        {text === undefined ? props.children : linkLabel(text, href)}
      </WebsiteLink>
    ) : opens ? (
      <ConfirmableAnchor {...props} />
    ) : (
      <span>{props.children}</span>
    );
  return (
    <InsideLinkContext.Provider value={opens ? "open" : "rejected"}>
      {link}
    </InsideLinkContext.Provider>
  );
}

const components: Components = {
  a: MarkdownAnchor,
  img({ node: _node, src, alt, title }) {
    return (
      <MarkdownImage src={typeof src === "string" ? src : undefined} alt={alt} title={title} />
    );
  },
  pre({ node: _node, ...props }) {
    return <CodeBlock {...props} />;
  },
  table({ node, children, ...props }) {
    return (
      <MarkdownTable node={node} tableProps={props}>
        {children}
      </MarkdownTable>
    );
  },
};

export function LinkifiedText({ children: raw }: { children: string }) {
  const children = useContext(HideAmountsContext) ? maskCurrencyText(raw) : raw;
  const { request, dialog } = useExternalLinkConfirm();
  return (
    <ConfirmLinkContext.Provider value={request}>
      {plainTextLinkParts(children).map((part, index) =>
        part.type === "text" ? (
          part.value
        ) : linkFaviconOrigin(part.href) ? (
          <WebsiteLink key={index} href={part.href}>
            {linkLabel(part.value, part.href)}
          </WebsiteLink>
        ) : (
          <ConfirmableAnchor key={index} href={part.href} className="text-link underline">
            {part.value}
          </ConfirmableAnchor>
        ),
      )}
      {dialog}
    </ConfirmLinkContext.Provider>
  );
}

export const ChatMarkdown = memo(function ChatMarkdown({
  children,
  streaming = false,
  onNavigate,
}: ChatMarkdownProps) {
  const { request, dialog } = useExternalLinkConfirm();
  const source = streaming ? closeUnterminatedFence(children) : children;
  const hideAmounts = useContext(HideAmountsContext);
  const rehypePlugins = hideAmounts
    ? [preserveSkippedTableText, maskAmounts]
    : [preserveSkippedTableText];

  return (
    <ConfirmLinkContext.Provider value={request}>
      <NavigateContext.Provider value={onNavigate}>
        <div
          className={streaming ? "rk-chat-markdown rk-chat-markdown-streaming" : "rk-chat-markdown"}
        >
          <LinkFaviconsPausedContext.Provider value={streaming}>
            <MarkdownTableSourceContext.Provider value={source}>
              <ReactMarkdown
                components={components}
                remarkPlugins={[remarkGfm]}
                rehypePlugins={rehypePlugins}
                skipHtml
                // MarkdownImage decides what an image source may do, so it receives the source as written.
                urlTransform={(url, key) =>
                  key === "src" ? url : (sanitizeMarkdownUrl(url, true) ?? "")
                }
              >
                {source}
              </ReactMarkdown>
            </MarkdownTableSourceContext.Provider>
          </LinkFaviconsPausedContext.Provider>
          {streaming ? <span aria-hidden="true" className="rk-chat-markdown-cursor" /> : null}
        </div>
      </NavigateContext.Provider>
      {dialog}
    </ConfirmLinkContext.Provider>
  );
});

export type { ChatMarkdownProps, LinkFavicons } from "./markdown";
export { HideAmountsContext, LinkFaviconsContext, RemoteImagesContext } from "./markdown";

export { MarkdownLinkPromptProvider } from "./markdown-link-prompt";
