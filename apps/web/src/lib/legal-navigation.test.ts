import { describe, expect, it } from "vitest";
import {
  legalDataRoomState,
  legalReturnPath,
  legalReturnTo,
  legalUiStateForReturn,
} from "./legal-navigation";

describe("Legal return navigation", () => {
  it("preserves the current Legal route without putting it into a shareable URL", () => {
    expect(
      legalReturnPath({
        pathname: "/app/legal",
        search: "?view=contracts&q=MOCK+Insurance+Policy&group=off",
        hash: "",
      }),
    ).toBe("/app/legal?view=contracts&q=MOCK+Insurance+Policy&group=off");
  });

  it("accepts only same-app Legal paths as return targets", () => {
    expect(legalReturnTo("/app/legal?view=deadlines&due=soon")).toBe(
      "/app/legal?view=deadlines&due=soon",
    );
    expect(legalReturnTo("/app/legal/../finance")).toBeUndefined();
    expect(legalReturnTo("//example.com/app/legal")).toBeUndefined();
    expect(legalReturnTo("https://example.com/")).toBeUndefined();
    expect(legalReturnTo({ pathname: "/app/legal" })).toBeUndefined();
    expect(legalReturnTo("/app/legal/?view=graph")).toBe("/app/legal/?view=graph");
  });

  it("falls back to Legal home for a non-Legal source location", () => {
    expect(legalReturnPath({ pathname: "/app/data-room", search: "?item=doc", hash: "" })).toBe(
      "/app/legal",
    );
  });

  it("keeps graph and group details in history state, not the document URL", () => {
    const state = legalDataRoomState(
      {
        pathname: "/app/legal/",
        search: "?view=graph",
        hash: "",
      },
      { selectedNode: "contract-1", expandedGroup: "group-2" },
    );
    expect(state).toEqual({
      from: "legal",
      returnTo: "/app/legal/?view=graph",
      legalUiState: { selectedNode: "contract-1", expandedGroup: "group-2" },
    });
    expect(legalUiStateForReturn(state)).toEqual({
      legalUiState: { selectedNode: "contract-1", expandedGroup: "group-2" },
    });
  });
});
