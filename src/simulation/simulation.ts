import type { Catalogue } from "../catalogue/catalogue";

export interface TurnPlan {
  /** The Turn's one Mission. */
  mission: { launchVehicleId: string; assetIds: string[] };
}

interface PlanCheck {
  costMillions: number;
  problems: string[];
}

interface OperatingAsset {
  assetId: string;
  name: string;
  kind: string;
  arrivedOn: string;
}

/** Everything about a Program in progress, as plain data. Treat it as opaque and read it through the Simulation. */
export interface Program {
  seed: number;
  turnNumber: number;
  date: string;
  moneyMillions: number;
  publicSupport: number;
  operatingAssets: OperatingAsset[];
}

interface ProgramView {
  turnNumber: number;
  date: string;
  moneyMillions: number;
  publicSupport: number;
  operatingAssets: OperatingAsset[];
  launchVehicles: { id: string; name: string; costMillions: number }[];
  assets: { id: string; name: string; kind: string; costMillions: number }[];
}

interface MissionEventEntry {
  kind: "missionEvent";
  day: number;
  eventId: string;
  title: string;
  description: string;
  outcome: "success";
}

export type TimelineEntry = MissionEventEntry;

/** What happened in a Turn, for Mission Mode to display. */
export interface Timeline {
  startDate: string;
  durationDays: number;
  mission: {
    launchDay: number;
    arrivalDay: number;
    launchVehicleName: string;
    assetNames: string[];
  };
  entries: TimelineEntry[];
}

export interface TurnResult {
  program: Program;
  timeline: Timeline;
}

export interface Simulation {
  startProgram(seed: number): Program;
  readProgram(program: Program): ProgramView;
  validatePlan(program: Program, plan: TurnPlan): PlanCheck;
  runTurn(program: Program, plan: TurnPlan): TurnResult;
}

const millisecondsPerDay = 86_400_000;

function addDays(isoDate: string, days: number): string {
  const time = Date.parse(`${isoDate}T00:00:00Z`) + days * millisecondsPerDay;
  return new Date(time).toISOString().slice(0, 10);
}

export function formatMoney(millions: number): string {
  const sign = millions < 0 ? "-" : "";
  const size = Math.abs(millions);
  if (size >= 1000) return `${sign}$${String(size / 1000)}B`;
  return `${sign}$${String(size)}M`;
}

export function createSimulation(catalogue: Catalogue): Simulation {
  function checkPlan(program: Program, plan: TurnPlan): PlanCheck {
    const { launchVehicleId, assetIds } = plan.mission;
    const problems: string[] = [];
    let costMillions = 0;

    const vehicle = catalogue.launchVehicles.find(
      (candidate) => candidate.id === launchVehicleId,
    );
    if (vehicle) costMillions += vehicle.costMillions;
    else
      problems.push(`There is no Launch Vehicle called "${launchVehicleId}".`);

    if (assetIds.length === 0) {
      problems.push("A Mission must carry at least one Asset.");
    }
    for (const assetId of assetIds) {
      const asset = catalogue.assets.find(
        (candidate) => candidate.id === assetId,
      );
      if (asset) costMillions += asset.costMillions;
      else problems.push(`There is no Asset called "${assetId}".`);
    }

    if (costMillions > program.moneyMillions) {
      problems.push(
        `This Mission costs ${formatMoney(costMillions)}, but the Program only has ${formatMoney(program.moneyMillions)}.`,
      );
    }
    return { costMillions, problems };
  }

  function dayOfEvent(eventId: string): MissionEventEntry {
    const event = catalogue.missionEvents.find(
      (candidate) => candidate.id === eventId,
    );
    if (!event) throw new Error(`Unknown Mission Event "${eventId}"`);
    const { from, days } = event.timing;
    return {
      kind: "missionEvent",
      day: from === "launch" ? days : catalogue.program.transferDays + days,
      eventId,
      title: event.name,
      description: event.description,
      outcome: "success",
    };
  }

  return {
    startProgram(seed) {
      const {
        firstLaunchWindow,
        startingMoneyMillions,
        startingPublicSupport,
      } = catalogue.program;
      return {
        seed,
        turnNumber: 1,
        date: firstLaunchWindow,
        moneyMillions: startingMoneyMillions,
        publicSupport: startingPublicSupport,
        operatingAssets: [],
      };
    },

    readProgram(program) {
      return {
        turnNumber: program.turnNumber,
        date: program.date,
        moneyMillions: program.moneyMillions,
        publicSupport: program.publicSupport,
        operatingAssets: program.operatingAssets,
        launchVehicles: catalogue.launchVehicles.map(
          ({ id, name, costMillions }) => ({ id, name, costMillions }),
        ),
        assets: catalogue.assets.map(({ id, name, kind, costMillions }) => ({
          id,
          name,
          kind,
          costMillions,
        })),
      };
    },

    validatePlan: checkPlan,

    runTurn(program, plan) {
      const { costMillions, problems } = checkPlan(program, plan);
      if (problems.length > 0) throw new Error(problems.join(" "));

      const { launchWindowIntervalDays, transferDays } = catalogue.program;
      const vehicle = catalogue.launchVehicles.find(
        (candidate) => candidate.id === plan.mission.launchVehicleId,
      );
      const assets = catalogue.assets.filter((candidate) =>
        plan.mission.assetIds.includes(candidate.id),
      );
      if (!vehicle) throw new Error("The plan has no Launch Vehicle");

      const eventIds = [
        ...vehicle.missionEvents,
        ...new Set(assets.flatMap((asset) => asset.missionEvents)),
      ];
      const entries = eventIds
        .map(dayOfEvent)
        .sort((first, second) => first.day - second.day);

      const arrivedOn = addDays(program.date, transferDays);
      return {
        program: {
          ...program,
          turnNumber: program.turnNumber + 1,
          date: addDays(program.date, launchWindowIntervalDays),
          moneyMillions: program.moneyMillions - costMillions,
          operatingAssets: [
            ...program.operatingAssets,
            ...assets.map((asset) => ({
              assetId: asset.id,
              name: asset.name,
              kind: asset.kind,
              arrivedOn,
            })),
          ],
        },
        timeline: {
          startDate: program.date,
          durationDays: launchWindowIntervalDays,
          mission: {
            launchDay: 0,
            arrivalDay: transferDays,
            launchVehicleName: vehicle.name,
            assetNames: assets.map((asset) => asset.name),
          },
          entries,
        },
      };
    },
  };
}
