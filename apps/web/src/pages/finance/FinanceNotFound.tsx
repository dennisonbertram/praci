import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { DetailHead } from "../../components/finance/ui";
import { financePath } from "../../lib/finance-route";

export function FinanceNotFound() {
  return (
    <div>
      <DetailHead
        crumbs={[{ label: t`Finance`, to: financePath.dashboard() }, { label: t`Not found` }]}
      />
      <h1 className="mt-1.5 text-xl font-semibold">
        <Trans>Not found</Trans>
      </h1>
    </div>
  );
}
