import { Button } from "@rakazo/ui-web";

/** What a page's agent does, with a few questions to start; shown while its chat is empty. */
export function AgentStarter({
  description,
  prompts,
  disabled = false,
  onPick,
}: {
  description: string;
  prompts: readonly string[];
  disabled?: boolean;
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="flex shrink-0 flex-col items-start gap-3 px-4 pt-2 pb-4">
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <Button
            key={prompt}
            variant="outline"
            size="sm"
            className="h-auto min-h-8 whitespace-normal py-1.5 text-start"
            disabled={disabled}
            onClick={() => onPick(prompt)}
          >
            {prompt}
          </Button>
        ))}
      </div>
    </div>
  );
}
