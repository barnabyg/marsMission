import { describe, expect, it } from "vitest";
import { knownSeed } from "./knownSeed";

describe("the known seed", () => {
  it("comes from the address, for browser tests and playtests", () => {
    expect(knownSeed("?seed=123")).toBe(123);
  });

  it("is off in normal play, where the address has none", () => {
    expect(knownSeed("")).toBeNull();
    expect(knownSeed("?other=1")).toBeNull();
  });

  it.each(["?seed=", "?seed=abc", "?seed=-1", "?seed=1.5", "?seed=1e3"])(
    "ignores the malformed %s",
    (search) => {
      expect(knownSeed(search)).toBeNull();
    },
  );
});
