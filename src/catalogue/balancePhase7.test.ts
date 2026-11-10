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
  // Played here, as the test that compares them all would take longer than a test may.
  const leastSupplies = played("big Program: land Crew, least Supplies");
  const noProtection = played("big Program: land Crew, no Protection");
  const neither = played(
    "big Program: land Crew, no Protection, least Supplies",
  );
  // Played here, as a test that plays several would take longer than a test may now that base funding keeps more
  // Programs going for longer.
  for (const name of [
    "big Program: develop the Meridian Colossus and fly Crew when rich",
    "big Program: fill the Meridian Heavy when rich",
  ]) {
    played(name);
  }

  it("makes flying Crew the better choice in some strategies and not in others", () => {
    // Crew who land, with Field research and the Milestones, are worth what they cost.
    expect(landing.science).toBeGreaterThan(1.05 * robotic.science);
    // A bold choice since base funding and the Bailout, which rescue robotic Programs more often than ones that spent on
    // Crew, as one Bailout refunds a lost robotic Mission but can't buy back the Public Support that lost Crew cost.
    expect(landing.cancelled).toBeLessThan(robotic.cancelled + 0.13);
    // Crew kept in Mars orbit are not: the same money on Assets earns more.
    const inOrbit = played(
      "big Program: develop the Meridian Colossus and fly Crew when rich",
    );
    expect(inOrbit.science).toBeLessThan(robotic.science);
    // Either way, Crew cost money that Assets would have earned back in Research Grants.
    expect(landing.money).toBeLessThan(robotic.money);
  });

  it("makes the Meridian Colossus do better than filling the Meridian Heavy in a big Program that lands Crew", () => {
    const heavy = played("big Program: fill the Meridian Heavy when rich");
    expect(landing.science).toBeGreaterThan(1.03 * heavy.science);
    expect(landing.cancelled).toBeLessThan(heavy.cancelled + 0.13);
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
    // The largest Crew can't have the most of both. With Protection, Crew live long enough to use the most Supplies,
    // which pay for themselves: the least Supplies run out before Health does, so they earn less Science and money.
    expect(landing.science).toBeGreaterThan(1.03 * leastSupplies.science);
    expect(landing.money).toBeGreaterThan(leastSupplies.money);
    expect(crewLostTo(leastSupplies.plays, "supplies")).toBeGreaterThan(
      3 * crewLostTo(leastSupplies.plays, "health"),
    );
    expect(crewLostTo(landing.plays, "health")).toBeGreaterThan(
      5 * crewLostTo(landing.plays, "supplies"),
    );
    // Without Protection, Health runs out about when the least Supplies do, so more Supplies earn nothing: about even in
    // money since the Bailout.
    expect(neither.science).toBeGreaterThan(noProtection.science);
    expect(neither.money).toBeGreaterThan(0.95 * noProtection.money);
    // The same goes for Protection: worth it with the Supplies to live on, and wasted without them.
    expect(landing.science).toBeGreaterThan(1.02 * noProtection.science);
    expect(landing.money).toBeGreaterThan(noProtection.money);
    expect(neither.science).toBeGreaterThan(leastSupplies.science);
    expect(neither.money).toBeGreaterThan(leastSupplies.money);
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
