import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { CompanyImportCatalogSource, CompanyImportChannels } from "@rakazo/contracts";
import {
  CompanyDataRoomScopeSchema,
  CompanyGenericScopeSchema,
  CompanyMailScopeSchema,
  CompanySlackScopeSchema,
} from "@rakazo/contracts";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  Input,
  Textarea,
} from "@rakazo/ui-web";
import { useCallback, useEffect, useRef, useState } from "react";
import { maskCurrencyWhenHidden, useHideAmounts } from "../lib/hide-amounts-preference";
import { rpc } from "../lib/rpc";

export function CompanyImportScope({
  source,
  scope,
  folders,
  onClose,
  onSave,
}: {
  source: CompanyImportCatalogSource;
  scope: Record<string, unknown>;
  folders: { id: string; name: string }[];
  onClose: () => void;
  onSave: (scope: Record<string, unknown>) => void;
}) {
  useHideAmounts();
  const popup = useRef<HTMLDivElement>(null);
  const generic = source.sourceKind === "composio";
  const [toolArgs, setToolArgs] = useState<Record<string, string>>(() => {
    const parsed = CompanyGenericScopeSchema.safeParse(scope);
    return parsed.success
      ? Object.fromEntries(
          parsed.data.tools.map((tool) => [tool.name, JSON.stringify(tool.args, null, 2)]),
        )
      : {};
  });
  const slack =
    source.sourceKind === "slack" ||
    (source.sourceKind === "mcp" && source.defaultScope.reader === "slack");
  const [allPublic, setAllPublic] = useState(scope.channelIds === undefined);
  const [publicIds, setPublicIds] = useState<string[]>(
    Array.isArray(scope.channelIds) ? scope.channelIds : [],
  );
  const [privateIds, setPrivateIds] = useState<string[]>(
    Array.isArray(scope.privateChannelIds) ? scope.privateChannelIds : [],
  );
  const [showPrivate, setShowPrivate] = useState(privateIds.length > 0);
  const [channels, setChannels] = useState<{
    public: CompanyImportChannels;
    private: CompanyImportChannels;
  }>({ public: { channels: [], nextCursor: null }, private: { channels: [], nextCursor: null } });
  const [pendingChannels, setPendingChannels] = useState(0);
  const loadingChannels = pendingChannels > 0;
  const [channelErrors, setChannelErrors] = useState<string[]>([]);
  const channelGeneration = useRef(0);
  const loadChannels = useCallback(
    async (includePrivate: boolean, cursor?: string | null) => {
      const generation = channelGeneration.current;
      const key = includePrivate ? "private" : "public";
      setPendingChannels((count) => count + 1);
      setChannelErrors((errors) => errors.filter((error) => error !== key));
      try {
        const page = await rpc.companyImport.channels({
          sourceKind: source.sourceKind === "mcp" ? "mcp" : "slack",
          connectionId: source.connectionId,
          mcpServerId: source.mcpServerId,
          includePrivate,
          cursor,
        });
        if (channelGeneration.current !== generation) return;
        setChannels((previous) => ({
          ...previous,
          [key]: {
            ...page,
            channels: [
              ...new Map(
                [...(cursor ? previous[key].channels : []), ...page.channels].map((item) => [
                  item.id,
                  item,
                ]),
              ).values(),
            ],
          },
        }));
      } catch {
        if (channelGeneration.current === generation)
          setChannelErrors((errors) => [...new Set([...errors, key])]);
      } finally {
        if (channelGeneration.current === generation)
          setPendingChannels((count) => Math.max(0, count - 1));
      }
    },
    [source.sourceKind, source.connectionId, source.mcpServerId],
  );
  useEffect(() => {
    channelGeneration.current++;
    setPendingChannels(0);
    if (slack) void loadChannels(false);
    return () => {
      channelGeneration.current++;
    };
  }, [slack, loadChannels]);
  useEffect(() => {
    if (slack && showPrivate) void loadChannels(true);
  }, [slack, showPrivate, loadChannels]);
  const [allFolders, setAllFolders] = useState(scope.folderIds === undefined);
  const [selected, setSelected] = useState<string[]>(
    Array.isArray(scope.folderIds) ? scope.folderIds : [],
  );
  const [after, setAfter] = useState(String(scope.after ?? ""));
  const [before, setBefore] = useState(String(scope.before ?? ""));
  const [allTime, setAllTime] = useState(scope.allTime === true);
  const [labels, setLabels] = useState(
    Array.isArray(scope.labelIds) ? scope.labelIds.join(", ") : "",
  );
  const [invalid, setInvalid] = useState(false);
  function save() {
    if (generic) {
      try {
        const parsed = CompanyGenericScopeSchema.safeParse({
          reader: "generic",
          tools: Object.entries(toolArgs).map(([name, args]) => ({ name, args: JSON.parse(args) })),
        });
        if (
          !parsed.success ||
          parsed.data.tools.some(
            (tool) => !source.tools?.some((candidate) => candidate.name === tool.name),
          )
        ) {
          setInvalid(true);
          return;
        }
        onSave(parsed.data);
      } catch {
        setInvalid(true);
      }
      return;
    }
    const result =
      source.sourceKind === "data_room"
        ? CompanyDataRoomScopeSchema.safeParse({
            ...scope,
            folderIds: allFolders ? undefined : selected,
          })
        : slack
          ? CompanySlackScopeSchema.safeParse({
              ...(source.sourceKind === "mcp" ? { reader: "slack" } : {}),
              channelIds: allPublic ? undefined : publicIds,
              privateChannelIds: privateIds,
              allTime,
              ...(!allTime && after ? { after } : {}),
              ...(before ? { before } : {}),
            })
          : CompanyMailScopeSchema.safeParse({
              allTime,
              ...(!allTime && after ? { after } : {}),
              ...(before ? { before } : {}),
              ...(labels.trim()
                ? {
                    labelIds: labels
                      .split(",")
                      .map((label) => label.trim())
                      .filter(Boolean),
                  }
                : {}),
            });
    if (!result.success || (source.sourceKind === "data_room" && !allFolders && !selected.length)) {
      setInvalid(true);
      return;
    }
    onSave(result.data);
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        ref={popup}
        initialFocus={popup}
        tabIndex={-1}
        className="inset-y-0 left-auto right-0 h-full max-h-screen w-full translate-x-0 translate-y-0 content-start overflow-y-auto rounded-none sm:max-w-lg"
      >
        <DialogTitle>
          <Trans>Choose scope</Trans> · {source.label}
        </DialogTitle>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          {generic && (
            <fieldset className="space-y-4">
              <legend className="mb-3 font-medium">
                <Trans>Read tools</Trans>
              </legend>
              {source.tools?.map((tool) => (
                <div key={tool.name} className="space-y-3">
                  <label className="flex items-center gap-3" htmlFor={`company-tool-${tool.name}`}>
                    <Checkbox
                      id={`company-tool-${tool.name}`}
                      checked={toolArgs[tool.name] !== undefined}
                      onCheckedChange={(checked) =>
                        setToolArgs((current) => {
                          const next = { ...current };
                          if (checked) next[tool.name] = "{}";
                          else delete next[tool.name];
                          return next;
                        })
                      }
                    />
                    <span className="break-all">{tool.name}</span>
                  </label>
                  {toolArgs[tool.name] !== undefined && (
                    <div className="space-y-3 ps-7">
                      <p className="text-sm text-muted-foreground">{tool.description}</p>
                      {tool.reportedCost && (
                        <p className="text-sm">
                          {maskCurrencyWhenHidden(tool.reportedCost.description)}
                          {tool.reportedCost.discount
                            ? ` · ${maskCurrencyWhenHidden(tool.reportedCost.discount)}`
                            : ""}
                        </p>
                      )}
                      <label htmlFor={`company-args-${tool.name}`} className="grid gap-2 text-sm">
                        <Trans>Arguments (JSON)</Trans>
                        <Textarea
                          id={`company-args-${tool.name}`}
                          aria-label={t`Arguments for ${tool.name}`}
                          value={toolArgs[tool.name]}
                          onChange={(event) =>
                            setToolArgs((current) => ({
                              ...current,
                              [tool.name]: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <details className="text-sm">
                        <summary className="cursor-pointer">
                          <Trans>Argument schema</Trans>
                        </summary>
                        <pre className="mt-2 overflow-auto whitespace-pre-wrap break-all text-xs text-muted-foreground">
                          {JSON.stringify(tool.inputSchema, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              ))}
            </fieldset>
          )}
          {slack && (
            <fieldset className="space-y-4">
              <legend className="mb-3 font-medium">
                <Trans>Channels</Trans>
              </legend>
              <label htmlFor="company-import-all-public" className="flex items-center gap-3">
                <Checkbox
                  id="company-import-all-public"
                  checked={allPublic}
                  onCheckedChange={setAllPublic}
                />
                <Trans>All public channels</Trans>
              </label>
              {channels.public.channels.map((item) => (
                <label
                  key={item.id}
                  htmlFor={`company-import-public-${item.id}`}
                  className="flex items-center gap-3"
                >
                  <Checkbox
                    id={`company-import-public-${item.id}`}
                    disabled={allPublic}
                    checked={allPublic || publicIds.includes(item.id)}
                    onCheckedChange={(checked) =>
                      setPublicIds((ids) =>
                        checked ? [...ids, item.id] : ids.filter((id) => id !== item.id),
                      )
                    }
                  />
                  #{item.name}
                </label>
              ))}
              {channels.public.nextCursor && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={loadingChannels}
                  onClick={() => void loadChannels(false, channels.public.nextCursor)}
                >
                  <Trans>More channels</Trans>
                </Button>
              )}
              {!showPrivate ? (
                <Button type="button" variant="link" onClick={() => setShowPrivate(true)}>
                  <Trans>Private channels and DMs</Trans>
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium">
                    <Trans>Private channels and DMs</Trans>
                  </p>
                  {channels.private.channels.map((item) => (
                    <label
                      key={item.id}
                      htmlFor={`company-import-private-${item.id}`}
                      className="flex items-center gap-3"
                    >
                      <Checkbox
                        id={`company-import-private-${item.id}`}
                        checked={privateIds.includes(item.id)}
                        onCheckedChange={(checked) =>
                          setPrivateIds((ids) =>
                            checked ? [...ids, item.id] : ids.filter((id) => id !== item.id),
                          )
                        }
                      />
                      {item.direct ? item.name : `#${item.name}`}
                    </label>
                  ))}
                  {channels.private.nextCursor && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={loadingChannels}
                      onClick={() => void loadChannels(true, channels.private.nextCursor)}
                    >
                      <Trans>More private channels</Trans>
                    </Button>
                  )}
                </div>
              )}
              {loadingChannels && (
                <p role="status" className="text-sm text-muted-foreground">
                  <Trans>Loading channels…</Trans>
                </p>
              )}
              {channelErrors.length > 0 && (
                <div className="flex items-center gap-3">
                  <p role="alert" className="text-sm text-destructive">
                    <Trans>Channels unavailable</Trans>
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    disabled={loadingChannels}
                    onClick={() => {
                      for (const kind of channelErrors) void loadChannels(kind === "private");
                    }}
                  >
                    <Trans>Retry</Trans>
                  </Button>
                </div>
              )}
            </fieldset>
          )}
          {!generic &&
            (source.sourceKind === "data_room" ? (
              <fieldset className="space-y-4">
                <legend className="mb-3 font-medium">
                  <Trans>Folders</Trans>
                </legend>
                <div className="flex items-center gap-3">
                  <Checkbox
                    aria-label={t`All folders`}
                    checked={allFolders}
                    onCheckedChange={setAllFolders}
                  />
                  <Trans>All folders</Trans>
                </div>
                {!allFolders &&
                  folders.map((folder) => (
                    <div key={folder.id} className="flex items-center gap-3">
                      <Checkbox
                        aria-label={folder.name}
                        checked={selected.includes(folder.id)}
                        onCheckedChange={(checked) =>
                          setSelected((ids) =>
                            checked ? [...ids, folder.id] : ids.filter((id) => id !== folder.id),
                          )
                        }
                      />
                      {folder.name}
                    </div>
                  ))}
              </fieldset>
            ) : (
              <fieldset className="space-y-4">
                <legend className="mb-3 font-medium">
                  <Trans>Date window</Trans>
                </legend>
                <div className="flex items-center gap-3">
                  <Checkbox
                    aria-label={t`All time`}
                    checked={allTime}
                    onCheckedChange={setAllTime}
                  />
                  <Trans>All time</Trans>
                </div>
                {!allTime && (
                  <label htmlFor="company-import-scope-after" className="grid gap-2">
                    <Trans>From</Trans>
                    <Input
                      id="company-import-scope-after"
                      type="date"
                      value={after}
                      onChange={(e) => setAfter(e.target.value)}
                    />
                  </label>
                )}
                <label htmlFor="company-import-scope-before" className="grid gap-2">
                  <Trans>Before</Trans>
                  <Input
                    id="company-import-scope-before"
                    type="date"
                    value={before}
                    onChange={(e) => setBefore(e.target.value)}
                  />
                </label>
                {!slack && (
                  <label htmlFor="company-import-scope-labels" className="grid gap-2">
                    <Trans>Label IDs</Trans>
                    <Input
                      id="company-import-scope-labels"
                      value={labels}
                      onChange={(e) => setLabels(e.target.value)}
                      placeholder={t`INBOX, SENT`}
                    />
                  </label>
                )}
              </fieldset>
            ))}
          {invalid && (
            <p role="alert" className="text-destructive">
              <Trans>Choose a valid scope</Trans>
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit">
              <Trans>Save</Trans>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
