import { Trans } from "@lingui/react/macro";
import type { Bot } from "@rakazo/contracts";
import { BotAvatar, Button } from "@rakazo/ui-web";

/** Bots left out of the sidebar; each has a Show button. Nothing renders when none are hidden. */
export function HiddenBotsList({
  bots,
  onShow,
}: {
  bots: readonly Pick<Bot, "id" | "name" | "color">[];
  onShow: (botId: string) => void;
}) {
  if (bots.length === 0) return null;
  return (
    <section data-testid="hidden-bots" className="rounded-xl border border-border px-4 py-4">
      <h3 className="text-[15px] font-medium text-foreground">
        <Trans>Hidden bots</Trans>
      </h3>
      <ul className="mt-3 grid gap-2">
        {bots.map((bot) => (
          <li key={bot.id} className="flex items-center gap-3">
            <BotAvatar color={bot.color} identity={bot.id} size={28} />
            <span dir="auto" className="min-w-0 flex-1 truncate text-[14px]">
              {bot.name}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => onShow(bot.id)}>
              <Trans>Show</Trans>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
