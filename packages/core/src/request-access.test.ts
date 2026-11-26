import { describe, expect, it } from "vitest";
import {
  ACCESS_CAPABILITIES,
  firewallAccessTools,
  firewallToolClass,
  REQUEST_ACCESS_TOOL,
  toolRequiresExplicitApproval,
} from "./index.js";

describe("request access", () => {
  it("has the closed list of 7 capabilities, 4 for Firewall agents", () => {
    expect(ACCESS_CAPABILITIES.map((c) => c.id)).toEqual([
      "contacts",
      "data_room_read",
      "calendar_read",
      "drive_read",
      "calendar_write",
      "drive_write",
      "web_search",
    ]);
    expect(ACCESS_CAPABILITIES.filter((c) => c.firewall).map((c) => c.id)).toEqual([
      "contacts",
      "data_room_read",
      "calendar_read",
      "drive_read",
    ]);
  });

  it("is an explicit-approval tool a Firewall agent is offered", () => {
    expect(toolRequiresExplicitApproval(REQUEST_ACCESS_TOOL)).toBe(true);
    expect(firewallToolClass(REQUEST_ACCESS_TOOL)).toBe("free");
  });

  it("moves granted tools to ask-each-time, never free", () => {
    expect(firewallToolClass("contacts_add")).toBe("dropped");
    expect(firewallToolClass("contacts_add", false, firewallAccessTools(["contacts"]))).toBe("ask");
    // Only Firewall-eligible capabilities extend the class.
    expect(firewallToolClass("web_search", false, firewallAccessTools(["web_search"]))).toBe(
      "dropped",
    );
  });
});
