import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { BrexActivity as BrexActivityData } from "@rakazo/contracts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { sortBy, useListParams } from "../../lib/list-params";
import { formatRosterTime } from "../../lib/roster-time";
import { rpc } from "../../lib/rpc";
import { Section, useFinanceQuery } from "../finance/ui";
import { PickFilter, SortControl } from "../ListControls";
import { BrexSection } from "./BrexSection";

const dash = "—";

/** The write tool's plain name; the RPC already filtered to the card write tools. */
function actionName(action: string): string {
  switch (action) {
    case "create_vendor_card":
      return t`New card`;
    case "update_card":
      return t`Edit card`;
    case "lock_card":
      return t`Lock card`;
    case "terminate_card":
      return t`Cancel card`;
    case "create_spend_limit":
      return t`New spend limit`;
    case "update_spend_limit":
      return t`Update spend limit`;
    case "update_expense_memo":
      return t`Edit memo`;
    default:
      return action;
  }
}

function resultName(status: string): string {
  switch (status) {
    case "succeeded":
      return t`Done`;
    case "failed":
      return t`Failed`;
    case "denied":
      return t`Declined`;
    case "approved":
      return t`Approved`;
    case "executing":
      return t`Running`;
    case "intended":
      return t`Waiting`;
    default:
      return status;
  }
}

type ActivitySort = "time" | "action" | "target" | "result";

function ActivityView({ data }: { data: BrexActivityData }) {
  const { t } = useLingui();
  const list = useListParams(["time", "action", "target", "result"] as const, {
    field: "time",
    dir: "desc",
  });
  const action = list.param("action");
  const result = list.param("result");
  const filtered = data.activities.filter(
    (row) => (!action || row.action === action) && (!result || row.status === result),
  );
  const picks: Record<
    ActivitySort,
    (row: BrexActivityData["activities"][number]) => string | null
  > = {
    time: (row) => row.at,
    action: (row) => actionName(row.action),
    target: (row) => row.target,
    result: (row) => resultName(row.status),
  };
  const rows = sortBy(filtered, picks[list.sort.field as ActivitySort], list.sort.dir);
  const sortHead = (field: ActivitySort) => ({
    sortDirection: list.sort.field === field ? list.sort.dir : null,
    onSort: () => list.toggleSort(field),
  });
  const sortNames: Record<ActivitySort, string> = {
    time: t`When`,
    action: t`Action`,
    target: t`Card or item`,
    result: t`Result`,
  };
  // Filter choices come from the rows themselves, labeled the way the table shows them.
  const actionOptions = [...new Set(data.activities.map((row) => row.action))]
    .sort((a, b) => actionName(a).localeCompare(actionName(b)))
    .map((value): [string, string] => [value, actionName(value)]);
  const resultOptions = [...new Set(data.activities.map((row) => row.status))]
    .sort((a, b) => resultName(a).localeCompare(resultName(b)))
    .map((value): [string, string] => [value, resultName(value)]);
  const filteredList = Boolean(action || result);

  return (
    <Section title={<Trans>Activity</Trans>}>
      {data.activities.length > 0 && (
        <div data-list-toolbar className="mb-2 mt-2 flex flex-wrap items-center gap-2">
          <PickFilter
            label={t`Action`}
            value={action}
            options={actionOptions}
            onChange={(value) => list.setParam("action", value)}
          />
          <PickFilter
            label={t`Result`}
            value={result}
            options={resultOptions}
            onChange={(value) => list.setParam("result", value)}
          />
          <span className="ms-auto flex items-center gap-1 @6xl:hidden">
            <SortControl
              fields={(["time", "action", "target", "result"] as ActivitySort[]).map((field) => [
                field,
                sortNames[field],
              ])}
              field={list.sort.field as ActivitySort}
              fieldLabel={sortNames[list.sort.field as ActivitySort]}
              direction={list.sort.dir}
              onField={(field) => list.setSort({ field: field as ActivitySort, dir: "asc" })}
              onDirection={(dir) => list.setSort({ field: list.sort.field as ActivitySort, dir })}
            />
          </span>
        </div>
      )}
      {rows.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          {filteredList ? <Trans>No matches</Trans> : <Trans>No changes yet.</Trans>}
        </p>
      ) : (
        <Table compact>
          <caption className="sr-only">
            <Trans>Brex activity</Trans>
          </caption>
          <TableHeader>
            <TableHeadRow>
              <TableHead {...sortHead("time")}>
                <Trans>When</Trans>
              </TableHead>
              <TableHead {...sortHead("action")}>
                <Trans>Action</Trans>
              </TableHead>
              <TableHead {...sortHead("target")}>
                <Trans>Card or item</Trans>
              </TableHead>
              <TableHead {...sortHead("result")}>
                <Trans>Result</Trans>
              </TableHead>
            </TableHeadRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.effectId}>
                <TableCell className="whitespace-nowrap">
                  {formatRosterTime(row.at) || dash}
                </TableCell>
                <TableCell className="max-w-40 truncate">{actionName(row.action)}</TableCell>
                <TableCell className="max-w-56 truncate" title={row.target ?? ""}>
                  {row.target ?? dash}
                </TableCell>
                <TableCell className="whitespace-nowrap">{resultName(row.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}

/**
 * The owner's Brex changes: tool, target, status and time. The plan removed the approver column:
 * the effect record stores none, so the page never invents one. The API scopes rows to this space.
 */
export function BrexActivity() {
  const query = useFinanceQuery(() => rpc.brexCards.activity(), []);
  return <BrexSection query={query}>{(data) => <ActivityView data={data} />}</BrexSection>;
}
