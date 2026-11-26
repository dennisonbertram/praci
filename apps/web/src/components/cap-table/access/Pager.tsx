import { t } from "@lingui/core/macro";
import { Button } from "@rakazo/ui-web";

/** "26–50 of 137" with Previous and Next, under a paged table. Nothing when one page holds all. */
export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (total <= pageSize) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="tabular-nums text-muted-foreground">{t`${first}–${last} of ${total}`}</span>
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {t`Previous`}
      </Button>
      <Button variant="outline" size="sm" disabled={last >= total} onClick={() => onPage(page + 1)}>
        {t`Next`}
      </Button>
    </div>
  );
}
