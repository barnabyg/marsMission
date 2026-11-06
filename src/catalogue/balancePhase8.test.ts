import { describe, expect, it } from "vitest";
import { keepsItselfGoingFrom } from "../balance/comingHomeReport";
import type { TurnRecord } from "../balance/playProgram";
import { played } from "../testing/playedStrategies";

const flewCrew = (play: TurnRecord[]) =>
  play.some(({ crewFlown }) => crewFlown > 0);
const meanOf = (values: number[]) =>
  values.reduce((total, value) => total + value, 0) / values.length;

/** Of these Programs, the share that keep themselves going, and the mean Turn from which they do. */
function keptGoing(plays: TurnRecord[][]) {
  const from = plays.flatMap((play) => keepsItselfGoingFrom(play) ?? []);
  return { share: from.length / plays.length, fromTurn: meanOf(from) };
}

describe("the balance of Phase 8", () => {
  const orbitOneWay = played(
    "big Program: develop the Meridian Colossus and fly Crew when rich",
  );
  const orbitHome = played(
    "big Program: fly Crew on a round trip and bring them home",
  );
  const landing = played(
    "big Program: develop the Meridian Colossus and land Crew when rich",
  );
  const fuelPlantOneWay = played("big Program: land Crew and a fuel plant");
  const fuelPlantHome = played(
    "big Program: land round-trip Crew beside a fuel plant and bring them home",
  );
  const baseHome = played(
    "big Program: build a base, land Crew there and bring them home",
  );
  const baseOneWay = played(
    "big Program: build a base and land Crew there one way",
  );
  const robotic = played("big Program: one Asset per Mission");
  const samples = played("big Program: cache samples and send them home");
  const rovers = played("steady: Soil analysis");

  it("makes bringing Crew home the better choice in some strategies and not in others", () => {
    // Beside a fuel plant, Crew who come home through Mars ascent bring samples and earn Public Support, which is worth
    // more than what one-way Crew earn before their Health runs out, and they are cancelled less.
    expect(fuelPlantHome.science).toBeGreaterThan(fuelPlantOneWay.science);
    expect(fuelPlantHome.money).toBeGreaterThan(fuelPlantOneWay.money);
    expect(fuelPlantHome.cancelled).toBeLessThanOrEqual(
      fuelPlantOneWay.cancelled,
    );
    // In Mars orbit they bring nothing home, and leave before one-way Crew would stop working, so one way earns more.
    expect(orbitHome.science).toBeLessThan(0.9 * orbitOneWay.science);
    // At a base, one-way Crew earn more Science, but losing them cancels far more Programs.
    expect(baseOneWay.science).toBeGreaterThan(baseHome.science);
    expect(baseOneWay.cancelled).toBeGreaterThan(2 * baseHome.cancelled);
  });

  it("makes returned samples worth the Missions they take", () => {
    expect(samples.science).toBeGreaterThan(1.05 * robotic.science);
  });

  it("makes the fuel plant worth building in some strategies, without being an obvious yes", () => {
    // Round-trip Crew beside one can land, and do Field research, rather than staying in Mars orbit.
    expect(fuelPlantHome.science).toBeGreaterThan(1.2 * orbitHome.science);
    // One-way Crew have no use for it, so it only takes money from more Crew.
    expect(fuelPlantOneWay.science).toBeLessThan(0.9 * landing.science);
  });

  it("lets a Program that builds a base well keep itself going", () => {
    // A base whose Mars lab raises the Research Grants of the Crew and rovers working there pays for their Missions.
    const base = keptGoing(baseHome.plays.filter(flewCrew));
    const noBase = keptGoing(landing.plays.filter(flewCrew));
    expect(base.share).toBeGreaterThan(0.3);
    expect(base.share).toBeGreaterThan(1.4 * noBase.share);
    // But not as an obvious first move: it pays only once Crew work there, late in a Program, long after rovers alone
    // can keep a Program going.
    expect(base.fromTurn).toBeGreaterThan(12);
    expect(keptGoing(rovers.plays).fromTurn).toBeLessThan(9);
  });
});
