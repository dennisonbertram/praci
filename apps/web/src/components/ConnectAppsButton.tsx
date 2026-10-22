import { Trans, useLingui } from "@lingui/react/macro";
import { LayoutGrid } from "lucide-react";
import { SidebarPageLink } from "./SidebarPageLink";

/** The sidebar's Integrations row. */
export function ConnectAppsButton({
  active,
  onClick,
  rail = false,
}: {
  active: boolean;
  onClick: () => void;
  rail?: boolean;
}) {
  const { t } = useLingui();
  if (rail) {
    return (
      <SidebarPageLink
        rail
        testId="sidebar-integrations"
        current={active}
        icon={<LayoutGrid size={15} strokeWidth={1.8} aria-hidden="true" />}
        label={t`Integrations`}
        onOpen={onClick}
      />
    );
  }
  return (
    <button
      type="button"
      data-testid="sidebar-integrations"
      data-tour="sidebar-integrations"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={`mb-1 flex w-full items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${
        active ? "bg-sidebar-accent" : ""
      }`}
    >
      <span className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-accent text-foreground/80">
        <LayoutGrid size={15} strokeWidth={1.8} />
      </span>
      <span className="text-[14px] font-medium text-foreground/90">
        <Trans>Integrations</Trans>
      </span>
    </button>
  );
}
