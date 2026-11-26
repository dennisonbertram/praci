/** Returns whether an HTML fragment contains text or visible media content. */
export function htmlHasVisibleContent(html: string): boolean {
  const withoutNonContent = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");

  if (/<(img|svg|video)\b[^>]*>/i.test(withoutNonContent)) return true;

  const text = withoutNonContent
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;|&#x0*a0;/gi, " ")
    .trim();
  return text.length > 0;
}
