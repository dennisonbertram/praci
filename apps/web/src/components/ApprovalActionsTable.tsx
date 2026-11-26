import { Trans, useLingui } from "@lingui/react/macro";
import type {
  ApprovalActionType,
  ApprovalChoice,
  ApprovalTableRow,
  PermissionLevel,
} from "@rakazo/contracts";
import { ALWAYS_ASK_ACTION_TYPES } from "@rakazo/core";
import {
  Button,
  NativeSelect,
  NativeSelectOption,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@rakazo/ui-web";
import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

/** The person-facing name of each action type. */
export function useActionTypeLabels(): Record<ApprovalActionType, string> {
  const { t } = useLingui();
  return {
    send_email: t`Send email`,
    organize_mail: t`Organize mail`,
    spend_money: t`Spend money`,
    connected_apps_write: t`Connected apps (write)`,
    calendar_changes: t`Calendar changes`,
    files_and_commands: t`Edit files and run commands`,
    use_computer: t`Use the computer`,
    delete_data: t`Delete data`,
    message_outside: t`Message people outside Praci`,
    use_credentials: t`Use saved credentials`,
  };
}

const SAME = "same";

/**
 * The approvals table: one Allow / Ask / Block select per action type. Without `botId` it edits
 * the space-wide rows; with one, each select starts with "Same as all bots" and edits that bot's
 * override. Every change saves at once. Rows show what the gate does at the current permission
 * level, so the table reloads when `refreshKey` changes; at Ask for everything no row can be
 * Allow, but Block still works. An always-ask row shows the gate's real decision and offers only
 * Ask and Block — the choices the gate honors for it.
 */
export function ApprovalActionsTable({
  botId,
  refreshKey,
  showMoreActionsDisclosure = true,
}: {
  botId?: string;
  refreshKey?: number;
  /** Hide the inner disclosure when a parent groups every action under one disclosure. */
  showMoreActionsDisclosure?: boolean;
}) {
  const { t } = useLingui();
  const labels = useActionTypeLabels();
  const [rows, setRows] = useState<ApprovalTableRow[] | null>(null);
  const [level, setLevel] = useState<PermissionLevel>("open");
  const loadedBot = useRef(botId);
  const [saving, setSaving] = useState<ApprovalActionType | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Only the latest load or save may supersede work already in flight; `currentBot` follows the
  // render, so a response from before the agent changed is stale even before the effect runs.
  const latest = useRef(0);
  const currentBot = useRef(botId);
  currentBot.current = botId;

  async function load() {
    const loadingBot = botId;
    const request = ++latest.current;
    try {
      const table = await rpc.approvalRules.table({ botId: loadingBot });
      if (request !== latest.current || currentBot.current !== loadingBot) return;
      setRows(table.rows);
      setLevel(table.level);
      setError(null);
    } catch (err) {
      if (request !== latest.current || currentBot.current !== loadingBot) return;
      // A failed refresh cannot leave the previous settings on screen to edit.
      setRows(null);
      setError(errorText(err, t`Could not load approvals`));
    }
  }
  useEffect(() => {
    // A new level keeps the rows on screen while it reloads; another agent starts from a skeleton.
    if (loadedBot.current !== botId) {
      setRows(null);
      setError(null);
    }
    loadedBot.current = botId;
    void load();
    return () => {
      latest.current += 1;
    };
  }, [botId, refreshKey]);

  async function choose(actionType: ApprovalActionType, value: string) {
    if (saving) return;
    const savingBot = botId;
    const effect = value === SAME ? null : (value as ApprovalChoice);
    const request = ++latest.current;
    setSaving(actionType);
    setError(null);
    const live = () => request === latest.current && currentBot.current === savingBot;
    try {
      await rpc.approvalRules.setActionType({ actionType, botId: savingBot, effect });
      // Another agent's load owns its table. For the same agent the write must always refetch:
      // a refresh that started during the write can have read the rules before they committed,
      // and its stale response must not leave old rows on screen. The refetch's `latest` bump
      // also supersedes any older load still in flight, and staying inside the try keeps the
      // save lock held until the new rows arrive.
      if (currentBot.current !== savingBot) return;
      await load();
    } catch (err) {
      if (live()) setError(errorText(err, t`Could not save approvals`));
    } finally {
      setSaving(null);
    }
  }

  // Hard lines ask whatever the setting says; say so under the row.
  const notes: Partial<Record<ApprovalActionType, string>> = {
    delete_data: t`Permanent deletes always ask`,
    send_email: t`New recipients always ask`,
    // A credentialed read is not a hard line; only writes and grants are (hardLineFor).
    use_credentials: t`Writes always ask`,
  };

  const renderRow = (row: ApprovalTableRow) => {
    const alwaysAsk = ALWAYS_ASK_ACTION_TYPES.has(row.actionType);
    // An always-ask row can be raised to Block; it can never be lowered to Allow. Its note shows
    // the gate's result, while a bot's selector shows that bot's override or Same as all bots.
    const note = alwaysAsk
      ? row.effect === "block"
        ? t`Blocked`
        : t`Always asks`
      : notes[row.actionType];
    return (
      <TableRow key={row.actionType}>
        <TableCell className="whitespace-normal py-1.5 pl-0 text-[14px] text-foreground/75">
          {labels[row.actionType]}
          {note ? (
            <p
              className="text-[12px] text-muted-foreground"
              data-testid={`approval-note-${row.actionType}`}
            >
              {note}
            </p>
          ) : null}
        </TableCell>
        <TableCell className="py-1.5 pr-0 text-right">
          <NativeSelect
            size="sm"
            className="ml-auto pointer-coarse:min-w-44"
            aria-label={labels[row.actionType]}
            data-testid={`approval-row-${row.actionType}`}
            disabled={saving !== null}
            value={
              botId
                ? (row.botEffect ?? SAME)
                : alwaysAsk
                  ? row.spaceEffect === "block"
                    ? "block"
                    : "ask"
                  : row.spaceEffect
            }
            onChange={(event) => void choose(row.actionType, event.target.value)}
          >
            {botId ? (
              <NativeSelectOption value={SAME}>
                <Trans>Same as all bots</Trans>
              </NativeSelectOption>
            ) : null}
            {!alwaysAsk ? (
              <NativeSelectOption value="allow" disabled={level === "ask_everything"}>
                <Trans>Allow</Trans>
              </NativeSelectOption>
            ) : null}
            <NativeSelectOption value="ask">
              <Trans>Ask</Trans>
            </NativeSelectOption>
            <NativeSelectOption value="block">
              <Trans>Block</Trans>
            </NativeSelectOption>
          </NativeSelect>
        </TableCell>
      </TableRow>
    );
  };

  if (!rows) {
    return error ? (
      <div>
        <p className="text-[13px] text-destructive">{error}</p>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => {
            setError(null);
            void load();
          }}
        >
          <Trans>Retry</Trans>
        </Button>
      </div>
    ) : (
      <Skeleton className="h-40 w-full" data-testid="approvals-skeleton" />
    );
  }
  const more = rows.filter((row) => !row.primary);
  return (
    <div data-testid="approval-actions-table">
      <Table compact>
        <TableBody>
          {(showMoreActionsDisclosure ? rows.filter((row) => row.primary) : rows).map(renderRow)}
        </TableBody>
      </Table>
      {showMoreActionsDisclosure && more.length > 0 ? (
        <details className="group mt-1">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1 py-1.5 text-[13px] text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronRight
              aria-hidden="true"
              className="size-4 transition-transform group-open:rotate-90"
            />
            <Trans>More actions</Trans>
          </summary>
          <Table compact>
            <TableBody>{more.map(renderRow)}</TableBody>
          </Table>
        </details>
      ) : null}
      {error ? <p className="mt-2 text-[13px] text-destructive">{error}</p> : null}
    </div>
  );
}
