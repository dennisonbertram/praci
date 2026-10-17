import type { ComposerMention } from "@rakazo/core";
import { DEFAULT_BOT_COLOR } from "@rakazo/core";
import { BotAvatar } from "@rakazo/ui-web";
import { AtSign, Clock, Puzzle, Users } from "lucide-react";

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
  // Icons like the other non-bot kinds, never a bare letter.
  if (mention.kind === "group") return <Users {...iconProps} />;
  if (mention.kind === "everyone") return <AtSign {...iconProps} />;
  return <BotAvatar color={mention.color ?? DEFAULT_BOT_COLOR} identity={mention.id} size={16} />;
}
