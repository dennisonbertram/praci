import { plural } from "@lingui/core/macro";
import { Link } from "react-router-dom";
import { LEGAL_DUE_SOON_PATH } from "../../lib/legal-format";

/** The sidebar badge's number, on the page: overdue or due within a week. Links to those deadlines. */
export function DueSoonChip({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Link
      to={LEGAL_DUE_SOON_PATH}
      className="mb-3 inline-flex h-6 items-center pointer-coarse:h-11 rounded-full border border-warning/40 px-2.5 text-xs font-medium text-warning hover:bg-warning/10"
    >
      {plural(count, { one: "# due soon", other: "# due soon" })}
    </Link>
  );
}
