export function wrapUntrustedContent(value: string): string {
  return `<untrusted_content untrusted="true">${value.replace(/<\/untrusted_content/gi, "&lt;/untrusted_content")}</untrusted_content>`;
}
