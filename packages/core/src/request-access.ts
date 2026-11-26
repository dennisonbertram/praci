/**
 * Capabilities an agent may ask the owner for with `request_access`. The list is closed: secrets,
 * sends, money, shell and computer control, other spaces, agent settings and connector tools are
 * never on it. `firewall` marks the ones a Firewall agent may be granted, always as ask-each-time.
 */
export const REQUEST_ACCESS_TOOL = "request_access";

export const ACCESS_CAPABILITIES = [
  {
    id: "contacts",
    words: "see, add and edit your contacts",
    tools: ["contacts_list", "contacts_add", "contacts_save"],
    firewall: true,
  },
  {
    id: "data_room_read",
    words: "search and read the Data room",
    tools: ["search_data_room", "read_data_room_item"],
    firewall: true,
  },
  {
    id: "calendar_read",
    words: "see your calendar",
    tools: ["calendar_list_events", "calendar_get_event"],
    firewall: true,
  },
  {
    id: "drive_read",
    words: "search and read Drive",
    tools: ["drive_search", "drive_read"],
    firewall: true,
  },
  {
    id: "calendar_write",
    words: "add and change calendar events",
    tools: ["calendar_create_event", "calendar_update_event"],
    firewall: false,
  },
  {
    id: "drive_write",
    words: "create and edit Drive files",
    tools: ["drive_create_file", "drive_update_file"],
    firewall: false,
  },
  { id: "web_search", words: "search the web", tools: ["web_search"], firewall: false },
] as const;

export type AccessCapabilityId = (typeof ACCESS_CAPABILITIES)[number]["id"];

export function accessCapability(id: unknown) {
  return ACCESS_CAPABILITIES.find((capability) => capability.id === id);
}

/** The tools of these capabilities. Unknown ids add nothing. */
export function accessCapabilityTools(ids: readonly string[]): Set<string> {
  return new Set(ids.flatMap((id) => accessCapability(id)?.tools ?? []));
}

/** Like `accessCapabilityTools`, but only capabilities a Firewall agent may hold. */
export function firewallAccessTools(ids: readonly string[]): Set<string> {
  return accessCapabilityTools(ids.filter((id) => accessCapability(id)?.firewall === true));
}
