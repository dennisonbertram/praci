/** The type badge already says "MD" or "CSV", so the title drops the extension. */
export function artifactDisplayName(name: string): string {
  return name.replace(/\.[A-Za-z0-9]{1,5}$/, "") || name;
}
