/**
 * The Lingui macro compiles away in the app build; tests run the source, so `t` just renders the
 * English template.
 */
export function t(strings: TemplateStringsArray, ...values: unknown[]): string {
  return String.raw(strings, ...values);
}

/** English one/other forms with `#` replaced by the count. */
export function plural(count: number, forms: { one: string; other: string }): string {
  return (count === 1 ? forms.one : forms.other).replace("#", String(count));
}

/** A message descriptor, as `msg` produces in the app build; `i18n._` renders its message. */
export function msg(
  strings: TemplateStringsArray,
  ...values: unknown[]
): { id: string; message: string } {
  const message = String.raw(strings, ...values);
  return { id: message, message };
}
