import { plural } from "@lingui/core/macro";
import { Button } from "@rakazo/ui-web";

/** The sidebar badge counts failed files; this is the way to them once the page is open. */
export function FailedChip({ count, onClick }: { count: number; onClick: () => void }) {
  if (count <= 0) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-testid="failed-chip"
      className="h-8 rounded-full text-destructive"
      onClick={onClick}
    >
      {plural(count, { one: "# failed", other: "# failed" })}
    </Button>
  );
}
