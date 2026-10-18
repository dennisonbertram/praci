import { Trans } from "@lingui/react/macro";
import { Button } from "@rakazo/ui-web";

/**
 * What an empty page-bot panel shows above its composer: what this bot does, and a couple of
 * questions to start with. Gone once the chat has a message. With no model set up the bot cannot
 * answer, so `onAddModel` replaces the questions with an Add a model button.
 */
export function AgentPanelIntro({
  description,
  suggestions,
  onPick,
  disabled = false,
  onAddModel,
}: {
  description: string;
  suggestions: string[];
  onPick: (text: string) => void;
  disabled?: boolean;
  onAddModel?: () => void;
}) {
  return (
    <div data-testid="agent-panel-intro" className="flex flex-col gap-3 px-4 pt-2 pb-4">
      {onAddModel ? (
        <>
          <p className="text-sm text-muted-foreground">
            <Trans>
              This agent needs a model before it can answer. Add one in Settings, Models.
            </Trans>
          </p>
          <Button size="sm" className="self-start" onClick={onAddModel}>
            <Trans>Add a model</Trans>
          </Button>
        </>
      ) : (
        <>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          <div className="flex flex-col items-start gap-2">
            {suggestions.map((text) => (
              <Button
                key={text}
                variant="outline"
                size="sm"
                disabled={disabled}
                className="h-auto max-w-full py-1.5 text-start whitespace-normal"
                onClick={() => onPick(text)}
              >
                {text}
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
