import * as z from "zod";
import { Id } from "./ids.js";

export const MCP_CONNECTION_LABEL_MAX_LENGTH = 80;

const label = z.string().trim().min(1).max(MCP_CONNECTION_LABEL_MAX_LENGTH);

/** One outside client the member connected to a Space: an OAuth client or a personal access token. */
export const McpConnectionSchema = z.object({
  id: Id,
  kind: z.enum(["oauth", "pat"]),
  label: z.string(),
  spaceId: Id,
  spaceName: z.string(),
  readOnly: z.boolean(),
  /** Start of a personal access token, for telling tokens apart; never enough to use it. */
  tokenPrefix: z.string().nullable(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});
export type McpConnection = z.infer<typeof McpConnectionSchema>;

export const McpConnectionListSchema = z.object({
  connections: z.array(McpConnectionSchema),
  /** The member's Spaces, for the Space choice of a new token. */
  spaces: z.array(z.object({ id: Id, name: z.string(), current: z.boolean() })),
  /** Where outside clients reach this server. */
  mcpUrl: z.string(),
});
export type McpConnectionList = z.infer<typeof McpConnectionListSchema>;

export const CreateMcpTokenInput = z.object({
  spaceId: Id,
  label,
  readOnly: z.boolean().default(true),
});
export type CreateMcpTokenInput = z.infer<typeof CreateMcpTokenInput>;

export const UpdateMcpConnectionInput = z.object({
  id: Id,
  readOnly: z.boolean().optional(),
  label: label.optional(),
});
export type UpdateMcpConnectionInput = z.infer<typeof UpdateMcpConnectionInput>;

/** One recorded call: which tool, how it ended and when. Never its arguments or result. */
export const McpActivityCallSchema = z.object({
  tool: z.string(),
  outcome: z.enum(["ok", "error", "rate_limited", "pending", "blocked"]),
  createdAt: z.string(),
});
export type McpActivityCall = z.infer<typeof McpActivityCallSchema>;

/** A change an outside client asked for that waits for the member's answer. */
export const McpPendingActionSchema = z.object({
  id: Id,
  tool: z.string(),
  /** What the client sent; shown so the member knows what they approve. */
  args: z.record(z.string(), z.unknown()),
  connectionLabel: z.string(),
  /** Name of the agent the action targets, when the args name one. */
  botName: z.string().optional(),
  createdAt: z.string(),
});
export type McpPendingAction = z.infer<typeof McpPendingActionSchema>;

export const McpActionDecisionInput = z.object({
  id: Id,
  decision: z.enum(["approve", "deny"]),
  /** With approve: also save an Always allow rule for this tool in the Space. */
  alwaysAllow: z.boolean().optional(),
});
export type McpActionDecisionInput = z.infer<typeof McpActionDecisionInput>;
