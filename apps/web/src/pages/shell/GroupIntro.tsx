import { Trans, useLingui } from "@lingui/react/macro";
import type { Group } from "@rakazo/contracts";
import { BotAvatar, Button } from "@rakazo/ui-web";

/** An empty group chat: who is in it, how replies work, and a first question for everyone. */
export function GroupIntro({
  members,
  onAsk,
}: {
  members: Group["members"];
  onAsk: (text: string) => void;
}) {
  const { t } = useLingui();
  const first = members[0]?.name ?? "";
  const ask = t`Quick status check from everyone, please`;
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 px-4 py-5 md:px-7">
      <ul className="flex flex-wrap gap-2" aria-label={t`Members`}>
        {members.map((member) => (
          <li
            key={member.botId}
            className="flex items-center gap-2 rounded-full border border-border py-1 ps-1 pe-3 text-sm"
          >
            <BotAvatar color={member.color} identity={member.botId} size={22} />
            <span dir="auto">{member.name}</span>
          </li>
        ))}
      </ul>
      <p className="max-w-xl text-sm text-muted-foreground">
        <Trans>
          {first} answers by default. Type @ and a name to ask one bot, or ask everyone to hear from
          each of them.
        </Trans>
      </p>
      <div>
        <Button variant="outline" size="sm" onClick={() => onAsk(ask)}>
          {ask}
        </Button>
      </div>
    </div>
  );
}
