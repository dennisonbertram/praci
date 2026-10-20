import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { FinanceStatement } from "@rakazo/contracts";
import { STATEMENT_EXTENSIONS, STATEMENT_MAX_BYTES } from "@rakazo/contracts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@rakazo/ui-web";
import { useEffect, useRef, useState } from "react";
import { fullDay } from "../../lib/finance-format";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import type { StatementRow } from "./StatementReviewCard";
import { StatementGroup, statementAccountKey } from "./StatementReviewCard";

type Item = {
  key: number;
  name: string;
  state: "uploading" | "failed" | "imported" | "review";
  statement?: FinanceStatement;
  error?: string;
  busy?: boolean;
};

const ACCEPT = STATEMENT_EXTENSIONS.map((e) => `.${e}`).join(",");

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Upload one or more statement files. A file whose balances add up is imported straight away; one
 * that does not waits for Import anyway or Discard. Earlier statements are listed too, so any can
 * be removed later. Statements of the same account are listed together.
 */
export function StatementImport({ onImported }: { onImported: () => void }) {
  const { t } = useLingui();
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  // An imported statement's removal deletes its transactions, so it is confirmed first.
  const [confirming, setConfirming] = useState<StatementRow | null>(null);
  const counter = useRef(0);
  const patch = (key: number, next: Partial<Item>) =>
    setItems((all) => all.map((i) => (i.key === key ? { ...i, ...next } : i)));

  useEffect(() => {
    let live = true;
    rpc.finance
      .statements()
      .then(({ statements }) => {
        if (!live) return;
        const past = statements
          .filter((s) => s.status === "imported" || s.status === "review")
          .map(
            (statement): Item => ({
              key: ++counter.current,
              name: statement.fileName,
              state: statement.status === "review" ? "review" : "imported",
              // Its account exists by now, so it is not shown as a new one.
              statement:
                statement.status === "imported"
                  ? { ...statement, createsAccount: false }
                  : statement,
            }),
          );
        setItems((all) => [...past, ...all]);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  async function add(files: File[]) {
    const fresh = files.map((file) => ({ file, key: ++counter.current }));
    setItems((all) => [
      ...all,
      ...fresh.map(({ file, key }): Item => ({ key, name: file.name, state: "uploading" })),
    ]);
    for (const { file, key } of fresh) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!(STATEMENT_EXTENSIONS as readonly string[]).includes(ext)) {
        patch(key, { state: "failed", error: t`Upload a PDF, CSV, OFX or QFX file` });
      } else if (file.size > STATEMENT_MAX_BYTES) {
        patch(key, { state: "failed", error: t`The file is too large` });
      } else {
        try {
          // The browser's own read error is developer text; the row says it plainly instead.
          const contentBase64 = await toBase64(file).catch(() => {
            throw new Error(t`Could not read this file`);
          });
          const statement = await rpc.finance.statementUpload({
            fileName: file.name,
            contentBase64,
          });
          if (statement.status !== "review") {
            patch(key, {
              state: "failed",
              error: statement.error ?? t`Could not read this file`,
            });
            // The server keeps a failed statement; nothing in it is worth keeping.
            void rpc.finance.statementDiscard({ id: statement.id }).catch(() => {});
          } else if (statement.check?.balances === "mismatch") {
            patch(key, { state: "review", statement });
          } else {
            try {
              await rpc.finance.statementConfirm({ id: statement.id });
              patch(key, { state: "imported", statement });
              onImported();
            } catch (cause) {
              void rpc.finance.statementDiscard({ id: statement.id }).catch(() => {});
              patch(key, { state: "failed", error: errorText(cause) });
            }
          }
        } catch (cause) {
          patch(key, { state: "failed", error: errorText(cause) });
        }
      }
    }
  }

  async function importAnyway(row: StatementRow) {
    patch(row.key, { busy: true, error: undefined });
    try {
      await rpc.finance.statementConfirm({ id: row.statement.id, acceptMismatch: true });
      patch(row.key, { busy: false, state: "imported" });
      onImported();
    } catch (cause) {
      patch(row.key, { busy: false, error: errorText(cause) });
    }
  }

  async function remove(row: StatementRow) {
    const item = items.find((i) => i.key === row.key);
    if (!item) return;
    patch(item.key, { busy: true, error: undefined });
    try {
      await rpc.finance.statementDiscard({ id: row.statement.id });
      setItems((all) => all.filter((i) => i.key !== item.key));
      if (item.state === "imported") onImported();
    } catch (cause) {
      patch(item.key, { busy: false, error: errorText(cause) });
    }
  }

  const groups = new Map<string, StatementRow[]>();
  for (const item of items) {
    if ((item.state !== "imported" && item.state !== "review") || !item.statement) continue;
    const row = {
      key: item.key,
      statement: item.statement,
      busy: Boolean(item.busy),
      error: item.error,
      review: item.state === "review",
    };
    const key = statementAccountKey(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const others = items.filter((i) => i.state === "uploading" || i.state === "failed");

  return (
    <div className="flex flex-col gap-3">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void add([...e.dataTransfer.files]);
        }}
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground hover:text-foreground ${
          dragging ? "border-foreground text-foreground" : "border-border"
        }`}
      >
        <Trans>Drop statements here or choose files</Trans>
        <span className="text-xs">PDF, CSV, OFX, QFX</span>
        <input
          type="file"
          multiple
          accept={ACCEPT}
          aria-label={t`Statement files`}
          className="sr-only"
          onChange={(e) => {
            void add([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </label>
      {items.length > 0 ? (
        <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
          {[...groups.entries()].map(([key, rows]) => (
            <StatementGroup
              key={key}
              rows={rows}
              onRemove={(row) => (row.review ? void remove(row) : setConfirming(row))}
              onImport={(row) => void importAnyway(row)}
            />
          ))}
          {others.map((item) => (
            <li
              key={item.key}
              className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
            >
              <span className="truncate">{item.name}</span>
              {item.state === "uploading" ? (
                <span className="text-muted-foreground">
                  <Trans>Reading…</Trans>
                </span>
              ) : (
                <span role="alert" className="flex items-center gap-2 text-destructive">
                  {item.error}
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setItems((all) => all.filter((i) => i.key !== item.key))}
                  >
                    <Trans>Dismiss</Trans>
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming?.statement.periodStart && confirming.statement.periodEnd
                ? t`Remove the ${fullDay(confirming.statement.periodStart)} – ${fullDay(confirming.statement.periodEnd)} statement?`
                : t`Remove ${confirming?.statement.fileName ?? ""}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {plural(confirming?.statement.transactionCount ?? 0, {
                one: "Its # transaction will be removed from Finance.",
                other: "Its # transactions will be removed from Finance.",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Trans>Cancel</Trans>
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (confirming) void remove(confirming);
                setConfirming(null);
              }}
            >
              <Trans>Remove</Trans>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
