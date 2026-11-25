import { storageKeyFor } from "../src/save/saveStore";
import * as first from "./seeds";
import * as colossus from "./colossusSeeds";
import * as samples from "./sampleSeeds";

const refuel =
  "Choose Meridian Colossus, Pathfinder Orbiter, Prospector Lander and Trailblazer Rover. Keep Jezero Crater and the default Reliability.";
const crewHome =
  "Tick Bring Crew home under Operating at Mars, then End Turn without launching.";
const samplesHome =
  "Tick Send the samples at Jezero Crater home, then End Turn without launching.";
const refuellingFlight = (name: string, seed: number) => ({
  name,
  instructions: refuel,
  save: colossus.colossusBuiltSave(seed),
});
const sampleFailure = (name: string, event: string) => ({
  name,
  instructions: samplesHome,
  save: samples.samplesReadySave(samples.sampleFailureSeed(event)),
});
const scenarios = [
  refuellingFlight("Orbital refuelling", colossus.colossusSeed),
  refuellingFlight("Tanker launch failure", colossus.tankerFailureSeed),
  refuellingFlight("Docking collision", colossus.rendezvousFailureSeed),
  refuellingFlight("Transfer cutoff", colossus.transferFailureSeed),
  {
    name: "Kick stage decision",
    instructions:
      "Choose Pathfinder Orbiter on the Meridian Medium and buy the Kick stage. At the Decision Point, use it to rescue the transfer or decline to see the cutoff.",
    seed: first.kickStageRescuedSeed,
  },
  {
    name: "Orbiter capture",
    instructions: "Choose Pathfinder Orbiter on the Meridian Medium.",
    seed: first.successSeed,
  },
  {
    name: "Orbiter flyby",
    instructions: "Choose Pathfinder Orbiter on the Meridian Medium.",
    seed: first.seedFailingAt("Mars orbit insertion"),
  },
  {
    name: "Free-return",
    instructions:
      "Choose Pathfinder Orbiter and the Free-return Trajectory. Add Reserve fuel to see the Decision Point and decline it to fly home.",
    seed: first.freeReturnSeed,
  },
  {
    name: "Surface delivery",
    instructions:
      "Choose Prospector Lander on the Meridian Medium and keep Jezero Crater.",
    seed: first.landingSeed,
  },
  {
    name: "Surface crash",
    instructions:
      "Choose Prospector Lander on the Meridian Medium and keep Jezero Crater.",
    seed: first.crashSeed,
  },
  {
    name: "Landing decision",
    instructions:
      "Choose Prospector Lander on the Meridian Medium and keep Jezero Crater. Hold off at the dust storm and watch the landing once it clears.",
    seed: first.holdOffSeed,
  },
  {
    name: "Crew landing",
    instructions:
      "Choose Meridian Colossus and Crewed Mission. Send the smallest Crew on a round trip to Jezero Crater with Light shielding. Look for the Wellspring Fuel Plant at touchdown.",
    save: colossus.fuelPlantLandedSave(colossus.ascentSeed),
  },
  {
    name: "Samples home",
    instructions: samplesHome,
    save: samples.samplesReadySave(samples.sampleReturnSeed),
  },
  {
    name: "Crew home from the surface",
    instructions: crewHome,
    save: colossus.roundTripLandedSave(colossus.ascentSeed),
  },
  {
    name: "Crew home from Mars orbit",
    instructions: crewHome,
    save: colossus.roundTripThereSave(colossus.roundTripSeed),
  },
  sampleFailure("Failed sample ascent", "Mars ascent"),
  sampleFailure("Failed Mars rendezvous", "Mars orbit rendezvous"),
  sampleFailure("Failed departure", "Trans-Earth injection"),
  sampleFailure("Failed Earth entry", "Earth entry"),
  {
    name: "Backup engine decision",
    instructions: samplesHome,
    save: samples.sampleDepartureDecisionSave(),
  },
];

export const journeyPlaytest = { key: storageKeyFor("automatic"), scenarios };
