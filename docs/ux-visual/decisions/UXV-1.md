# UXV-1 Raw tool names reach the interface — decision

Chosen: one shared function turns a tool id into a plain label, used everywhere a tool name is shown (working label, approval title, sidebar preview). It strips any `mcp__<server>__` or connector prefix, splits camelCase and snake_case, and sentence-cases the result: `mcp__finance-mercury__getAccounts` → "Get accounts", `requestSendMoney` → "Request send money". Where a built-in tool already has a hand-written label, that wins.

Rejected: a hand-written label table per MCP tool (doesn't scale to arbitrary MCP servers); hiding the tool name entirely (the user loses what the agent is doing).

Acceptance: no visible label, title or preview contains `mcp__`, `__`, or a camelCase id; unit test over MCP, connector and built-in names; the approval title and working label in a Mercury chat read as plain words (screenshot).
