import { i18n } from "@lingui/core";
import { plural } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { MessageBlock } from "@rakazo/contracts";
import { Button } from "@rakazo/ui-web";
import { ChevronDown, ChevronRight, Mail, Paperclip } from "lucide-react";
import { useState } from "react";
import { maskCurrencyWhenHidden, useHideAmounts } from "../lib/hide-amounts-preference";

type MailThreadBlock = Extract<MessageBlock, { kind: "mail_thread" }>;

/** The mail thread an "Ask agent" chat starts with, collapsed until the owner opens it. */
export function MailThreadCard({ block }: { block: MailThreadBlock }) {
  useHideAmounts();
  const [open, setOpen] = useState(false);
  const count = block.messages.length;
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <section className="w-full max-w-xl rounded-xl bg-card text-sm ring-1 ring-foreground/10">
      <Button
        variant="ghost"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="h-auto w-full min-w-0 justify-start gap-2 px-3 py-2.5 text-start font-normal"
      >
        <Mail aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <span dir="auto" className="min-w-0 flex-1 truncate">
          <span className="font-medium">
            <Trans>Email thread</Trans>
          </span>
          <span className="text-muted-foreground">
            {" · "}
            {plural(count, { one: "# message", other: "# messages" })}
          </span>
        </span>
        <Chevron aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </Button>
      {open ? (
        <ol className="flex max-h-96 flex-col overflow-y-auto border-t border-border">
          {block.messages.map((message, index) => {
            const sent = new Date(message.date);
            return (
              <li
                key={index}
                className="flex flex-col gap-1 border-b border-border p-3 last:border-b-0"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span dir="auto" className="min-w-0 truncate font-medium">
                    {message.from}
                  </span>
                  <time className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {Number.isNaN(sent.getTime())
                      ? message.date
                      : sent.toLocaleString(i18n.locale || "en", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                  </time>
                </div>
                <p dir="auto" className="whitespace-pre-wrap wrap-anywhere">
                  {maskCurrencyWhenHidden(message.text)}
                </p>
                {message.attachments?.length ? (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Paperclip aria-hidden="true" className="size-3 shrink-0" />
                    <span dir="auto" className="min-w-0 truncate">
                      {message.attachments.join(", ")}
                    </span>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
