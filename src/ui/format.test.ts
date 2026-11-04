import { describe, expect, it } from "vitest";
import { formatChange } from "./format";

describe("a change as shown", () => {
  it("has a plus sign when the value went up", () => {
    expect(formatChange(155)).toBe("+155");
  });

  it("has a minus sign when the value went down", () => {
    expect(formatChange(-15)).toBe("−15");
  });

  it("is in money for Money", () => {
    expect(formatChange(-1250, "money")).toBe("−$1.25B");
    expect(formatChange(80, "money")).toBe("+$80M");
  });
});
