/** Box's official remote MCP server (https://developer.box.com/guides/box-mcp/remote). */
export const BOX_MCP_ENDPOINT = "https://mcp.box.com";

/** Whether an MCP server endpoint is Box's, matched by https host so path variants still match. */
export function isBoxEndpoint(endpoint: string | null | undefined): boolean {
  if (!endpoint) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && url.host === new URL(BOX_MCP_ENDPOINT).host;
  } catch {
    return false;
  }
}

/**
 * From https://developer.box.com/guides/box-mcp/tools (2026-10). Box labels only some tools
 * read-only; the search, metadata-template and AI question and extract tools are unlabeled but
 * change nothing. `get_download_url` only mints a one-time download link.
 */
export const BOX_READ_TOOLS = [
  "who_am_i",
  "get_file_content",
  "get_file_details",
  "get_file_preview",
  "get_folder_details",
  "list_folder_content_by_folder_id",
  "get_download_url",
  "search_files_keyword",
  "search_files_metadata",
  "search_folders_by_name",
  "list_metadata_templates",
  "get_metadata_template_schema",
  "list_file_comments",
  "list_item_collaborations",
  "list_tasks",
  "list_hubs",
  "get_hub_details",
  "get_hub_items",
  "list_docgen_templates",
  "get_docgen_template_by_id",
  "ai_qa_single_file",
  "ai_qa_multi_file",
  "ai_qa_hub",
  "ai_extract_freeform",
  "ai_extract_structured_from_fields",
  "ai_extract_structured_from_metadata_template",
] as const;

/**
 * Every Box tool that writes or spends money. `ai_extract_structured` and the "enhanced" extract tools read, but Box says they use the Enhanced
 * Extract Agent and cost more, so each call asks first.
 */
export const BOX_WRITE_TOOLS = [
  "copy_file",
  "copy_folder",
  "create_folder",
  "create_metadata_template",
  "update_metadata_template",
  "get_upload_url",
  "upload_file",
  "upload_file_version",
  "move_file",
  "move_folder",
  "set_file_metadata",
  "set_folder_metadata",
  "update_file_properties",
  "update_folder_properties",
  "add_file_shared_link",
  "add_folder_shared_link",
  "create_collaboration",
  "update_collaboration",
  "create_file_comment",
  "add_items_to_hub",
  "copy_hub",
  "create_hub",
  "update_hub",
  "create_docgen_template",
  "create_docgen_batch",
  "ai_extract_structured",
  "ai_extract_structured_from_fields_enhanced",
  "ai_extract_structured_from_metadata_template_enhanced",
] as const;

/** Scopes of Box's MCP integration; `root_readwrite` also lets Rakazo list and download for the Data room. */
export const BOX_OAUTH_SCOPE = "root_readwrite";
