import * as z from "zod";

/** Built-in tool names a bot may disable. Kept aligned with the adapter tool list. */
export const BUILTIN_TOOL_NAMES = [
  "computer_observe",
  "computer_act",
  "browser_navigate",
  "browser_snapshot",
  "browser_act",
  "list_files",
  "read_file",
  "write_file",
  "attach_file",
  "shell",
  "open_path",
  "launch_app",
  "request_takeover",
  "ask_user",
  "message_user",
  "request_secret",
  "list_secrets",
  "secret_request",
  "forget_secret",
  "render_plot",
  "page_read",
  "page_write",
  "page_edit",
  "pins_read",
  "pins_write",
  "add_mcp_server",
  "remember",
  "save_shared_memory",
  "web_search",
  "web_fetch",
  "mail_search",
  "mail_grep",
  "mail_get",
  "show_emails",
  "inbox_overview",
  "mail_draft",
  "mail_modify",
  "mail_send",
  "calendar_list_events",
  "calendar_get_event",
  "calendar_create_event",
  "calendar_update_event",
  "calendar_delete_event",
  "finance_overview",
  "finance_breakdown",
  "finance_transactions",
  "finance_recurring",
  "finance_crypto",
  "legal_unreviewed_documents",
  "legal_upsert_contract",
  "legal_upsert_deadline",
  "legal_upsert_node",
  "legal_link",
  "legal_query",
  "contacts_list",
  "contacts_save",
  "drive_search",
  "drive_read",
  "drive_create_file",
  "drive_update_file",
  "search_data_room",
  "read_data_room_item",
  "add_to_data_room",
  "cloud_agent_launch",
  "cloud_agent_status",
  "cloud_agent_reply",
  "cloud_agent_cancel",
  "search_history",
  "read_history",
  "save_memory",
  "recall_memory",
  "forget_memory",
  "task_catalog",
  "scratchpad_list",
  "scratchpad_add",
  "scratchpad_update",
  "scratchpad_complete",
  "scratchpad_remove",
  "board_tickets",
  "ticket_get",
  "ticket_create",
  "ticket_update",
  "ticket_comment",
  "schedule_create",
  "schedule_list",
  "schedule_cancel",
  "end_call",
  "skill_read",
  "skill_create",
  "skill_update",
  "skill_delete",
  "run_subagent",
  "create_space",
  "spawn_bot",
  "update_bot",
  "archive_bot",
  "message_bot",
  "handoff_to_bot",
  "connect_agent",
  "respond_agent_connection",
  "message_agent",
] as const;

export const BuiltinToolNameSchema = z.enum(BUILTIN_TOOL_NAMES);
export type BuiltinToolName = z.infer<typeof BuiltinToolNameSchema>;

const builtinToolNameSet: ReadonlySet<string> = new Set(BUILTIN_TOOL_NAMES);

export function isBuiltinToolName(name: string): name is BuiltinToolName {
  return builtinToolNameSet.has(name);
}

export function disabledBuiltinToolSet(names: readonly string[] | undefined): Set<string> {
  const disabled = new Set<string>();
  if (!names) return disabled;
  for (const raw of names) {
    const name = raw.trim();
    if (isBuiltinToolName(name)) disabled.add(name);
  }
  return disabled;
}

export const DisabledBuiltinToolsSchema = z
  .array(z.string().trim().min(1).max(64))
  .max(BUILTIN_TOOL_NAMES.length)
  .superRefine((names, ctx) => {
    names.forEach((name, index) => {
      if (!isBuiltinToolName(name)) {
        ctx.addIssue({
          code: "custom",
          message: `Unknown built-in tool: ${name}`,
          path: [index],
        });
      }
    });
  })
  .transform((names) => [...new Set(names)]);
