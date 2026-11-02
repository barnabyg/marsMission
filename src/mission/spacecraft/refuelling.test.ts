import { describe, expect, it } from "vitest";
import type { TimelineEntry } from "../../simulation/simulation";
import { marsOrbitShot } from "../marsOrbit/MarsOrbitView";
import { solarSystemShot } from "../solarSystem/SolarSystemView";
import {
  earthOrbitLayout,
  earthOrbitShot,
  spacecraftCentre,
} from "./spacecraft";
import { surfaceCentre } from "../surface/surface";
import {
  approachMs,
  earthOrbitNow,
  earthOrbitStatus,
  lossFlash,
  msSinceLoss,
  refuellingOf,
  rendezvousMs,
  tankerAt,
  tankerClimbMs,
} from "./refuelling";

function missionEvent(
  eventId: string,
  day: number,
  outcome: "success" | "failure" = "success",
): TimelineEntry {
  return {
    kind: "missionEvent",
    day,
    eventId,
    title: eventId,
    description: "",
    outcome,
  };
}

const launch = missionEvent("launch", 0);
const tankerLaunch = missionEvent("tanker-launch", 1);
const rendezvous = missionEvent("rendezvous", 2);
const transferBurn = missionEvent("mars-transfer-burn", 3);

/** A refuelled Mission that gets away to Mars. */
const refuelled = [launch, tankerLaunch, rendezvous, transferBurn];

/** Playback with each entry so far having happened at these real played times, now at `playedMs`. */
function played(day: number, entriesPlayedMs: number[], playedMs: number) {
  return {
    day,
    entriesHappened: entriesPlayedMs.length,
    entriesPlayedMs,
    playedMs,
  };
}

describe("a Mission's Orbital refuelling", () => {
  it("has none on a Launch Vehicle that doesn't need it", () => {
    expect(refuellingOf([launch, missionEvent("mars-transfer-burn", 1)])).toBe(
      null,
    );
  });

  it("finds the tanker launch, the rendezvous and the day the Mission leaves Earth orbit", () => {
    expect(refuellingOf(refuelled)).toEqual({
      launchIndex: 0,
      tankerLaunch: { entryIndex: 1, failed: false },
      rendezvous: { entryIndex: 2, failed: false },
      departureDay: 3,
    });
  });
});

describe("the Mission in Earth orbit", () => {
  const refuelling = refuellingOf(refuelled);

  it("isn't there with no Orbital refuelling", () => {
    expect(earthOrbitNow(null, played(0, [0], 0))).toBeNull();
  });

  it("waits alone for the Tanker after launch", () => {
    expect(earthOrbitNow(refuelling, played(0.5, [0], 500))?.stage).toBe(
      "waiting",
    );
  });

  const stageAt = (day: number, entriesPlayedMs: number[], playedMs: number) =>
    earthOrbitNow(refuelling, played(day, entriesPlayedMs, playedMs))?.stage;

  it("sees the Tanker climb from Earth for a few seconds of real time, and then hold nearby", () => {
    expect(stageAt(1, [0, 1000], 1000 + tankerClimbMs - 1)).toBe(
      "tankerClimbing",
    );
    expect(stageAt(1.8, [0, 1000], 1000 + tankerClimbMs)).toBe("holding");
  });

  it("sees the Tanker come in and dock, the Mission refuel, and the Tanker leave", () => {
    const at = (playedMs: number) =>
      stageAt(3.5, [0, 1000, 5000, 5500], playedMs);
    expect(at(5000)).toBe("approaching");
    expect(at(5000 + approachMs)).toBe("refuelling");
    expect(at(5000 + rendezvousMs - 1)).toBe("leaving");
  });

  it("is gone once the rendezvous has played and the Mission has left for Mars", () => {
    expect(
      earthOrbitNow(
        refuelling,
        played(4, [0, 1000, 5000, 5500], 5000 + rendezvousMs),
      ),
    ).toBeNull();
  });

  it("waits, refuelled, if play hasn't reached the day it leaves", () => {
    expect(stageAt(2.9, [0, 1000, 5000], 5000 + rendezvousMs)).toBe(
      "refuelled",
    );
  });

  it("starts the rendezvous from its entry even while the Tanker is still climbing, as at speed", () => {
    expect(stageAt(2, [0, 0, 150], 150)).toBe("approaching");
  });

  it("holds wherever it has got to while play is paused, as real time played stands still", () => {
    const paused = earthOrbitNow(refuelling, played(2, [0, 0, 150], 1000));
    expect(earthOrbitNow(refuelling, played(2, [0, 0, 150], 1000))).toEqual(
      paused,
    );
    expect(paused?.sinceRendezvousMs).toBe(850);
  });

  it("comes out the same at every speed, going only by real time played", () => {
    const slow = earthOrbitNow(refuelling, played(2.1, [0, 0, 150], 3000));
    const fast = earthOrbitNow(refuelling, played(2.9, [0, 0, 150], 3000));
    expect(fast).toEqual(slow);
  });
});

describe("a failed rendezvous in Earth orbit", () => {
  const refuelling = refuellingOf([
    launch,
    tankerLaunch,
    missionEvent("rendezvous", 2, "failure"),
  ]);
  const at = (playedMs: number) =>
    earthOrbitNow(refuelling, played(2, [0, 1000, 5000], playedMs));

  it("comes in as a success does, with the Mission intact until they collide", () => {
    expect(at(5000 + approachMs - 1)).toMatchObject({
      stage: "approaching",
      missionLost: false,
    });
    expect(at(5000 + approachMs)).toMatchObject({
      stage: "collided",
      missionLost: true,
    });
  });

  it("shows the wreck for as long as a successful rendezvous takes, and then is gone", () => {
    expect(at(5000 + rendezvousMs - 1)?.stage).toBe("collided");
    expect(at(5000 + rendezvousMs)).toBeNull();
  });
});

describe("a failed tanker launch", () => {
  const refuelling = refuellingOf([
    launch,
    missionEvent("tanker-launch", 1, "failure"),
  ]);
  const at = (playedMs: number) =>
    earthOrbitNow(refuelling, played(3, [0, 1000], playedMs));

  it("has no rendezvous", () => {
    expect(refuelling?.rendezvous).toBeNull();
    expect(refuelling?.departureDay).toBeNull();
  });

  it("sees the Tanker break up on its way, leaving the Mission stranded for a few seconds, and then is gone", () => {
    expect(at(1000)).toMatchObject({
      stage: "tankerClimbing",
      missionLost: false,
    });
    expect(at(1000 + tankerClimbMs)).toMatchObject({
      stage: "tankerLost",
      missionLost: true,
    });
    expect(at(1000 + rendezvousMs - 1)?.stage).toBe("tankerLost");
    expect(at(1000 + rendezvousMs)).toBeNull();
  });
});

describe("where the Tanker is", () => {
  const refuelling = refuellingOf(refuelled);
  const failed = refuellingOf([
    launch,
    tankerLaunch,
    missionEvent("rendezvous", 2, "failure"),
  ]);
  const tankerWhen = (
    entriesPlayedMs: number[],
    playedMs: number,
    of = refuelling,
  ) => tankerAt(earthOrbitNow(of, played(2, entriesPlayedMs, playedMs)));
  const distance = (first: readonly number[], second: readonly number[]) =>
    Math.hypot(...first.map((value, index) => value - (second[index] ?? 0)));
  const docked = [0, 0, 0];

  it("isn't there before it launches", () => {
    expect(tankerWhen([0], 500)).toBeNull();
  });

  it("rises from below to wait nearby", () => {
    const leaving = tankerWhen([0, 1000], 1000);
    const holding = tankerWhen([0, 1000], 1000 + tankerClimbMs);
    expect(leaving?.place[1]).toBeLessThan((holding?.place[1] ?? 0) - 2);
    expect(leaving?.burning).toBe(true);
    expect(holding?.burning).toBe(false);
    expect(distance(holding?.place ?? docked, docked)).toBeGreaterThan(1);
  });

  it("starts its approach from wherever its climb has got to, so it never jumps", () => {
    const climbing = tankerWhen([0, 0], 150);
    const approaching = tankerWhen([0, 0, 150], 150);
    expect(approaching?.place).toEqual(climbing?.place);
  });

  it("docks at the end of its approach, and leaves from there", () => {
    const arriving = tankerWhen([0, 0, 5000], 5000 + approachMs - 1);
    expect(distance(arriving?.place ?? [9, 9, 9], docked)).toBeLessThan(0.01);
    expect(tankerWhen([0, 0, 5000], 5000 + approachMs)?.place).toEqual(docked);
    const leavingAt = 5000 + rendezvousMs - 1500;
    expect(
      distance(tankerWhen([0, 0, 5000], leavingAt)?.place ?? [9], docked),
    ).toBeLessThan(0.01);
    expect(
      distance(
        tankerWhen([0, 0, 5000], 5000 + rendezvousMs - 1)?.place ?? docked,
        docked,
      ),
    ).toBeGreaterThan(1);
  });

  it("is gone once it has left", () => {
    expect(
      tankerAt(
        earthOrbitNow(
          refuelling,
          played(2.5, [0, 0, 5000], 5000 + rendezvousMs),
        ),
      ),
    ).toBeNull();
  });

  it("comes in too fast when the rendezvous fails, and bounces off wrecked", () => {
    const before = tankerWhen([0, 0, 5000], 5000 + approachMs - 200, failed);
    const success = tankerWhen([0, 0, 5000], 5000 + approachMs - 200);
    expect(distance(before?.place ?? docked, docked)).toBeGreaterThan(
      distance(success?.place ?? docked, docked),
    );
    const hit = tankerWhen([0, 0, 5000], 5000 + approachMs, failed);
    expect(hit).toMatchObject({ place: docked, lost: true });
    const after = tankerWhen([0, 0, 5000], 5000 + approachMs + 1500, failed);
    expect(after?.lost).toBe(true);
    expect(distance(after?.place ?? docked, docked)).toBeGreaterThan(0.5);
  });

  it("breaks up at the end of its climb when its launch fails", () => {
    const tankerFailed = refuellingOf([
      launch,
      missionEvent("tanker-launch", 1, "failure"),
    ]);
    expect(tankerWhen([0, 1000], 1500, tankerFailed)?.lost).toBe(false);
    expect(
      tankerWhen([0, 1000], 1000 + tankerClimbMs, tankerFailed),
    ).toBeNull();
  });
});

describe("how long ago the Mission was lost in Earth orbit", () => {
  it("counts real time played from the collision, or from the Tanker breaking up", () => {
    const failed = refuellingOf([
      launch,
      tankerLaunch,
      missionEvent("rendezvous", 2, "failure"),
    ]);
    const tankerFailed = refuellingOf([
      launch,
      missionEvent("tanker-launch", 1, "failure"),
    ]);
    expect(
      msSinceLoss(
        earthOrbitNow(failed, played(2, [0, 0, 5000], 5000 + approachMs - 1)),
      ),
    ).toBeNull();
    expect(
      msSinceLoss(
        earthOrbitNow(failed, played(2, [0, 0, 5000], 5000 + approachMs + 300)),
      ),
    ).toBe(300);
    expect(
      msSinceLoss(
        earthOrbitNow(
          tankerFailed,
          played(2, [0, 1000], 1000 + tankerClimbMs + 300),
        ),
      ),
    ).toBe(300);
  });

  it("has nothing to count for a Mission that's refuelled", () => {
    expect(
      msSinceLoss(
        earthOrbitNow(refuellingOf(refuelled), played(2, [0, 0, 5000], 9000)),
      ),
    ).toBeNull();
    expect(msSinceLoss(null)).toBeNull();
  });
});

describe("the flash when the Mission is lost in Earth orbit", () => {
  it("bursts where they collide, and fades within a second or so", () => {
    const failed = refuellingOf([
      launch,
      tankerLaunch,
      missionEvent("rendezvous", 2, "failure"),
    ]);
    const at = (playedMs: number) =>
      lossFlash(earthOrbitNow(failed, played(2, [0, 0, 1000], playedMs)));
    expect(at(1000 + approachMs - 1)).toBeNull();
    expect(at(1000 + approachMs)).toEqual({ place: [0, 0, 0], share: 0 });
    expect(at(1000 + approachMs + 5000)).toBeNull();
  });

  it("bursts where the Tanker breaks up on its way", () => {
    const tankerFailed = refuellingOf([
      launch,
      missionEvent("tanker-launch", 1, "failure"),
    ]);
    const now = (playedMs: number) =>
      earthOrbitNow(tankerFailed, played(2, [0, 0], playedMs));
    const lastPlace = tankerAt(now(tankerClimbMs - 1))?.place ?? [9, 9, 9];
    const flash = lossFlash(now(tankerClimbMs));
    lastPlace.forEach((value, index) => {
      expect(flash?.place[index]).toBeCloseTo(value);
    });
  });
});

describe("what the player reads about the Mission in Earth orbit", () => {
  it("says what's happening at each stage, naming the Tanker and the Rendezvous", () => {
    const status = (entriesPlayedMs: number[], playedMs: number) =>
      earthOrbitStatus(
        earthOrbitNow(
          refuellingOf(refuelled),
          played(2, entriesPlayedMs, playedMs),
        ),
      );
    expect(status([0], 0)).toBe("Waiting in Earth orbit for the Tanker");
    expect(status([0, 0, 0], 0)).toBe(
      "Rendezvous: the Tanker is coming in to dock",
    );
    expect(status([0, 0, 0], approachMs)).toBe(
      "Orbital refuelling: taking on propellant from the Tanker",
    );
    expect(status([], 0)).toBeNull();
  });

  it("says when the Rendezvous wrecks the Mission", () => {
    const failed = refuellingOf([
      launch,
      tankerLaunch,
      missionEvent("rendezvous", 2, "failure"),
    ]);
    expect(
      earthOrbitStatus(earthOrbitNow(failed, played(2, [0, 0, 0], approachMs))),
    ).toBe("Rendezvous failed: the Mission and the Tanker collided");
  });
});

describe("the Earth orbit shot", () => {
  it("puts the docked Tanker, the upper stage and the Mission in a row, centred on the shot", () => {
    const { tanker, upperStage, dock, stack } = earthOrbitLayout(3);
    expect(tanker).toBeLessThan(dock);
    expect(dock).toBeLessThan(upperStage);
    expect(upperStage).toBeLessThan(stack);
    const leftEnd = tanker - 0.8;
    const rightEnd = stack + earthOrbitLayout(3).stackHalfLength;
    expect(leftEnd + rightEnd).toBeCloseTo(0);
  });

  it("is beside the spacecraft view's, so the camera slides across when the Mission leaves, and looks away from the other views", () => {
    const [x, y, z] = earthOrbitShot.position;
    const looking = earthOrbitShot.target.map(
      (value, index) => value - (earthOrbitShot.position[index] ?? 0),
    );
    expect(earthOrbitShot.target[0]).toBe(spacecraftCentre[0]);
    // Outside the surface view's sky, which is 14.5 across from its middle and would otherwise fill the shot.
    expect(
      Math.hypot(
        x - surfaceCentre[0],
        y - surfaceCentre[1],
        z - surfaceCentre[2],
      ),
    ).toBeGreaterThan(16);
    for (const [px, py, pz] of [
      surfaceCentre,
      marsOrbitShot.target,
      solarSystemShot.target,
      spacecraftCentre,
    ]) {
      const towards = [px - x, py - y, pz - z];
      const dot = towards.reduce(
        (total, value, index) => total + value * (looking[index] ?? 0),
        0,
      );
      const cosine = dot / (Math.hypot(...towards) * Math.hypot(...looking));
      // Outside the widest the shot sees, across a 16:9 screen.
      expect(cosine).toBeLessThan(Math.cos((40 * Math.PI) / 180));
    }
  });
});
