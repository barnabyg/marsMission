import { createSimulation, type TurnPlan } from "./simulation";
import { testCatalogue } from "./testCatalogue";

export const sendOrbiter: TurnPlan = {
  mission: { launchVehicleId: "test-vehicle", assetIds: ["test-orbiter"] },
};

export const sendLander: TurnPlan = {
  mission: {
    launchVehicleId: "test-vehicle",
    assetIds: ["test-lander"],
    landingSiteId: "alpha-plain",
  },
};

export const skipTurn: TurnPlan = { mission: null };

export function setup() {
  const simulation = createSimulation(testCatalogue());
  return { simulation, program: simulation.startProgram(42) };
}
