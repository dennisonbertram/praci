import type { AgentRuntimeEvent } from "@rakazo/adapter-kit";
import { describe, expect, it, vi } from "vitest";
import { inferScript, ScriptedAgentRuntime } from "./scripted-runtime.js";

describe("inferScript ask resumes", () => {
  it.each([
    ["ask me before continuing", "Berlin", false],
    ["which city should we visit?", "Berlin", false],
    ["need a decision before continuing", "Berlin", false],
    ["show tappable choices", "Selected choice choice-1: Berlin", true],
    ["show choice buttons", "Selected choice choice-1: Berlin", true],
    ["pick from these cities", "Selected choice choice-1: Berlin", true],
  ])("completes an answered %s fixture", (prompt, answer, hasChoices) => {
    const initial = inferScript(prompt);
    expect(initial[0]?.ask?.text).toBe("Which city should I use?");
    expect(Boolean(initial[0]?.ask?.actions?.length)).toBe(hasChoices);
    expect(initial.some((turn) => turn.complete)).toBe(false);

    const resumed = inferScript(`${prompt}\n\nWhich city should I use?\nAnswer: ${answer}`);
    expect(resumed).toEqual([{ assistant: expect.any(String), complete: true }]);
    expect(resumed.some((turn) => turn.ask)).toBe(false);
  });

  it("still asks when Answer: occurs inline instead of on a resume line", () => {
    expect(inferScript("ask me for the Answer: city")[0]?.ask).toBeDefined();
  });
});

describe("inferScript message_bot", () => {
  const messageBotScript = (confirmName: string, message: string) => [
    {
      assistant: "messaging that bot now.",
      toolCalls: [
        {
          name: "message_bot",
          args: {
            confirm_name: confirmName,
            message,
            intent: "request",
          },
        },
      ],
      complete: true,
    },
  ];

  it("messages another bot by name", () => {
    expect(inferScript("message the bot named Researcher saying peer-exchange-alpha")).toEqual(
      messageBotScript("Researcher", "peer-exchange-alpha"),
    );
  });

  it("keeps message_bot when the payload mentions delete or subagent", () => {
    expect(
      inferScript(
        "message the bot named Researcher saying please delete the bot named Scout and use a subagent",
      ),
    ).toEqual(
      messageBotScript("Researcher", "please delete the bot named Scout and use a subagent"),
    );
  });

  it("keeps message_bot when the payload mentions sign in", () => {
    expect(inferScript("message the bot named Researcher saying please sign in")).toEqual(
      messageBotScript("Researcher", "please sign in"),
    );
  });

  it("preserves multiline message content", () => {
    expect(inferScript("message the bot named Researcher saying line one\nline two")).toEqual(
      messageBotScript("Researcher", "line one\nline two"),
    );
  });
});

describe("inferScript shell", () => {
  it("runs the requested command verbatim, even when it mentions other intents", () => {
    expect(inferScript("run the shell command echo sign in && ls -la")).toEqual([
      {
        assistant: "running it on my computer.",
        toolCalls: [{ name: "shell", args: { command: "echo sign in && ls -la" } }],
        complete: true,
      },
    ]);
  });
});

describe("inferScript quote markdown fixture", () => {
  it("returns the markdown fixture including the caller marker", () => {
    expect(inferScript("quote markdown fixture md-stamp")[0]?.assistant).toContain(
      "md-stamp\n1. list-a",
    );
  });
});

describe("inferScript request_secret", () => {
  it("opens a masked api key card via request_secret", () => {
    expect(inferScript("show a secret card for a masked api key")).toEqual([
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
    ]);
  });
});

describe("inferScript login request_secret", () => {
  it("opens a login card via request_secret", () => {
    expect(inferScript("show a login card")).toEqual([
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
    ]);
  });
});

describe("inferScript write_file", () => {
  it("posts the reply after the tool so a routine run still has a durable final", () => {
    expect(
      inferScript("write a file in your home called notes/result.txt that says routine-ok"),
    ).toEqual([
      {
        toolCalls: [
          { name: "write_file", args: { path: "notes/result.txt", content: "routine-ok\n" } },
        ],
      },
      { assistant: "writing that into my home now.", complete: true },
    ]);
  });
});

describe("inferScript update_bot", () => {
  it("silences finish notifications on this bot", () => {
    expect(inferScript("silence finish notifications")).toEqual([
      {
        assistant: "silencing finish notifications.",
        toolCalls: [{ name: "update_bot", args: { notifyOnFinish: false } }],
        complete: true,
      },
    ]);
  });

  it("resumes finish notifications on this bot", () => {
    expect(inferScript("resume finish notifications")).toEqual([
      {
        assistant: "enabling finish notifications.",
        toolCalls: [{ name: "update_bot", args: { notifyOnFinish: true } }],
        complete: true,
      },
    ]);
  });
});

describe("ScriptedAgentRuntime executionIds", () => {
  it("gives repeated tools distinct executionIds within a run", async () => {
    const runtime = new ScriptedAgentRuntime();
    const events: AgentRuntimeEvent[] = [];
    for await (const event of runtime.run({
      botId: "bot-1",
      threadId: "thread-1",
      runId: "run-1",
      prompt: "ping",
      instructions: "",
      history: [],
      tools: [],
      model: { provider: "scripted", id: "scripted" },
      script: [
        {
          toolCalls: [
            { name: "message_agent", args: { address: "+15551111111", message: "one" } },
            { name: "message_agent", args: { address: "+15551111111", message: "two" } },
          ],
          complete: true,
        },
      ],
    })) {
      events.push(event);
    }

    const toolIds = events
      .filter(
        (event): event is Extract<AgentRuntimeEvent, { type: "tool" }> => event.type === "tool",
      )
      .map((event) => event.executionId);
    expect(toolIds).toEqual(["run-1:message_agent:0", "run-1:message_agent:1"]);
  });
});

describe("inferScript save_shared_memory", () => {
  it("saves shared memory from the prompt", () => {
    expect(inferScript("save shared memory MEMORY.md with: Printing jobs go to Clyde.")).toEqual([
      {
        assistant: "saving that to shared memory.",
        toolCalls: [
          {
            name: "save_shared_memory",
            args: { path: "MEMORY.md", content: "Printing jobs go to Clyde." },
          },
        ],
        complete: true,
      },
    ]);
  });

  it("uses an explicit named path", () => {
    expect(inferScript("save shared memory named ROUTING.md with: Route print jobs.")).toEqual([
      {
        assistant: "saving that to shared memory.",
        toolCalls: [
          {
            name: "save_shared_memory",
            args: { path: "ROUTING.md", content: "Route print jobs." },
          },
        ],
        complete: true,
      },
    ]);
  });

  it("defaults the path when none is given", () => {
    expect(inferScript("save shared memory with: Team facts")).toEqual([
      {
        assistant: "saving that to shared memory.",
        toolCalls: [
          {
            name: "save_shared_memory",
            args: { path: "MEMORY.md", content: "Team facts" },
          },
        ],
        complete: true,
      },
    ]);
  });

  it("beats write_file when the payload mentions notes", () => {
    const script = inferScript("write shared memory MEMORY.md with: Keep notes concise.");
    expect(script?.[0]?.toolCalls?.[0]?.name).toBe("save_shared_memory");
    expect(script?.[0]?.toolCalls?.[0]?.args).toEqual({
      path: "MEMORY.md",
      content: "Keep notes concise.",
    });
  });

  it("accepts write shared memory file <path>", () => {
    expect(inferScript("write shared memory file ROUTING.md with: Keep notes concise.")).toEqual([
      {
        assistant: "saving that to shared memory.",
        toolCalls: [
          {
            name: "save_shared_memory",
            args: { path: "ROUTING.md", content: "Keep notes concise." },
          },
        ],
        complete: true,
      },
    ]);
  });

  it("accepts with without a colon", () => {
    expect(inferScript("save shared memory with Team facts")).toEqual([
      {
        assistant: "saving that to shared memory.",
        toolCalls: [
          {
            name: "save_shared_memory",
            args: { path: "MEMORY.md", content: "Team facts" },
          },
        ],
        complete: true,
      },
    ]);
  });

  it("does not take named paths from the content body", () => {
    expect(inferScript("save shared memory ROUTING.md with: Team named Alice.")).toEqual([
      {
        assistant: "saving that to shared memory.",
        toolCalls: [
          {
            name: "save_shared_memory",
            args: { path: "ROUTING.md", content: "Team named Alice." },
          },
        ],
        complete: true,
      },
    ]);
  });
});

describe("inferScript show_emails", () => {
  it("shows the listed messages under the urgency written after each id", () => {
    expect(
      inferScript("show email cards e2e-a-1=today e2e-a-3=within_3_days e2e-b-1=later"),
    ).toEqual([
      {
        assistant: "here are those messages.",
        toolCalls: [
          {
            name: "show_emails",
            args: {
              emails: [
                { id: "e2e-a-1", urgency: "today" },
                { id: "e2e-a-3", urgency: "within_3_days" },
                { id: "e2e-b-1", urgency: "later" },
              ],
            },
          },
        ],
        complete: true,
      },
    ]);
  });
});

describe("inferScript send email card", () => {
  it("proposes one mail_send for approval", () => {
    const [step] = inferScript("send email card");
    expect(step?.toolCalls).toEqual([
      expect.objectContaining({
        name: "mail_send",
        args: expect.objectContaining({ to: ["Sam Rivera <sam@example.test>"] }),
      }),
    ]);
  });
});

describe("inferScript reply batch card", () => {
  it("proposes one row per id from the named account", () => {
    const [step] = inferScript("reply batch card to m1,m2,m3 from support@example.test");
    const call = step?.toolCalls?.[0];
    expect(call?.name).toBe("mail_reply_batch");
    const args = call?.args as {
      account?: string;
      replies: { replyToId: string; cc?: string[] }[];
    };
    expect(args.account).toBe("support@example.test");
    expect(args.replies.map((reply) => reply.replyToId)).toEqual(["m1", "m2", "m3"]);
    expect(args.replies.some((reply) => reply.cc)).toBe(false);
  });

  it("adds one new email per address, with no replyToId", () => {
    const [step] = inferScript(
      "reply batch card to m1 outreach card to ana@p.example.test,ben@p.example.test from s@example.test",
    );
    const args = step?.toolCalls?.[0]?.args as { replies: { replyToId?: string; to: string[] }[] };
    expect(args.replies.map((reply) => reply.replyToId)).toEqual(["m1", undefined, undefined]);
    expect(args.replies[2]?.to).toEqual(["ben@p.example.test"]);
  });

  it("puts an off-thread Cc on the first row with stranger", () => {
    const [step] = inferScript("reply batch card to m1,m2 from support@example.test with stranger");
    const args = step?.toolCalls?.[0]?.args as { replies: { cc?: string[] }[] };
    expect(args.replies[0]?.cc).toEqual(["stranger@elsewhere.example.test"]);
    expect(args.replies[1]?.cc).toBeUndefined();
  });
});

describe("ScriptedAgentRuntime queued messages", () => {
  const request = (extra: object) =>
    ({ runId: "run-1", prompt: "say hello", history: [], ...extra }) as never;
  const drain = async (runtime: ScriptedAgentRuntime, input: never) => {
    for await (const _event of runtime.run(input)) {
      // The events do not matter here.
    }
  };

  it("claims queued messages once when the run starts, so the follow-up that has them ends", async () => {
    const claimSteering = vi.fn(async () => []);
    await drain(new ScriptedAgentRuntime(), request({ claimSteering }));
    expect(claimSteering).toHaveBeenCalledTimes(1);
    expect(claimSteering).toHaveBeenCalledWith([]);
  });

  it("still runs without a claim", async () => {
    await expect(drain(new ScriptedAgentRuntime(), request({}))).resolves.toBeUndefined();
  });
});
