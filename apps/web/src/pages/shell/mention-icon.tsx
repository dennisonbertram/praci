import type { ComposerMention } from "@rakazo/core";
import { DEFAULT_BOT_COLOR } from "@rakazo/core";
import { BotAvatar } from "@rakazo/ui-web";
import { Clock, Puzzle } from "lucide-react";

const GLYPHS = { group: "G", everyone: "@" } as const;

/** Icon for a mention in the picker ("option") or in the composer ("chip"). */
export function MentionIcon({
  mention,
  variant,
}: {
  mention: ComposerMention;
  variant: "option" | "chip";
}) {
  const option = variant === "option";
  const iconProps = {
    size: option ? 16 : 13,
    strokeWidth: 1.7,
    className: option
      ? "mt-0.5 shrink-0 text-muted-foreground"
      : "shrink-0 text-muted-foreground/70",
  };
  if (mention.kind === "routine") return <Clock {...iconProps} />;
  if (mention.kind === "connector") return <Puzzle {...iconProps} />;
  if (mention.kind === "group" || mention.kind === "everyone") {
    return (
      <span
        className={`${option ? "mt-0.5 " : ""}grid h-4 w-4 shrink-0 place-items-center rounded-full bg-accent text-[9px] text-foreground/75`}
      >
        {GLYPHS[mention.kind]}
      </span>
    );
  }
  return <BotAvatar color={mention.color ?? DEFAULT_BOT_COLOR} identity={mention.id} size={16} />;
}
