import { describe, expect, it } from "vitest";

import { selectSingleton } from "../src/terminal/singleton";

describe("selectSingleton", () => {
  it("returns no primary for an empty workspace", () => {
    expect(selectSingleton([], null)).toEqual({ duplicates: [], primary: null });
  });

  it("keeps the attached terminal leaf when duplicate leaves are restored", () => {
    const first = { id: "first" };
    const attached = { id: "attached" };
    const last = { id: "last" };

    expect(selectSingleton([first, attached, last], attached)).toEqual({
      duplicates: [first, last],
      primary: attached,
    });
  });

  it("falls back to the first leaf when the preferred leaf is stale", () => {
    const first = { id: "first" };
    const second = { id: "second" };

    expect(selectSingleton([first, second], { id: "stale" })).toEqual({
      duplicates: [second],
      primary: first,
    });
  });
});
