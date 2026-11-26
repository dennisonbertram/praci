/**
 * Risk profile of a built-in tool: what it changes, whether that can be put back, and whether it
 * moves money or reaches people. One table, read by the approval classifier. A profile describes
 * the tool; the decision to ask is still made by action-approval.ts and the hard lines.
 */
export type ToolEffect = "read" | "internal_write" | "outside_write";

export type ToolRiskProfile = {
  /** read: changes nothing. internal_write: Rakazo's own records. outside_write: leaves Rakazo. */
  effect: ToolEffect;
  /** The change can be put back by the owner or by an inverse call. */
  reversible: boolean;
  /** Moves money or spends capacity (hard line H1). */
  money: boolean;
  /** Sends to people, so recipients decide the risk (hard line H2). */
  recipients: boolean;
};

const read: ToolRiskProfile = { effect: "read", reversible: true, money: false, recipients: false };
const own = (reversible: boolean): ToolRiskProfile => ({
  effect: "internal_write",
  reversible,
  money: false,
  recipients: false,
});
const outside = (reversible: boolean, recipients = false): ToolRiskProfile => ({
  effect: "outside_write",
  reversible,
  money: false,
  recipients,
});

/** Built-in tools that no approval set lists. Tools with their own approval class are not repeated. */
export const BUILTIN_TOOL_RISK: Readonly<Record<string, ToolRiskProfile>> = {
  // Reads that were filed as writes.
  list_secrets: read,
  recall_memory: read,
  scratchpad_list: read,
  skill_read: read,
  company_context_lookup: read,
  // Show or say something to the owner in their own thread.
  attach_file: own(true),
  show_image: own(true),
  render_plot: own(true),
  render_ui: own(true),
  create_ui_artifact: own(true),
  ask_user: own(true),
  message_user: own(true),
  notify_user: own(true),
  end_call: own(true),
  // The owner's own pages, pins, sheets, notes and tickets.
  page_create: own(true),
  page_write: own(false),
  page_edit: own(false),
  page_source_set: own(true),
  page_source_remove: own(true),
  pins_write: own(true),
  create_spreadsheet: own(true),
  scratchpad_add: own(true),
  scratchpad_update: own(false),
  scratchpad_complete: own(true),
  scratchpad_remove: own(false),
  ticket_create: own(true),
  ticket_update: own(false),
  ticket_comment: own(true),
  contacts_add: own(true),
  // Records that stay inside the space.
  legal_upsert_contract: own(false),
  legal_upsert_deadline: own(false),
  legal_upsert_node: own(false),
  legal_link: own(true),
  investor_update_draft: own(true),
  audit_request_upsert: own(false),
  pipeline_import_stage: own(false),
  cap_table_update: own(false),
  update_scan: own(false),
  // Memory and behaviour that persist into later runs.
  save_memory: own(true),
  save_shared_memory: own(true),
  skill_create: own(true),
  skill_update: own(false),
  skill_delete: own(false),
  schedule_create: own(true),
  schedule_update: own(false),
  watch_create: own(true),
  update_bot: own(false),
  // The owner's other agents.
  message_bot: own(true),
  handoff_to_bot: own(true),
  message_agent: own(true),
  // Leave Rakazo. add_mcp_server and connect_agent are carded in the executor, gtm_post by its
  // category gates.
  add_to_data_room: outside(false),
  add_mcp_server: outside(true),
  connect_agent: outside(true),
  gtm_post: outside(false, true),
};

/** The profile of a built-in tool, or undefined for a tool that is not in the table. */
export function builtinToolRisk(toolName: string): ToolRiskProfile | undefined {
  return BUILTIN_TOOL_RISK[toolName];
}
