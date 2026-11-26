# Bot-built tools

A tool is a skill (`AgentSkill`) that also carries one self-contained JavaScript source and an input schema. A bot writes it to repeat a computation the same way each time: it gathers data with its normal read tools, then calls `tool_run` with that data. A tool is a pure function. It cannot read data or have side effects.

## Creating and approving

- `skill_create` and `skill_update` accept `toolSource` (up to 64 KB, defining `function run(input)`), `toolInputSchema` (a small JSON Schema subset) and the plain lines `reads` and `writes` with `sampleInput` and `sampleOutput`.
- A new tool is saved as a draft. The bot test-runs a draft with `tool_run` on sample input; drafts run only in runs the owner is in.
- The draft appears under **Drafts** in the bot's **Skills** section with **Reads:**, **Writes:**, the sample input and output, and the **Code**. **Approve** records `toolSourceHash`, the sha256 of the approved source. **Discard** removes it.
- A change to an approved tool is stored as `pendingTool` and shown as an **Update** draft. The approved source keeps running until the owner approves the change.

## Running

`tool_run(name, input)` validates `input` against the schema, recomputes the hash of the stored source and refuses to run if it differs from the approved hash, then runs the source in a QuickJS WebAssembly interpreter inside the worker. The interpreter has no file system, network, timers, environment, `import` or `require`. Limits: 2 seconds, 32 MB of memory, 256 KB of output. The stored source is the only code that runs.

Because an approved tool has no side effects and no outside access, `tool_run` is on the list of tools that run without asking in background runs. Its output enters the model's context like any other tool result. `task_catalog` lists approved tools with their input schemas. Tools are scoped like skills, to the space and the user.

Tools that call connectors, and copying a tool to another bot, are not supported.

See `docs/unattended-bots/PRD.md`, section 4.5, and `packages/adapters/src/tool-runner.ts`.
