import { describe, expect, it } from "vitest";
import { createSimulation, type TurnPlan } from "../simulation/simulation";
import { testCatalogue } from "../simulation/testCatalogue";
import { fitOfAdding } from "./missionFit";

const simulation = createSimulation(testCatalogue());
const program = simulation.startProgram(1);
const { moneyMillions } = simulation.readProgram(program);
/** An orbiter on a Launch Vehicle that carries 5 tonnes, leaving 3 tonnes and $1.5B of the Program's $2B. */
const orbiterMission: TurnPlan = {
  mission: { launchVehicleId: "test-vehicle", assetIds: ["test-orbiter"] },
};

function adding(addition: Parameters<typeof fitOfAdding>[4]) {
  return fitOfAdding(
    simulation,
    program,
    orbiterMission,
    moneyMillions,
    addition,
  );
}

describe("whether adding to a Mission would fit", () => {
  it("fits an Asset that fills the Launch Vehicle exactly", () => {
    expect(adding({ assetId: "test-lander" })).toEqual({
      overCapacity: false,
      overMoney: false,
    });
  });

  it("marks an Asset too heavy for what the Launch Vehicle has left", () => {
    expect(adding({ assetId: "test-rover" }).overCapacity).toBe(true);
  });

  it("marks an Asset that costs more than the Money left", () => {
    expect(adding({ assetId: "gold-orbiter" })).toEqual({
      overCapacity: false,
      overMoney: true,
    });
  });

  it("measures the cost against the Money the Program has", () => {
    const fit = fitOfAdding(
      simulation,
      program,
      orbiterMission,
      // Only enough for the orbiter and its Launch Vehicle, with nothing over for the lander.
      500,
      { assetId: "test-lander" },
    );
    expect(fit.overMoney).toBe(true);
  });

  it("marks Crew too heavy for the Launch Vehicle", () => {
    expect(adding({ crewSize: 2 }).overCapacity).toBe(true);
  });
});
