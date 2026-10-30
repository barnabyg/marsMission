import type { Catalogue } from "../catalogue/catalogue";

export interface TurnPlan {
  /** The Turn's one Mission, or null to let the Turn pass without launching. */
  mission: { launchVehicleId: string; assetIds: string[] } | null;
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

type ProgramStatus =
  | { kind: "active" }
  | { kind: "retired" }
  | { kind: "cancelled"; reason: string };

/** Everything about a Program in progress, as plain data. Treat it as opaque and read it through the Simulation. */
export interface Program {
  seed: number;
  turnNumber: number;
  date: string;
  moneyMillions: number;
  publicSupport: number;
  science: number;
  milestoneIds: string[];
  /** The Public Support levels of the Funding Thresholds already paid. */
  fundingThresholdsPaid: number[];
  operatingAssets: OperatingAsset[];
  status: ProgramStatus;
}

interface ProgramView {
  status: ProgramStatus;
  cancellationLevel: number;
  turnNumber: number;
  date: string;
  moneyMillions: number;
  publicSupport: number;
  science: number;
  milestones: { id: string; name: string }[];
  nextFundingThreshold: {
    publicSupport: number;
    payoutMillions: number;
    pointsAway: number;
  } | null;
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

interface MilestoneEntry {
  kind: "milestone";
  day: number;
  milestoneId: string;
  title: string;
  description: string;
}

interface FundingThresholdEntry {
  kind: "fundingThreshold";
  day: number;
  title: string;
  description: string;
}

export type TimelineEntry =
  MissionEventEntry | MilestoneEntry | FundingThresholdEntry;

interface AwardedMilestone {
  name: string;
  science: number;
  publicSupport: number;
}

/** What changed over a Turn. */
export interface TurnSummary {
  missionCostMillions: number;
  moneyStartMillions: number;
  moneyEndMillions: number;
  scienceGained: number;
  publicSupportStart: number;
  publicSupportGained: number;
  publicSupportDrained: number;
  publicSupportEnd: number;
  milestones: AwardedMilestone[];
  fundingPayouts: { publicSupport: number; payoutMillions: number }[];
  /** Why the Program was cancelled at the end of this Turn, if it was. */
  cancellationReason: string | null;
}

/** What happened in a Turn, for Mission Mode to display. */
export interface Timeline {
  startDate: string;
  durationDays: number;
  /** The Mission launched this Turn, if any. */
  mission: {
    launchDay: number;
    arrivalDay: number;
    launchVehicleName: string;
    assetNames: string[];
  } | null;
  /** The Assets already operating at Mars when the Turn began. */
  operatingAssetNames: string[];
  entries: TimelineEntry[];
}

export interface TurnResult {
  program: Program;
  timeline: Timeline;
  summary: TurnSummary;
}

export interface Simulation {
  startProgram(seed: number): Program;
  readProgram(program: Program): ProgramView;
  validatePlan(program: Program, plan: TurnPlan): PlanCheck;
  runTurn(program: Program, plan: TurnPlan): TurnResult;
  retireProgram(program: Program): Program;
}

const millisecondsPerDay = 86_400_000;

export function addDays(isoDate: string, days: number): string {
  const time = Date.parse(`${isoDate}T00:00:00Z`) + days * millisecondsPerDay;
  return new Date(time).toISOString().slice(0, 10);
}

export function formatMoney(millions: number): string {
  const sign = millions < 0 ? "-" : "";
  const size = Math.abs(millions);
  if (size >= 1000) return `${sign}$${String(size / 1000)}B`;
  return `${sign}$${String(size)}M`;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function createSimulation(catalogue: Catalogue): Simulation {
  function checkPlan(program: Program, plan: TurnPlan): PlanCheck {
    if (program.status.kind !== "active") {
      return { costMillions: 0, problems: ["This Program has ended."] };
    }
    if (!plan.mission) return { costMillions: 0, problems: [] };

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
        science: 0,
        milestoneIds: [],
        fundingThresholdsPaid: [],
        operatingAssets: [],
        status: { kind: "active" },
      };
    },

    readProgram(program) {
      const next = catalogue.fundingThresholds.find(
        ({ publicSupport }) =>
          !program.fundingThresholdsPaid.includes(publicSupport),
      );
      return {
        status: program.status,
        nextFundingThreshold: next
          ? { ...next, pointsAway: next.publicSupport - program.publicSupport }
          : null,
        cancellationLevel: catalogue.program.cancellationLevel,
        turnNumber: program.turnNumber,
        date: program.date,
        moneyMillions: program.moneyMillions,
        publicSupport: program.publicSupport,
        science: program.science,
        milestones: catalogue.milestones
          .filter(({ id }) => program.milestoneIds.includes(id))
          .map(({ id, name }) => ({ id, name })),
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

      const {
        launchWindowIntervalDays,
        transferDays,
        publicSupportDrainPercent,
        cancellationLevel,
      } = catalogue.program;

      const vehicle = catalogue.launchVehicles.find(
        (candidate) => candidate.id === plan.mission?.launchVehicleId,
      );
      const assets = (plan.mission?.assetIds ?? []).flatMap((assetId) =>
        catalogue.assets.filter((candidate) => candidate.id === assetId),
      );

      const eventIds = [
        ...(vehicle?.missionEvents ?? []),
        ...new Set(assets.flatMap((asset) => asset.missionEvents)),
      ];
      const missionEvents = eventIds.map(dayOfEvent);

      const arrivingKinds = assets.map((asset) => asset.kind);
      const awarded = catalogue.milestones.filter(
        ({ id, trigger }) =>
          !program.milestoneIds.includes(id) &&
          arrivingKinds.includes(trigger.assetKindArrives),
      );
      const scienceGained = sum(awarded.map(({ science }) => science));
      const publicSupportGained = sum(
        awarded.map(({ publicSupport }) => publicSupport),
      );
      const milestoneEntries = awarded.map((milestone): MilestoneEntry => ({
        kind: "milestone",
        day: transferDays,
        milestoneId: milestone.id,
        title: milestone.name,
        description: `${milestone.description} It awards ${milestone.science} Science and ${milestone.publicSupport} Public Support.`,
      }));

      const publicSupportBeforeDrain =
        program.publicSupport + publicSupportGained;

      const fundingPayouts = catalogue.fundingThresholds.filter(
        ({ publicSupport }) =>
          publicSupport <= publicSupportBeforeDrain &&
          !program.fundingThresholdsPaid.includes(publicSupport),
      );
      const fundingEntries = fundingPayouts.map(
        ({ publicSupport, payoutMillions }): FundingThresholdEntry => ({
          kind: "fundingThreshold",
          day: transferDays,
          title: `Funding Threshold reached: ${publicSupport} Public Support`,
          description: `The Program's backers pay out ${formatMoney(payoutMillions)}.`,
        }),
      );

      const moneyEndMillions =
        program.moneyMillions -
        costMillions +
        sum(fundingPayouts.map(({ payoutMillions }) => payoutMillions));

      // Rounding down keeps Public Support whole and means it always falls, so it can't stick above the Cancellation Level.
      const publicSupportEnd = Math.floor(
        (publicSupportBeforeDrain * (100 - publicSupportDrainPercent)) / 100,
      );
      const cancellationReason =
        publicSupportEnd < cancellationLevel
          ? `Public Support fell to ${publicSupportEnd}, below the Cancellation Level of ${cancellationLevel}.`
          : null;

      const arrivedOn = addDays(program.date, transferDays);
      return {
        program: {
          ...program,
          turnNumber: program.turnNumber + 1,
          date: addDays(program.date, launchWindowIntervalDays),
          moneyMillions: moneyEndMillions,
          publicSupport: publicSupportEnd,
          science: program.science + scienceGained,
          milestoneIds: [
            ...program.milestoneIds,
            ...awarded.map(({ id }) => id),
          ],
          fundingThresholdsPaid: [
            ...program.fundingThresholdsPaid,
            ...fundingPayouts.map(({ publicSupport }) => publicSupport),
          ],
          operatingAssets: [
            ...program.operatingAssets,
            ...assets.map((asset) => ({
              assetId: asset.id,
              name: asset.name,
              kind: asset.kind,
              arrivedOn,
            })),
          ],
          status:
            cancellationReason === null
              ? program.status
              : { kind: "cancelled", reason: cancellationReason },
        },
        timeline: {
          startDate: program.date,
          durationDays: launchWindowIntervalDays,
          mission: vehicle
            ? {
                launchDay: 0,
                arrivalDay: transferDays,
                launchVehicleName: vehicle.name,
                assetNames: assets.map((asset) => asset.name),
              }
            : null,
          operatingAssetNames: program.operatingAssets.map(
            (asset) => asset.name,
          ),
          // The sort is stable, so an award stays after the arrival that earned it.
          entries: [
            ...missionEvents,
            ...milestoneEntries,
            ...fundingEntries,
          ].sort((first, second) => first.day - second.day),
        },
        summary: {
          missionCostMillions: costMillions,
          moneyStartMillions: program.moneyMillions,
          moneyEndMillions,
          scienceGained,
          publicSupportStart: program.publicSupport,
          publicSupportGained,
          publicSupportDrained: publicSupportBeforeDrain - publicSupportEnd,
          publicSupportEnd,
          milestones: awarded.map(({ name, science, publicSupport }) => ({
            name,
            science,
            publicSupport,
          })),
          fundingPayouts,
          cancellationReason,
        },
      };
    },

    retireProgram(program) {
      if (program.status.kind !== "active") {
        throw new Error("This Program has ended.");
      }
      return { ...program, status: { kind: "retired" } };
    },
  };
}
