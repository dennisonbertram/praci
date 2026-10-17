import { Button } from "@rakazo/ui-web";

/**
 * What an empty page-bot panel shows above its composer: what this bot does, and a couple of
 * questions to start with. Gone once the chat has a message.
 */
export function AgentPanelIntro({
  description,
  suggestions,
  onPick,
  disabled = false,
}: {
  description: string;
  suggestions: string[];
  onPick: (text: string) => void;
  disabled?: boolean;
}) {
  return (
    <div data-testid="agent-panel-intro" className="flex flex-col gap-3 px-4 pt-2 pb-4">
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
    </div>
  );
}
