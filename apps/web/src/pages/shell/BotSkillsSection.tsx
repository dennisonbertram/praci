import { Trans, useLingui } from "@lingui/react/macro";
import type {
  AgentSkill,
  AgentSkillCatalogEntry,
  AgentSkillDraft,
  BotAgentSkill,
} from "@rakazo/contracts";
import { buildSkillMd } from "@rakazo/core";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Skeleton,
  Switch,
  Textarea,
} from "@rakazo/ui-web";
import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { rpc } from "../../lib/rpc";
import { isHiddenBuiltinSkill, slashSkillLabel } from "../../lib/slash-skills";
import { errorText } from "../../lib/user-error";

export function SkillSourceBadge({
  source,
  origin,
}: {
  source: AgentSkillCatalogEntry["source"];
  origin?: AgentSkillCatalogEntry["origin"];
}) {
  if (source === "user" && origin === "agent") {
    return (
      <Badge
        variant="secondary"
        className="rounded-full px-1.5 py-0 text-[11px] font-normal text-muted-foreground"
      >
        <Trans>Agent</Trans>
      </Badge>
    );
  }
  if (source !== "builtin" && source !== "plugin") return null;
  return (
    <Badge
      variant="secondary"
      className="rounded-full px-1.5 py-0 text-[11px] font-normal text-muted-foreground"
    >
      {source === "builtin" ? <Trans>Built-in</Trans> : <Trans>Plugin</Trans>}
    </Badge>
  );
}

/** Display only: the instructions without the leading `---` front matter block. */
function skillBody(content: string) {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, "").trim();
}

const fieldClass = "mt-2 w-full font-mono text-[13px] leading-relaxed";

/**
 * Settings → Skills: every skill this bot can use, with a switch per skill, plus the actions that
 * add one (write, upload a SKILL.md, or fetch one from a link). `refreshKey` reloads the list when
 * the agent creates a skill in chat.
 */
export function BotSkillsSection({
  botId,
  refreshKey = 0,
  onSkillsChange,
}: {
  botId: string;
  refreshKey?: number;
  onSkillsChange: (skills: AgentSkillCatalogEntry[]) => void;
}) {
  const { t } = useLingui();
  const [loading, setLoading] = useState(true);
  const [skills, setSkills] = useState<BotAgentSkill[]>([]);
  const [drafts, setDrafts] = useState<AgentSkillDraft[]>([]);
  const [open, setOpen] = useState<AgentSkill | null>(null);
  const [creating, setCreating] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [draft, setDraft] = useState("");
  // A new skill is written in fields; its SKILL.md front matter is built on save.
  const [skillName, setSkillName] = useState("");
  const [skillDescription, setSkillDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [newId, setNewId] = useState<string | null>(null);
  const knownIds = useRef<Set<string> | null>(null);
  const generation = useRef(0);
  const selection = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const onChange = useRef(onSkillsChange);
  onChange.current = onSkillsChange;

  /** Stores a loaded list and marks a skill that was not there before, so a save is visible. */
  function applyList(list: BotAgentSkill[]) {
    const known = knownIds.current;
    if (known) setNewId(list.find((skill) => !known.has(skill.id))?.id ?? null);
    knownIds.current = new Set(list.map((skill) => skill.id));
    setSkills(list);
  }

  useEffect(() => {
    if (newId)
      document.querySelector(`[data-skill-id="${newId}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [newId]);

  async function refresh() {
    const current = ++generation.current;
    const [list, pending] = await Promise.all([
      rpc.agentSkills.forBot({ botId }),
      rpc.agentSkills.drafts(),
    ]);
    if (current !== generation.current) return;
    applyList(list);
    setDrafts(pending);
    onChange.current(list.filter((skill) => skill.enabled));
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey reloads the list on demand
  useEffect(() => {
    const current = ++generation.current;
    void Promise.all([rpc.agentSkills.forBot({ botId }), rpc.agentSkills.drafts()])
      .then(([list, pending]) => {
        if (current !== generation.current) return;
        applyList(list);
        setDrafts(pending);
        setLoading(false);
        setError(null);
        onChange.current(list.filter((skill) => skill.enabled));
      })
      .catch(() => {
        if (current !== generation.current) return;
        setLoading(false);
        setError(t`Could not load`);
      });
    return () => {
      generation.current += 1;
      selection.current += 1;
    };
  }, [botId, refreshKey, t]);

  function closeEditor() {
    selection.current += 1;
    setOpen(null);
    setCreating(false);
    setUrlOpen(false);
    setConfirmingDelete(false);
    setError(null);
  }

  async function reload() {
    try {
      await refresh();
    } catch {
      setError(t`Could not load`);
    }
  }

  async function toggle(skill: BotAgentSkill, enabled: boolean) {
    setError(null);
    const set = (value: boolean) =>
      setSkills((list) => list.map((s) => (s.id === skill.id ? { ...s, enabled: value } : s)));
    set(enabled);
    try {
      await rpc.agentSkills.setEnabled({ botId, skillKey: skill.id, enabled });
      onChange.current(
        skills.map((s) => (s.id === skill.id ? { ...s, enabled } : s)).filter((s) => s.enabled),
      );
    } catch {
      set(!enabled);
      setError(t`Could not save skill`);
    }
  }

  async function openSkill(entry: BotAgentSkill) {
    if (busy) return;
    const current = ++selection.current;
    setCreating(false);
    setUrlOpen(false);
    setConfirmingDelete(false);
    setError(null);
    try {
      const skill = await rpc.agentSkills.get({ skillId: entry.id });
      // A slower response must not clobber a newer selection or a fresh draft.
      if (current !== selection.current) return;
      setOpen(skill);
      setDraft(skill.content);
    } catch {
      if (current !== selection.current) return;
      setError(t`Could not load skill`);
    }
  }

  /** Runs one write, then closes the editor and reloads the list. */
  async function write(action: () => Promise<unknown>, failure = t`Could not save skill`) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      closeEditor();
      await reload();
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? err.code : undefined;
      setError(
        code === "CONFLICT" ? t`A skill with that name already exists` : errorText(err, failure),
      );
    } finally {
      setBusy(false);
    }
  }

  const decide = (draft: AgentSkillDraft, approve: boolean) =>
    write(
      () =>
        approve
          ? rpc.agentSkills.approveDraft({ skillId: draft.id })
          : rpc.agentSkills.discardDraft({ skillId: draft.id }),
      approve ? t`Could not approve skill` : t`Could not discard skill`,
    );

  const newSkillReady = Boolean(skillName.trim() && skillDescription.trim() && draft.trim());
  const save = () =>
    creating
      ? newSkillReady
        ? write(() =>
            rpc.agentSkills.create({
              content: buildSkillMd({
                name: skillName,
                description: skillDescription,
                body: draft,
              }),
            }),
          )
        : undefined
      : draft.trim() && open
        ? write(() => rpc.agentSkills.update({ skillId: open.id, content: draft }))
        : undefined;

  const importUrl = () =>
    url.trim()
      ? write(async () => {
          await rpc.agentSkills.importFromUrl({ url });
          setUrl("");
        })
      : undefined;

  async function upload(file: File | undefined) {
    if (!file) return;
    await write(async () => rpc.agentSkills.create({ content: await file.text() }));
  }

  async function remove(skill: AgentSkill) {
    if (busy) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    await write(() => rpc.agentSkills.remove({ skillId: skill.id }), t`Could not delete skill`);
  }

  const editorOpen = creating || open;
  const builtins = skills.filter(
    (entry) => entry.source === "builtin" && !isHiddenBuiltinSkill(entry),
  );

  function renderSkill(entry: BotAgentSkill) {
    const label = slashSkillLabel(entry);
    return (
      <div
        key={entry.id}
        data-skill-id={entry.id}
        className={`flex items-center gap-2 rounded-lg ${entry.id === newId ? "bg-accent/60" : ""}`}
      >
        <Button
          variant="ghost"
          type="button"
          disabled={busy}
          onClick={() => void openSkill(entry)}
          className="h-auto min-w-0 flex-1 justify-start whitespace-normal px-2.5 py-2.5 text-start block"
        >
          <span className="flex w-full items-center gap-2">
            <span className="min-w-0 truncate text-[14px] text-foreground" dir="auto">
              {label.title}
            </span>
            {entry.source === "builtin" ? null : (
              <SkillSourceBadge source={entry.source} origin={entry.origin} />
            )}
          </span>
          <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground" dir="auto">
            {label.description}
          </span>
        </Button>
        <Switch
          checked={entry.enabled}
          aria-label={t`Use ${label.title}`}
          onCheckedChange={(checked) => void toggle(entry, checked)}
        />
      </div>
    );
  }
  return (
    <section className="mt-6" data-testid="bot-skills">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[13.5px] font-medium text-foreground">
          <Trans>Skills</Trans>
        </h3>
        {!editorOpen ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={busy}
              render={
                <Button
                  variant="ghost"
                  type="button"
                  className="-me-2.5 px-2.5 text-[13px] text-muted-foreground hover:text-foreground"
                />
              }
            >
              <Trans>Add skill</Trans>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-44">
              <DropdownMenuItem
                onClick={() => {
                  closeEditor();
                  setCreating(true);
                  setDraft("");
                  setSkillName("");
                  setSkillDescription("");
                  setError(null);
                }}
              >
                <Trans>New skill</Trans>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInput.current?.click()}>
                <Trans>Upload SKILL.md</Trans>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  closeEditor();
                  setUrlOpen(true);
                  setError(null);
                }}
              >
                <Trans>From URL</Trans>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".md,text/markdown"
        hidden
        data-testid="bot-skills-upload"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void upload(file);
        }}
      />
      {error ? <div className="px-2.5 py-1 text-[13px] text-destructive">{error}</div> : null}
      {urlOpen ? (
        <div className="mt-2 flex items-center gap-2">
          <Input
            aria-label={t`From URL`}
            value={url}
            disabled={busy}
            placeholder="https://"
            onChange={(event) => setUrl(event.target.value)}
          />
          <Button
            variant="ghost"
            type="button"
            disabled={busy || !url.trim()}
            onClick={() => void importUrl()}
            className="rounded-lg bg-muted px-3 py-1.5 text-[13px] text-foreground disabled:opacity-50"
          >
            {busy ? <Trans>Fetching…</Trans> : <Trans>Save</Trans>}
          </Button>
          <Button
            variant="ghost"
            type="button"
            disabled={busy}
            onClick={closeEditor}
            className="rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground"
          >
            <Trans>Cancel</Trans>
          </Button>
        </div>
      ) : null}
      {loading ? <Skeleton className="h-9 w-full" /> : null}
      {!editorOpen && !urlOpen && drafts.length > 0 ? (
        <div className="mt-2" data-testid="bot-skills-drafts">
          <h4 className="flex items-center gap-1.5 px-2.5 text-[12.5px] text-muted-foreground">
            <Trans>Drafts</Trans>
            <span>{drafts.length}</span>
          </h4>
          {drafts.map((draft) => (
            <details key={draft.id} open className="group px-2.5 py-2">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-[14px] text-foreground">
                <ChevronRight
                  aria-hidden
                  className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90 rtl:-scale-x-100"
                />
                <span className="min-w-0 truncate" dir="auto">
                  {draft.name}
                </span>
                {draft.revision ? (
                  <Badge
                    variant="secondary"
                    className="rounded-full px-1.5 py-0 text-[11px] font-normal text-muted-foreground"
                  >
                    <Trans>Update</Trans>
                  </Badge>
                ) : null}
              </summary>
              <div className="mt-1 text-[12.5px] text-muted-foreground" dir="auto">
                {draft.description}
              </div>
              <pre
                className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-2 font-mono text-[12.5px]"
                dir="auto"
              >
                {skillBody(draft.content)}
              </pre>
              <div className="sticky bottom-0 mt-2 flex items-center gap-2 bg-background py-1.5">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void decide(draft, true)}
                  className="px-3 py-1.5 text-[13px]"
                >
                  <Trans>Approve</Trans>
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  disabled={busy}
                  onClick={() => void decide(draft, false)}
                  className="rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground"
                >
                  <Trans>Discard</Trans>
                </Button>
              </div>
            </details>
          ))}
        </div>
      ) : null}
      {!editorOpen && !urlOpen ? (
        <div data-testid="bot-skills-list">
          {skills.filter((entry) => entry.source !== "builtin").map(renderSkill)}
          {builtins.length > 0 ? (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 text-[13px] text-muted-foreground">
                <ChevronRight
                  aria-hidden
                  className="size-3.5 shrink-0 transition-transform group-open:rotate-90 rtl:-scale-x-100"
                />
                <Trans>Built-in skills ({builtins.length})</Trans>
              </summary>
              {builtins.map(renderSkill)}
            </details>
          ) : null}
        </div>
      ) : null}
      {editorOpen ? (
        <div className="px-2.5 pb-2">
          {open ? (
            <div className="flex items-center gap-2 pb-1">
              <div className="min-w-0 truncate text-[14px] text-foreground" dir="auto">
                {slashSkillLabel(open).title}
              </div>
              <SkillSourceBadge source={open.source} origin={open.origin} />
            </div>
          ) : null}
          {creating ? (
            <>
              <Input
                aria-label={t`Name`}
                placeholder={t`Name`}
                disabled={busy}
                value={skillName}
                maxLength={80}
                autoFocus
                onChange={(event) => setSkillName(event.target.value)}
                className="mt-2"
                dir="auto"
              />
              <Input
                aria-label={t`What it does and when to use it`}
                placeholder={t`What it does and when to use it`}
                disabled={busy}
                value={skillDescription}
                maxLength={2000}
                onChange={(event) => setSkillDescription(event.target.value)}
                className="mt-2"
                dir="auto"
              />
            </>
          ) : null}
          <Textarea
            aria-label={creating ? t`Instructions` : "SKILL.md"}
            placeholder={creating ? t`Steps to follow` : undefined}
            disabled={busy}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={creating ? 6 : Math.min(20, Math.max(8, draft.split("\n").length + 1))}
            readOnly={Boolean(open?.readOnly)}
            className={creating ? "mt-2 w-full" : fieldClass}
            dir="auto"
          />
          <div className="mt-2 flex items-center gap-2">
            {!open?.readOnly ? (
              <Button
                variant="ghost"
                type="button"
                disabled={
                  busy || (creating ? !newSkillReady : !draft.trim() || draft === open?.content)
                }
                onClick={() => void save()}
                className="rounded-lg bg-muted px-3 py-1.5 text-[13px] text-foreground disabled:opacity-50"
              >
                <Trans>Save</Trans>
              </Button>
            ) : null}
            <Button
              variant="ghost"
              type="button"
              disabled={busy}
              onClick={closeEditor}
              className="rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground"
            >
              {open?.readOnly ? <Trans>Close</Trans> : <Trans>Cancel</Trans>}
            </Button>
            {open && !open.readOnly ? (
              <Button
                variant="ghost"
                type="button"
                disabled={busy}
                onClick={() => void remove(open)}
                className={`ms-auto rounded-lg px-3 py-1.5 text-[13px] ${
                  confirmingDelete ? "bg-destructive/10 text-destructive" : "text-destructive"
                }`}
              >
                {confirmingDelete ? <Trans>Confirm delete</Trans> : <Trans>Delete</Trans>}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
