import { Trans } from "@lingui/react/macro";
import { Tooltip, TooltipContent, TooltipTrigger } from "@rakazo/ui-web";
import type { ReactNode } from "react";

/**
 * Explains a disabled Brex write button. A disabled button gets no pointer or focus events, so
 * when `writesOff` the button sits in a focusable span that carries the tooltip. Pass `writesOff`
 * only when writes being off is the sole reason the button is disabled.
 */
export function BrexWritesOffHint({
  writesOff,
  children,
}: {
  writesOff: boolean;
  children: ReactNode;
}) {
  if (!writesOff) return <>{children}</>;
  return (
    <Tooltip>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a disabled button cannot take focus, so the wrapper must. */}
      <TooltipTrigger render={<span tabIndex={0} className="inline-flex" />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>
        <Trans>Turn on Brex writes for the Brex agent to edit.</Trans>
      </TooltipContent>
    </Tooltip>
  );
}
