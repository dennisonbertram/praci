import type { ConnectorTool } from "@rakazo/adapter-kit";

export const WRAPPER_NAME =
  /(?:execute|multi|batch|router|proxy|api_call|generic_api|tool_call|search[_-]?(?:tools|catalog)|list[_-]?tools|control|\bapi\b|\bhttp\b|request)/i;
export const WRAPPER_NAME_PARTS = new Set([
  "api",
  "batch",
  "catalog",
  "control",
  "http",
  "multi",
  "proxy",
  "request",
  "router",
  "tool",
  "tools",
]);
export const SAFE_NAME_VERBS = new Set([
  "list",
  "get",
  "fetch",
  "retrieve",
  "read",
  "search",
  "find",
  "lookup",
  "describe",
  "inspect",
  "query",
  "count",
  "check",
  "download",
  "view",
  "show",
]);
export const WRITE_NAME_VERBS = new Set([
  "accept",
  "add",
  "archive",
  "assign",
  "approve",
  "buy",
  "cancel",
  "charge",
  "checkout",
  "close",
  "commit",
  "connect",
  "copy",
  "create",
  "delete",
  "deploy",
  "disable",
  "deny",
  "disconnect",
  "edit",
  "enable",
  "execute",
  "forward",
  "grant",
  "insert",
  "invite",
  "join",
  "link",
  "mark",
  "merge",
  "modify",
  "move",
  "open",
  "patch",
  "pay",
  "post",
  "publish",
  "purchase",
  "put",
  "register",
  "react",
  "reject",
  "remove",
  "rename",
  "replace",
  "reply",
  "reset",
  "revoke",
  "run",
  "schedule",
  "send",
  "set",
  "share",
  "start",
  "stop",
  "submit",
  "subscribe",
  "trigger",
  "unassign",
  "unlink",
  "unsubscribe",
  "update",
  "upload",
  "write",
  "upsert",
]);
export const COMPANY_NOTION_READ_TOOLS = [
  "NOTION_SEARCH_NOTION_PAGE",
  "NOTION_RETRIEVE_PAGE",
  "NOTION_FETCH_BLOCK_CONTENTS",
] as const;

export function toolNameTokens(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function isCompanyGenericReadTool(tool: ConnectorTool) {
  const tokens = toolNameTokens(tool.name);
  return (
    tool.route?.connectorId === "composio" &&
    tool.readOnly === true &&
    tool.route.discoveredReadOnly !== false &&
    !WRAPPER_NAME.test(tool.name) &&
    !tokens.some(
      (token) =>
        WRAPPER_NAME_PARTS.has(token) ||
        WRITE_NAME_VERBS.has(token) ||
        ["and", "or", "then"].includes(token),
    )
  );
}
