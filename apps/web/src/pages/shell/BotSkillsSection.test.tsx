// @vitest-environment jsdom

import type { BotAgentSkill } from "@rakazo/contracts";
import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  forBot: vi.fn(),
  setEnabled: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  importFromUrl: vi.fn(),
  drafts: vi.fn(),
  approveDraft: vi.fn(),
  discardDraft: vi.fn(),
}));
vi.mock("../../lib/rpc", () => ({ rpc: { agentSkills: api } }));
vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, index) => text + part + (values[index] ?? ""), "");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
});
vi.mock("@rakazo/ui-web", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Button: ({ variant, ...props }: ComponentProps<"button"> & { variant?: string }) => (
      <button data-variant={variant ?? "default"} {...props} />
    ),
    Input: (props: ComponentProps<"input">) => <input {...props} />,
    Textarea: (props: ComponentProps<"textarea">) => <textarea {...props} />,
    Skeleton: Container,
    Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    Switch: ({
      checked,
      onCheckedChange,
      ...props
    }: {
      checked: boolean;
      onCheckedChange: (value: boolean) => void;
    } & ComponentProps<"input">) => (
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        {...props}
      />
    ),
    DropdownMenu: Container,
    DropdownMenuContent: Container,
    DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    DropdownMenuItem: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
      <button type="button" onClick={onClick}>
        {children}
      </button>
    ),
  };
});

import { BotSkillsSection } from "./BotSkillsSection";

const skill = (
  id: string,
  name: string,
  source: BotAgentSkill["source"],
  enabled = true,
): BotAgentSkill => ({
  id,
  name,
  description: `${name} description`,
  source,
  origin: "user",
  readOnly: source !== "user",
  enabled,
});

let catalog: BotAgentSkill[];
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  for (const fn of Object.values(api)) fn.mockReset();
  catalog = [
    skill("builtin:Interrogate", "Interrogate", "builtin"),
    skill("user-1", "greeting", "user", false),
  ];
  api.forBot.mockImplementation(async () => catalog);
  api.drafts.mockResolvedValue([]);
  api.get.mockImplementation(async ({ skillId }: { skillId: string }) => {
    const entry = catalog.find((s) => s.id === skillId);
    return { ...entry, content: "Steps", createdAt: "", updatedAt: "" };
  });
});

async function mount(onSkillsChange = vi.fn(), refreshKey = 0) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = (key: number) =>
    act(async () =>
      root.render(
        <BotSkillsSection botId="bot-1" refreshKey={key} onSkillsChange={onSkillsChange} />,
      ),
    );
  await render(refreshKey);
  const button = (text: string) => {
    const found = [...container.querySelectorAll("button")].find((entry) =>
      entry.textContent?.includes(text),
    );
    if (!found) throw new Error(`Missing button: ${text}`);
    return found;
  };
  const toggle = (name: string) =>
    container.querySelector<HTMLInputElement>(`[aria-label="Use ${name}"]`) as HTMLInputElement;
  return { container, button, toggle, render, unmount: () => act(async () => root.unmount()) };
}

it("lists skills with a source badge only for non-user skills and a switch each", async () => {
  const onSkillsChange = vi.fn();
  const view = await mount(onSkillsChange);
  expect(api.forBot).toHaveBeenCalledWith({ botId: "bot-1" });
  expect(view.button("Interrogate").textContent).toContain("Built-in");
  expect(view.button("greeting").textContent).not.toContain("Built-in");
  expect(view.toggle("Interrogate").checked).toBe(true);
  expect(view.toggle("greeting").checked).toBe(false);
  // Only skills switched on reach the slash menu.
  expect(onSkillsChange).toHaveBeenLastCalledWith([
    expect.objectContaining({ id: "builtin:Interrogate" }),
  ]);
  await view.unmount();
});

it("saves the switch and puts it back when saving fails", async () => {
  api.setEnabled.mockResolvedValueOnce({ ok: true });
  const view = await mount();
  await act(async () => view.toggle("greeting").click());
  expect(api.setEnabled).toHaveBeenCalledWith({
    botId: "bot-1",
    skillKey: "user-1",
    enabled: true,
  });
  expect(view.toggle("greeting").checked).toBe(true);
  api.setEnabled.mockRejectedValueOnce(new Error("offline"));
  await act(async () => view.toggle("Interrogate").click());
  expect(view.toggle("Interrogate").checked).toBe(true);
  expect(view.container.textContent).toContain("Could not save skill");
  await view.unmount();
});

it("opens built-ins read-only and user skills for editing", async () => {
  const view = await mount();
  await act(async () => view.button("Interrogate").click());
  expect(view.container.querySelector("textarea")?.readOnly).toBe(true);
  expect(view.container.textContent).not.toContain("Delete");
  await act(async () => view.button("Close").click());
  await act(async () => view.button("greeting").click());
  expect(view.container.querySelector("textarea")?.readOnly).toBe(false);
  expect(view.button("Delete")).toBeTruthy();
  await view.unmount();
});

function typeInto(el: HTMLTextAreaElement | HTMLInputElement | null, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  const setValue = Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set;
  return act(async () => {
    setValue?.call(el, value);
    el?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const SKILL_MD = "---\nname: my-skill\ndescription: Does a thing.\n---\n\nSteps.\n";

it("starts New skill empty with the template as a placeholder and cannot save it untouched", async () => {
  const view = await mount();
  await act(async () => view.button("New skill").click());
  const area = view.container.querySelector("textarea");
  expect(area?.value).toBe("");
  expect(area?.placeholder).toContain("name: my-skill");
  expect((view.button("Save") as HTMLButtonElement).disabled).toBe(true);
  // The template text pasted back in is still not a skill.
  await typeInto(area ?? null, area?.placeholder ?? "");
  expect((view.button("Save") as HTMLButtonElement).disabled).toBe(true);
  await typeInto(area ?? null, SKILL_MD);
  expect((view.button("Save") as HTMLButtonElement).disabled).toBe(false);
  await view.unmount();
});

it("creates a skill from New skill and shows it in the list", async () => {
  api.create.mockResolvedValue({});
  const view = await mount();
  await act(async () => view.button("New skill").click());
  await typeInto(view.container.querySelector("textarea"), SKILL_MD);
  await act(async () => view.button("Save").click());
  expect(api.create).toHaveBeenCalledWith({ content: SKILL_MD });
  catalog = [...catalog, skill("user-2", "my-skill", "user")];
  await view.render(0);
  await act(async () => undefined);
  expect(api.forBot).toHaveBeenCalledTimes(2);
  await view.unmount();
});

it("shows the server's reason when a skill cannot be saved, and clears it on retry and Cancel", async () => {
  const view = await mount();
  await act(async () => view.button("New skill").click());
  await typeInto(view.container.querySelector("textarea"), SKILL_MD);
  api.create.mockRejectedValueOnce(new Error("Skill front matter needs a name."));
  await act(async () => view.button("Save").click());
  expect(view.container.textContent).toContain("Skill front matter needs a name.");
  expect(view.container.textContent).not.toContain("Could not save skill");
  api.create.mockRejectedValueOnce(Object.assign(new Error("Conflict"), { code: "CONFLICT" }));
  await act(async () => view.button("Save").click());
  expect(view.container.textContent).toContain("A skill with that name already exists");
  expect(view.container.textContent).not.toContain("needs a name");
  api.create.mockRejectedValueOnce(new Error("rpc agentSkills.create failed (500)"));
  await act(async () => view.button("Save").click());
  expect(view.container.textContent).toContain("Could not save skill");
  await act(async () => view.button("Cancel").click());
  expect(view.container.textContent).not.toContain("Could not save skill");
  await view.unmount();
});

it("caps the skills list height so it scrolls on its own", async () => {
  const view = await mount();
  expect(view.container.querySelector("[data-testid=bot-skills-list]")?.className).toContain(
    "overflow-y-auto",
  );
  await view.unmount();
});

it("uploads a SKILL.md file as the skill content", async () => {
  api.create.mockResolvedValue({});
  const view = await mount();
  const input = view.container.querySelector<HTMLInputElement>("[data-testid=bot-skills-upload]");
  const file = new File(["---\nname: up\ndescription: d\n---\nBody"], "SKILL.md");
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => {
    input?.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(api.create).toHaveBeenCalledWith({ content: "---\nname: up\ndescription: d\n---\nBody" });
  await view.unmount();
});

it("imports a skill from a URL", async () => {
  api.importFromUrl.mockResolvedValue({});
  const view = await mount();
  await act(async () => view.button("From URL").click());
  const input = view.container.querySelector<HTMLInputElement>("[aria-label='From URL']");
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setValue?.call(input, "https://github.com/acme/skills/blob/main/SKILL.md");
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => view.button("Save").click());
  expect(api.importFromUrl).toHaveBeenCalledWith({
    url: "https://github.com/acme/skills/blob/main/SKILL.md",
  });
  await view.unmount();
});

it("reloads when the refresh key changes", async () => {
  const view = await mount();
  catalog = [...catalog, skill("user-3", "agent-made", "user")];
  await view.render(1);
  expect(api.forBot).toHaveBeenCalledTimes(2);
  expect(view.button("agent-made")).toBeTruthy();
  await view.unmount();
});

const draftSkill = {
  id: "draft-1",
  name: "weekly-report",
  description: "Summarise the week.",
  content: "---\nname: weekly-report\ndescription: Summarise the week.\n---\n\nSteps.\n",
  revision: false,
};

it("shows agent drafts with their content and approves one", async () => {
  api.drafts.mockResolvedValueOnce([draftSkill]).mockResolvedValue([]);
  api.approveDraft.mockResolvedValue({});
  const view = await mount();
  const drafts = view.container.querySelector('[data-testid="bot-skills-drafts"]');
  expect(drafts?.textContent).toContain("weekly-report");
  expect(drafts?.textContent).toContain("Steps.");
  await act(async () => view.button("Approve").click());
  expect(api.approveDraft).toHaveBeenCalledWith({ skillId: "draft-1" });
  expect(view.container.querySelector('[data-testid="bot-skills-drafts"]')).toBeNull();
});

it("opens a draft by default with a count, one description and a primary Approve", async () => {
  api.drafts.mockResolvedValueOnce([draftSkill]).mockResolvedValue([]);
  const view = await mount();
  const drafts = view.container.querySelector('[data-testid="bot-skills-drafts"]');
  expect(drafts?.querySelector("details")?.hasAttribute("open")).toBe(true);
  expect(drafts?.querySelector("h4")?.textContent).toBe("Drafts1");
  expect(drafts?.querySelector("summary svg")).toBeTruthy();
  expect(view.button("Approve").getAttribute("data-variant")).toBe("default");
  expect(view.button("Discard").getAttribute("data-variant")).toBe("ghost");
  expect(drafts?.textContent?.split("Summarise the week.").length).toBe(2);
  expect(drafts?.textContent).toContain("Steps.");
  expect(drafts?.textContent).not.toContain("---");
  await view.unmount();
});

it("discards a draft and marks a revision of an active skill", async () => {
  api.drafts.mockResolvedValueOnce([{ ...draftSkill, revision: true }]).mockResolvedValue([]);
  api.discardDraft.mockResolvedValue({ ok: true });
  const view = await mount();
  expect(view.container.querySelector('[data-testid="bot-skills-drafts"]')?.textContent).toContain(
    "Update",
  );
  await act(async () => view.button("Discard").click());
  expect(api.discardDraft).toHaveBeenCalledWith({ skillId: "draft-1" });
});

it("badges only agent-written skills", async () => {
  catalog = [
    { ...skill("a-1", "from-agent", "user"), origin: "agent" },
    skill("u-1", "mine", "user"),
  ];
  const view = await mount();
  expect(view.button("from-agent").textContent).toContain("Agent");
  expect(view.button("mine").textContent).not.toContain("Agent");
});
