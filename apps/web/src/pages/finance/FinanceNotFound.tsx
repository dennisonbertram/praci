import { t } from "@lingui/core/macro";
import { DetailHead, NotFoundNotice } from "../../components/finance/ui";
import { financePath } from "../../lib/finance-route";

export function FinanceNotFound() {
  return (
    <div>
      <DetailHead
        crumbs={[{ label: t`Finance`, to: financePath.dashboard() }, { label: t`Not found` }]}
      />
      <NotFoundNotice />
    </div>
  );
}
