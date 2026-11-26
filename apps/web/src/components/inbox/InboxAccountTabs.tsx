import { useLingui } from "@lingui/react/macro";
import type { MailAccountSummary } from "@rakazo/contracts";
import { accountTabNames } from "@rakazo/contracts";
import { Tabs, TabsList, TabsTrigger } from "@rakazo/ui-web";

const ALL = "all";

/** Account choice for an inbox with two or more mailboxes; nothing renders with fewer. */
export function InboxAccountTabs({
  accounts,
  value,
  onChange,
}: {
  accounts: MailAccountSummary[];
  /** The chosen connection id; undefined is All. */
  value: string | undefined;
  onChange: (connectionId: string | undefined) => void;
}) {
  const { t } = useLingui();
  if (accounts.length < 2) return null;
  const names = accountTabNames(accounts);
  return (
    <Tabs
      className="-mt-2 mb-4 min-w-0 max-w-full"
      value={value ?? ALL}
      onValueChange={(next) => onChange(next === ALL ? undefined : String(next))}
    >
      <TabsList
        aria-label={t`Account`}
        className="max-w-full justify-start overflow-x-auto rounded-full [scrollbar-width:none] pointer-coarse:h-auto [&::-webkit-scrollbar]:hidden"
      >
        <TabsTrigger value={ALL} className="flex-none rounded-full px-3 pointer-coarse:h-11">
          {t`All`}
        </TabsTrigger>
        {accounts.map((account, i) => (
          <TabsTrigger
            key={account.connectionId}
            value={account.connectionId}
            title={names[i]}
            className="flex-none rounded-full px-3 pointer-coarse:h-11"
          >
            <span className="max-w-40 truncate">{names[i]}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
