import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@rakazo/ui-web";

export type PageAgentKind = "inbox" | "finance" | "carta";

/** Which page agent a bot is, from the spawn key its page created it with (null for other bots). */
export function pageAgentKind(spawnKey: string | null | undefined): PageAgentKind | null {
  if (spawnKey?.startsWith("inbox-agent:")) return "inbox";
  if (spawnKey?.startsWith("finance-agent:")) return "finance";
  if (spawnKey?.startsWith("carta-agent:")) return "carta";
  return null;
}

/**
 * A page agent's empty thread: what it does, and questions to start with. Page agents are made
 * without an introduction run, so without this their chat opens blank.
 */
export function PageAgentIntro({
  kind,
  onAsk,
}: {
  kind: PageAgentKind;
  onAsk: (text: string) => void;
}) {
  const { t } = useLingui();
  const questions =
    kind === "inbox"
      ? [
          t`What needs my reply today?`,
          t`Summarize what's new this week`,
          t`Find the latest invoice`,
        ]
      : kind === "finance"
        ? [
            t`How much runway do we have?`,
            t`What did we spend last month?`,
            t`Which bills are unpaid?`,
          ]
        : [
            t`Who owns what in the company?`,
            t`How much of the option pool is left?`,
            t`Draft this month's investor update`,
          ];
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 px-4 py-5 md:px-7">
      <p className="text-sm text-muted-foreground">
        {kind === "inbox" ? (
          <Trans>
            I read your mail, find what needs a reply and write replies. You approve each email
            before it is sent.
          </Trans>
        ) : kind === "finance" ? (
          <Trans>
            I read your bank and card accounts and answer questions about cash, spending and runway.
          </Trans>
        ) : (
          <Trans>
            I keep your cap table and investor contacts, and draft investor updates for you to
            review.
          </Trans>
        )}
      </p>
      <div className="flex flex-col items-start gap-1.5">
        {questions.map((question) => (
          <Button key={question} variant="outline" size="sm" onClick={() => onAsk(question)}>
            {question}
          </Button>
        ))}
      </div>
    </div>
  );
}
