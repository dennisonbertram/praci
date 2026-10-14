import { Trans } from "@lingui/react/macro";
import { Dialog, DialogContent, DialogTitle, Kbd } from "@rakazo/ui-web";

/** The Inbox keys, as a plain two-column list. */
export function InboxShortcuts({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rows: Array<[string, React.ReactNode]> = [
    ["j", <Trans key="j">Next message</Trans>],
    ["k", <Trans key="k">Previous message</Trans>],
    ["Enter", <Trans key="o">Open</Trans>],
    ["/", <Trans key="s">Search</Trans>],
    ["c", <Trans key="c">Compose</Trans>],
    ["e", <Trans key="e2">Archive</Trans>],
    ["r", <Trans key="r">Reply</Trans>],
    ["a", <Trans key="a">Reply all</Trans>],
    ["f", <Trans key="f">Forward</Trans>],
    ["Esc", <Trans key="e">Close</Trans>],
  ];
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle>
          <Trans>Keyboard shortcuts</Trans>
        </DialogTitle>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
          {rows.map(([key, label]) => (
            <div key={key} className="contents">
              <dt>
                <Kbd>{key}</Kbd>
              </dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
