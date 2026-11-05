import { describe, expect, it } from "vitest";
import type { TurnRecord } from "../balance/playProgram";
import { parseCatalogue } from "./catalogue";
import {
  createSimulation,
  type Program,
  type TurnPlan,
} from "../simulation/simulation";
import { played } from "../testing/playedStrategies";
import {
  failing,
  files,
  plainMission,
  succeeding,
} from "../testing/realBalance";

const real = createSimulation(parseCatalogue(files));
const start = real.startProgram(1);

/** The Program as it starts, with these technologies built and, if listed as proven, Flight-proven. */
function withTechnology(built: string[], proven: string[] = []): Program {
  return {
    ...start,
    developments: built.map((technologyId) => ({
      technologyId,
      finishesOnTurn: 1,
    })),
    provenTechnologyIds: proven,
  };
}

/** The Risk Band of a Mission Event on this Mission. */
function riskBand(
  program: Program,
  mission: NonNullable<TurnPlan["mission"]>,
  eventId: string,
) {
  return real
    .previewMission(program, mission)
    .find((event) => event.eventId === eventId)?.riskBand;
}

/** Over the Programs that flew it unproven, how often the first such flight failed. */
function firstFlightsFailed(plays: TurnRecord[][], name: string) {
  const firsts = plays.flatMap((play) => {
    const first = play
      .flatMap((turn) => turn.unprovenFlights)
      .find((flight) => flight.name === name);
    return first ? [first.failed] : [];
  });
  return firsts.filter(Boolean).length / firsts.length;
}

/** Mean Science at the end of the Programs whose first unproven flight of this technology worked or failed. */
function scienceAfterFirstFlight(
  plays: TurnRecord[][],
  name: string,
  failed: boolean,
) {
  const group = plays.filter(
    (play) =>
      play
        .flatMap((turn) => turn.unprovenFlights)
        .find((flight) => flight.name === name)?.failed === failed,
  );
  return (
    group.reduce((total, play) => total + (play.at(-1)?.science ?? 0), 0) /
    group.length
  );
}

const pinpointMission = {
  launchVehicleId: "meridian-medium",
  assetIds: ["pinpoint-lander"],
  landingSiteId: "jezero-crater",
};

describe("the balance of Phase 6", () => {
  const steady = played("steady: Soil analysis");

  it("makes developing technology the better choice in some strategies and not in others", () => {
    // Developing the Endurance Rover once rich pays in Science and money.
    const whenRich = played("steady: develop the Endurance Rover when rich");
    expect(whenRich.science).toBeGreaterThan(steady.science);
    expect(whenRich.money).toBeGreaterThan(steady.money);
    expect(whenRich.cancelled).toBeLessThan(steady.cancelled + 0.02);
    // Developing it at once spends the money for a retry, and more Programs are cancelled.
    const atOnce = played("steady: develop the Endurance Rover");
    expect(atOnce.science).toBeLessThan(0.85 * steady.science);
    expect(atOnce.cancelled).toBeGreaterThan(steady.cancelled + 0.1);
  });

  it("makes an unproven first flight a real risk, which is still worth taking in some strategies", () => {
    // Raised until Flight-proven, for each technology that starts unproven or needs Development.
    expect(riskBand(start, pinpointMission, "entry-descent-landing")).toBe(
      "Over 30%",
    );
    expect(
      riskBand(
        withTechnology([], ["pinpoint-lander"]),
        pinpointMission,
        "entry-descent-landing",
      ),
    ).toBe("~20%");
    const colossusMission = {
      launchVehicleId: "meridian-colossus",
      assetIds: ["pathfinder-orbiter"],
    };
    expect(
      riskBand(
        withTechnology(["meridian-colossus"]),
        colossusMission,
        "rendezvous",
      ),
    ).toBe("~10%");
    expect(
      riskBand(
        withTechnology(["meridian-colossus"], ["meridian-colossus"]),
        colossusMission,
        "rendezvous",
      ),
    ).toBe("~5%");

    // After a Survey, a first Pinpoint Lander fails often enough to matter, but seldom enough to be worth it.
    const pinpoint = played("survey first, Pinpoint Lander");
    const failed = firstFlightsFailed(pinpoint.plays, "Pinpoint Lander");
    expect(failed).toBeGreaterThan(0.1);
    expect(failed).toBeLessThan(0.25);
    expect(pinpoint.science).toBeGreaterThan(played("survey first").science);
    // It is a gamble: a Program whose first one fails ends with far less.
    expect(
      scienceAfterFirstFlight(pinpoint.plays, "Pinpoint Lander", false),
    ).toBeGreaterThan(
      2 * scienceAfterFirstFlight(pinpoint.plays, "Pinpoint Lander", true),
    );
    // A first flight of the Endurance Rover or the Meridian Colossus fails in under a third of Programs.
    for (const [name, technology] of [
      ["steady: develop the Endurance Rover when rich", "Endurance Rover"],
      [
        "big Program: develop the Meridian Colossus when rich",
        "Meridian Colossus",
      ],
    ] as const) {
      const rate = firstFlightsFailed(played(name).plays, technology);
      expect(rate).toBeGreaterThan(0.15);
      expect(rate).toBeLessThan(0.34);
    }
  });

  it("makes the relay orbiter earn its place beside rovers, and not as a Program's first orbiter", () => {
    const beside = played("steady: relay beside rovers");
    expect(beside.science).toBeGreaterThan(1.05 * steady.science);
    // For a little less money, and no more cancellations.
    expect(beside.money).toBeGreaterThan(0.9 * steady.money);
    expect(beside.cancelled).toBeLessThan(steady.cancelled + 0.02);
    const first = played("steady: Courier Relay");
    expect(first.science).toBeLessThan(steady.science);
  });

  // Against filling the Meridian Heavy it pays only in a Program that flies Crew, which balancePhase7.test.ts tests.
  it("makes the Meridian Colossus pay in a big Program over one Asset per Mission, and not in a steady one", () => {
    const oneAtATime = played("big Program: one Asset per Mission");
    const colossus = played(
      "big Program: develop the Meridian Colossus when rich",
    );
    expect(colossus.science).toBeGreaterThan(1.03 * oneAtATime.science);
    expect(colossus.cancelled).toBeLessThan(oneAtATime.cancelled + 0.02);
    // No real gain in a steady Program, which base funding (Phase 8) leaves about even.
    expect(
      played("steady: develop the Meridian Colossus when rich").science,
    ).toBeLessThan(1.03 * steady.science);
    // Developing it before the Program is rich spends the money for a retry.
    expect(
      played("steady: develop the Meridian Colossus").cancelled,
    ).toBeGreaterThan(steady.cancelled + 0.1);
  });

  describe("keeps the opening a choice", () => {
    it("with an unproven Pinpoint Lander: no safer than a Survey first, and with no money left for a retry", () => {
      const first = failing.runTurn(failing.startProgram(1), {
        mission: pinpointMission,
      });
      expect(failing.readProgram(first.program).status.kind).toBe("active");
      // What the gamble left, before base funding, which since Phase 8 pays for a retry in time.
      expect(
        failing.validatePlan(
          {
            ...first.program,
            moneyMillions:
              first.program.moneyMillions - first.summary.baseFundingMillions,
          },
          plainMission,
        ).problems,
      ).toHaveLength(1);
      // Landing straight away with it pays less than surveying first with the Flight-proven lander. Since base funding
      // (Phase 8) it no longer pays less than landing straight away with that lander, as more of its gambles recover.
      expect(
        played("land straight away, Pinpoint Lander").science,
      ).toBeLessThan(played("survey first").science);
    });

    it("with Development: the first Turn can start one beside an orbiter, but then has nothing left for a retry", () => {
      const both: TurnPlan = {
        ...plainMission,
        developmentIds: ["endurance-rover"],
      };
      expect(succeeding.validatePlan(start, both).problems).toEqual([]);
      const { program } = failing.runTurn(failing.startProgram(1), both);
      expect(failing.validatePlan(program, plainMission).problems).toHaveLength(
        1,
      );
    });
  });
});
