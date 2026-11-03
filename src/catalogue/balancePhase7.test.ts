import { describe, expect, it } from "vitest";
import type { TurnRecord } from "../balance/playProgram";
import { parseCatalogue } from "./catalogue";
import { createSimulation, type TurnPlan } from "../simulation/simulation";
import { played } from "../testing/playedStrategies";
import { files } from "../testing/realBalance";

const real = createSimulation(parseCatalogue(files));

const flewCrew = (play: TurnRecord[]) =>
  play.some(({ crewFlown }) => crewFlown > 0);

/** Over the Programs that flew Crew, how many Crew were lost per Program to this cause. */
function crewLostTo(
  plays: TurnRecord[][],
  cause: keyof TurnRecord["crewLost"],
) {
  const flew = plays.filter(flewCrew);
  const lost = flew.flatMap((play) =>
    play.map(({ crewLost }) => crewLost[cause]),
  );
  return lost.reduce((total, count) => total + count, 0) / flew.length;
}

describe("the balance of Phase 7", () => {
  const robotic = played(
    "big Program: develop the Meridian Colossus when rich",
  );
  const landing = played(
    "big Program: develop the Meridian Colossus and land Crew when rich",
  );

  it("makes flying Crew the better choice in some strategies and not in others", () => {
    // Crew who land, with Field research and the Milestones, are worth what they cost.
    expect(landing.science).toBeGreaterThan(1.05 * robotic.science);
    expect(landing.cancelled).toBeLessThan(robotic.cancelled + 0.02);
    // Crew kept in Mars orbit are not: the same money on Assets earns more.
    const inOrbit = played(
      "big Program: develop the Meridian Colossus and fly Crew when rich",
    );
    expect(inOrbit.science).toBeLessThan(robotic.science);
    // Either way, Crew cost money that Assets would have earned back in Research Grants.
    expect(landing.money).toBeLessThan(robotic.money);
  });

  it("makes the Meridian Colossus do better than filling the Meridian Heavy in a big Program that flies Crew", () => {
    const heavy = played("big Program: fill the Meridian Heavy when rich");
    expect(landing.science).toBeGreaterThan(1.03 * heavy.science);
    expect(landing.cancelled).toBeLessThan(heavy.cancelled + 0.02);
    // Without Crew it doesn't, as Phase 6 found.
    expect(robotic.science).toBeLessThan(heavy.science);
  });

  it("makes Crewed costs reachable within a Program that plays well", () => {
    const developed = landing.plays.filter((play) =>
      play.some(({ developmentsStarted }) =>
        developmentsStarted.includes("Meridian Colossus"),
      ),
    );
    // Most Programs rich enough to develop the Meridian Colossus go on to fly Crew, more than once on average.
    expect(developed.filter(flewCrew).length).toBeGreaterThan(
      0.6 * developed.length,
    );
    const flew = landing.plays.filter(flewCrew);
    expect(
      flew.flatMap((play) => play.filter(({ crewFlown }) => crewFlown > 0))
        .length,
    ).toBeGreaterThan(1.5 * flew.length);
  });

  it("makes Supplies and Protection each worth buying, without either being an obvious yes", () => {
    // Each is worth its mass and money: Crew without it earn less.
    const leastSupplies = played("big Program: land Crew, least Supplies");
    const noProtection = played("big Program: land Crew, no Protection");
    expect(landing.science).toBeGreaterThan(1.05 * leastSupplies.science);
    expect(landing.science).toBeGreaterThan(1.02 * noProtection.science);
    // The largest Crew can't have the most of both. With the least Supplies, which leaves room for the most
    // Protection, the Supplies run out before Health does, so that Protection is wasted.
    expect(crewLostTo(leastSupplies.plays, "supplies")).toBeGreaterThan(
      5 * crewLostTo(leastSupplies.plays, "health"),
    );
    // With the most Supplies, Health runs out before the Supplies do, so some of them are wasted.
    expect(crewLostTo(landing.plays, "health")).toBeGreaterThan(
      5 * crewLostTo(landing.plays, "supplies"),
    );
  });

  it("keeps Crew out of the opening: no Crewed Mission can fly before the Meridian Colossus is developed", () => {
    const start = real.startProgram(1);
    const smallestCrew: TurnPlan = {
      mission: {
        launchVehicleId: "meridian-heavy",
        assetIds: [],
        crew: { size: 2 },
      },
    };
    const { problems, costMillions } = real.validatePlan(start, smallestCrew);
    expect(problems.join(" ")).toContain("can only carry 8 tonnes");
    // Even the smallest Crew costs more than the Program starts with.
    expect(costMillions).toBeGreaterThan(real.readProgram(start).moneyMillions);
  });
});
