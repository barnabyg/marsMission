import { describe, expect, it } from "vitest";
import { homewardPlayMs } from "../homeward";
import {
  ascentCraftAt,
  closingMs,
  dockedAt,
  hitFlash,
  marsRendezvousNow,
  marsRendezvousStatus,
} from "./marsRendezvous";
import {
  breakUpFlash,
  breakUpMs,
  capsuleAt,
  chutesOpenMs,
  earthEntryNow,
  earthEntryStatus,
  piecesAt,
  splashAt,
  splashMs,
} from "./splashdown";

const crew = { aboard: "crew" as const, vehicleName: "Earth return stage" };
const samples = {
  aboard: "samples" as const,
  vehicleName: "Albatross Orbiter",
};

/** What's playing, which the test has made sure is. */
function must<T>(now: T | null): T {
  if (now === null) throw new Error("Nothing is playing");
  return now;
}

const rendezvous = (sinceMs: number, failed = false) =>
  marsRendezvousNow(crew, { part: "rendezvous", sinceMs, failed });

describe("the rendezvous in Mars orbit, close up", () => {
  it("shows only while the rendezvous plays", () => {
    expect(
      marsRendezvousNow(crew, { part: "entry", sinceMs: 0, failed: false }),
    ).toBeNull();
    expect(marsRendezvousNow(crew, null)).toBeNull();
  });

  it("brings what lifted off up from Mars, braking to dock nose to nose", () => {
    const start = ascentCraftAt(must(rendezvous(0)));
    expect(start.place[1]).toBeLessThan(-3);
    expect(start.burning).toBe(true);
    expect(rendezvous(closingMs)?.stage).toBe("docked");
    expect(ascentCraftAt(must(rendezvous(closingMs + 500)))).toEqual({
      place: dockedAt(true),
      tumble: 0,
      burning: false,
      lost: false,
    });
  });

  it("docks the samples' canister to the orbiter's capsule, further in", () => {
    expect(dockedAt(false)[0]).toBeLessThan(dockedAt(true)[0]);
  });

  it("brings a failed one in too fast, then sends it tumbling away with a flash, stranded", () => {
    const braking = ascentCraftAt(must(rendezvous(closingMs / 2)));
    const tooFast = ascentCraftAt(must(rendezvous(closingMs / 2, true)));
    // Too fast means it's further back halfway, as it never slows.
    expect(tooFast.place[0]).toBeGreaterThan(braking.place[0]);
    const missed = rendezvous(closingMs + 300, true);
    expect(missed?.stage).toBe("missed");
    expect(ascentCraftAt(must(missed))).toMatchObject({
      lost: true,
      burning: false,
    });
    expect(hitFlash(missed)).not.toBeNull();
    expect(hitFlash(rendezvous(closingMs + 3000, true))).toBeNull();
  });

  it("says what is happening, naming what waits", () => {
    expect(marsRendezvousStatus(rendezvous(100))).toBe(
      "Mars orbit rendezvous: the Crew coming up to dock with the Earth return stage",
    );
    expect(
      marsRendezvousStatus(
        marsRendezvousNow(samples, {
          part: "rendezvous",
          sinceMs: closingMs + 100,
          failed: true,
        }),
      ),
    ).toBe(
      "Mars orbit rendezvous failed: the samples couldn't dock with the Albatross Orbiter",
    );
  });
});

const entry = (sinceMs: number, failed = false) =>
  earthEntryNow(crew, { part: "entry", sinceMs, failed });

describe("Earth entry and the splashdown, close up", () => {
  it("comes in glowing, slows under parachutes and splashes down", () => {
    expect(entry(100)?.stage).toBe("entering");
    expect(capsuleAt(must(entry(1000))).glow).toBeGreaterThan(0);
    expect(entry(chutesOpenMs + 100)?.stage).toBe("descending");
    expect(capsuleAt(must(entry(chutesOpenMs + 1500))).chutes).toBe(1);
    const down = capsuleAt(must(entry(splashMs + 100)));
    expect(entry(splashMs + 100)?.stage).toBe("splashedDown");
    expect(down.place[0]).toBe(splashAt[0]);
    expect(Math.abs(down.place[1] - splashAt[1])).toBeLessThan(0.1);
  });

  it("breaks up in the glow if the heat shield fails, leaving pieces falling and no splashdown", () => {
    expect(entry(breakUpMs - 100, true)?.stage).toBe("entering");
    const broken = entry(breakUpMs + 500, true);
    expect(broken?.stage).toBe("brokenUp");
    expect(capsuleAt(must(broken)).shown).toBe(false);
    expect(piecesAt(must(broken))).toHaveLength(4);
    expect(
      breakUpFlash(must(entry(breakUpMs + 100, true)))?.share,
    ).toBeLessThan(0.2);
    expect(breakUpFlash(must(entry(breakUpMs + 1000, true)))).toBeNull();
    expect(entry(homewardPlayMs.entry - 1, true)?.stage).toBe("brokenUp");
  });

  it("says what is happening", () => {
    expect(earthEntryStatus(entry(splashMs + 10))).toBe(
      "Earth entry: the capsule has splashed down in the ocean",
    );
    expect(earthEntryStatus(null)).toBeNull();
  });
});
