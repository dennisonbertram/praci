import type { FinanceProvider } from "./finance.js";
import { FINANCE_READ_TOOLS, financeProviderForEndpoint } from "./finance.js";

/** The one place an integration agent's spawn key is built. The key encodes the MCP server id. */
export const integrationAgentSpawnKey = (serverId: string) => `integration-agent:${serverId}`;

export const isIntegrationAgentSpawnKey = (spawnKey: string | null | undefined) =>
  Boolean(spawnKey?.startsWith(integrationAgentSpawnKey("")));

/**
 * Per-provider read and write lists, for tools whose MCP annotations are missing or wrong.
 * Anything in neither list is a write unless the server annotates it `readOnlyHint: true`.
 */
export type IntegrationPreset = {
  /** Shown to the model and the user, for example "Mercury". */
  service: string;
  /** Tools treated as reads even without a `readOnlyHint`. */
  reads: readonly string[];
  /** Tools that are always writes, whatever the annotation says. Wins over `reads`. */
  forcedWrites: readonly string[];
};

const MERCURY_READS = [
  "getAccount",
  "getAccountCards",
  "getAccountStatements",
  "getAccounts",
  "getAttachment",
  "getCard",
  "getCashflowSummary",
  "getCurrentDate",
  "getCustomer",
  "getInvoice",
  "getOrganization",
  "getRecipient",
  "getRecipientInvite",
  "getRecipients",
  "getSafeRequest",
  "getSafeRequests",
  "getTransaction",
  "getTransactionById",
  "getTransferMoneyApprovalRequest",
  "getTreasury",
  "getTreasuryTransactions",
  "getUser",
  "getUsers",
  "getWebhook",
  "getWebhooks",
  "listCards",
  "listCategories",
  "listCredit",
  "listCustomers",
  "listInvoiceAttachments",
  "listInvoices",
  "listMerchants",
  "listRecipientInvites",
  "listRecipientsAttachments",
  "listSendMoneyApprovalRequests",
  "listTransactions",
  "listTransferMoneyApprovalRequests",
];

const BREX_READS = [
  "get_active_integration",
  "get_banking_transaction",
  "get_bill_by_id",
  "get_business_account",
  "get_card_by_id",
  "get_card_shipping_details",
  "get_expense_by_id",
  "get_expense_download_result",
  "get_expense_policy",
  "get_reimbursement_payout_date",
  "get_reward_points",
  "get_spend_limit_by_id",
  "get_user_by_id",
  "get_user_myself",
  "get_vendor_by_id",
  "list_accounting_records",
  "list_banking_transactions",
  "list_bills",
  "list_bookings",
  "list_business_accounts",
  "list_cards",
  "list_cards_shipping_details",
  "list_cost_centers",
  "list_departments",
  "list_employee_card_limits",
  "list_expense_categories",
  "list_expense_policies",
  "list_expenses",
  "list_field_values",
  "list_fields",
  "list_gl_accounts",
  "list_legal_entities",
  "list_limit_groups",
  "list_locations",
  "list_merchant_categories",
  "list_merchants",
  "list_my_limits",
  "list_roles",
  "list_spend_limits",
  "list_titles",
  "list_trips",
  "list_users",
  "list_users_by_name_or_email",
  "list_vendors",
  "query_expense_analytics",
];

export const INTEGRATION_PRESETS = {
  mercury: {
    service: "Mercury",
    // Finance's own read list is always a read here, so the two cannot drift apart.
    reads: [...new Set([...MERCURY_READS, ...FINANCE_READ_TOOLS.mercury])],
    forcedWrites: [
      "requestSendMoney",
      "requestTransferMoney",
      "updateTransaction",
      "createCategory",
      "editCategory",
    ],
  },
  brex: {
    service: "Brex",
    reads: [...new Set([...BREX_READS, ...FINANCE_READ_TOOLS.brex])],
    forcedWrites: [
      "create_employee_card",
      "create_purchasing_card",
      "update_employee_card",
      "update_purchasing_card",
      "lock_card",
      "unlock_card",
      "cancel_card",
      "replace_card",
      "transfer_card",
      "ship_physical_card",
      "assign_limit_to_card",
      "assign_limit_for_card_expenses",
      "update_expense_memo",
      "replace_attendees_for_card_expense",
      "upload_card_expense_receipt_from_urls",
      "submit_feedback",
      // Unclear in the plan: stay writes.
      "start_expense_download",
      "verify_shipping_address",
    ],
  },
} as const satisfies Record<FinanceProvider, IntegrationPreset>;

/** The preset for an MCP server, matched by its endpoint like the Finance agent. */
export function integrationPresetForEndpoint(
  endpoint: string | null | undefined,
): IntegrationPreset | undefined {
  const provider = financeProviderForEndpoint(endpoint);
  return provider ? INTEGRATION_PRESETS[provider] : undefined;
}

/**
 * Whether an MCP tool only reads. True for `annotations.readOnlyHint === true` or a name in the
 * preset's reads; a name in the preset's forced writes is never a read. Everything else is a write.
 */
export function isReadTool(
  tool: { name: string; annotations?: { readOnlyHint?: boolean } | null },
  preset?: Pick<IntegrationPreset, "reads" | "forcedWrites">,
): boolean {
  if (preset?.forcedWrites.includes(tool.name)) return false;
  return tool.annotations?.readOnlyHint === true || Boolean(preset?.reads.includes(tool.name));
}
