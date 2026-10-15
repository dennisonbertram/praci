import { Trans, useLingui } from "@lingui/react/macro";
import type { FinanceStatement } from "@rakazo/contracts";
import { STATEMENT_EXTENSIONS, STATEMENT_MAX_BYTES } from "@rakazo/contracts";
import { Button } from "@rakazo/ui-web";
import { useEffect, useRef, useState } from "react";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { StatementReviewCard } from "./StatementReviewCard";

type Item = {
  key: number;
  name: string;
  state: "uploading" | "review" | "failed" | "imported";
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
 * Upload one or more statement files, review what each will import, then import or discard it.
 * A statement still waiting for review when this unmounts is discarded, so nothing is left half-done.
 */
export function StatementImport({ onImported }: { onImported: () => void }) {
  const { t } = useLingui();
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const counter = useRef(0);
  const pending = useRef<string[]>([]);
  pending.current = items.flatMap((i) => (i.state === "review" && i.statement ? [i.statement.id] : []));
  useEffect(
    () => () => {
      for (const id of pending.current) void rpc.finance.statementDiscard({ id }).catch(() => {});
    },
    [],
  );

  const patch = (key: number, next: Partial<Item>) =>
    setItems((all) => all.map((i) => (i.key === key ? { ...i, ...next } : i)));

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
          const statement = await rpc.finance.statementUpload({
            fileName: file.name,
            contentBase64: await toBase64(file),
          });
          patch(
            key,
            statement.status === "review"
              ? { state: "review", statement }
              : { state: "failed", statement, error: statement.error ?? t`Could not read this file` },
          );
          // The server keeps a failed statement; nothing in it is worth reviewing.
          if (statement.status !== "review") void rpc.finance.statementDiscard({ id: statement.id }).catch(() => {});
        } catch (cause) {
          patch(key, { state: "failed", error: errorText(cause) });
        }
      }
    }
  }

  async function run(item: Item, action: "import" | "discard") {
    const statement = item.statement;
    if (!statement) return;
    patch(item.key, { busy: true, error: undefined });
    try {
      if (action === "import") {
        await rpc.finance.statementConfirm({
          id: statement.id,
          ...(statement.check?.balances === "mismatch" ? { acceptMismatch: true } : {}),
        });
        patch(item.key, { state: "imported", busy: false });
        onImported();
      } else {
        await rpc.finance.statementDiscard({ id: statement.id });
        setItems((all) => all.filter((i) => i.key !== item.key));
      }
    } catch (cause) {
      patch(item.key, { busy: false, error: errorText(cause) });
    }
  }

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
          {items.map((item) =>
            item.state === "review" && item.statement ? (
              <div key={item.key}>
                <StatementReviewCard
                  statement={item.statement}
                  busy={Boolean(item.busy)}
                  onImport={() => void run(item, "import")}
                  onDiscard={() => void run(item, "discard")}
                />
                {item.error ? (
                  <p role="alert" className="mt-1 text-sm text-destructive">
                    {item.error}
                  </p>
                ) : null}
              </div>
            ) : (
              <li
                key={item.key}
                className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
              >
                <span className="truncate">{item.name}</span>
                {item.state === "uploading" ? (
                  <span className="text-muted-foreground">
                    <Trans>Reading…</Trans>
                  </span>
                ) : item.state === "imported" ? (
                  <span className="text-success">
                    <Trans>Imported</Trans>
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
            ),
          )}
        </ul>
      ) : null}
    </div>
  );
}
