import { Fragment } from "react";

/** An email with line-break points after "@" and before each ".", so a narrow column wraps it at sensible places. */
export function emailBreaks(email: string) {
  return email.split(/(?<=@)|(?=\.)/).map((part, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: the parts never reorder
    <Fragment key={i}>
      {i > 0 ? <wbr /> : null}
      {part}
    </Fragment>
  ));
}
