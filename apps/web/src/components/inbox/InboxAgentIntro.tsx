import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@rakazo/ui-web";

/** The Inbox agent's empty thread: what it does, and questions to start with. */
export function InboxAgentIntro({ onAsk }: { onAsk: (text: string) => void }) {
  const { t } = useLingui();
  const questions = [
    t`What needs my reply today?`,
    t`Summarize what's new this week`,
    t`Find the latest invoice`,
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 px-4 py-5 md:px-7">
      <p className="text-sm text-muted-foreground">
        <Trans>
          I read your mail, find what needs a reply and write replies. You approve each email before
          it is sent.
        </Trans>
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
