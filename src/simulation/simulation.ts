import { z } from "zod";
import { isoDate, type Catalogue } from "../catalogue/catalogue";

interface PlannedMission {
  launchVehicleId: string;
  assetIds: string[];
  /** The Reliability level bought for each Mission Event, by id. Any left out get the cheapest level. */
  reliability?: Record<string, string>;
}

export interface TurnPlan {
  /** The Turn's one Mission, or null to let the Turn pass without launching. */
  mission: PlannedMission | null;
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

export interface ProgramView {
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
  outcome: "success" | "failure";
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
  /** The Mission Event that ended this Turn's Mission and what that cost, if one failed. */
  failure: {
    missionEventName: string;
    assetsLost: string[];
    publicSupportLost: number;
  } | null;
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
    /** The day a Mission Event failed and the journey stopped, if one did. */
    failedOnDay: number | null;
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

/** A Mission Event as Planning Mode shows it: a rough risk band, never the exact probability. */
interface PlannedMissionEvent {
  eventId: string;
  name: string;
  riskBand: string;
  reliabilityLevelId: string;
  reliabilityLevels: {
    id: string;
    name: string;
    costMillions: number;
    riskBand: string;
  }[];
}

/** A Program as data, for keeping between sessions. */
interface SavedProgram {
  formatVersion: number;
  program: Program;
}

/** Thrown when a save can't be restored. The message is written for the player. */
export class SaveError extends Error {
  override name = "SaveError";
}

/** Released saves are a compatibility contract: to change this shape, add a new version and keep reading this one. */
const saveFormatVersion = 1;

const count = z.number().int().nonnegative();

const savedProgramSchema = z.strictObject({
  seed: z.number().int(),
  turnNumber: z.number().int().positive(),
  date: isoDate,
  moneyMillions: count,
  publicSupport: count,
  science: count,
  milestoneIds: z.array(z.string()),
  fundingThresholdsPaid: z.array(count),
  operatingAssets: z.array(
    z.strictObject({
      assetId: z.string(),
      name: z.string(),
      kind: z.string(),
      arrivedOn: isoDate,
    }),
  ),
  status: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("active") }),
    z.strictObject({ kind: z.literal("retired") }),
    z.strictObject({ kind: z.literal("cancelled"), reason: z.string() }),
  ]),
});

export const corruptSave = "This save is corrupt, so it can't be loaded.";

export interface Simulation {
  startProgram(seed: number): Program;
  /** A Program as data that can be kept and given to restoreProgram later. */
  saveProgram(program: Program): SavedProgram;
  /** The Program in a save, which plays on as if it was never saved. Throws a SaveError if it can't be continued. */
  restoreProgram(saved: unknown): Program;
  readProgram(program: Program): ProgramView;
  validatePlan(program: Program, plan: TurnPlan): PlanCheck;
  /** The Mission Events a Mission would go through, in order. Ids that aren't in the catalogue are skipped. */
  previewMission(mission: PlannedMission): PlannedMissionEvent[];
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

/**
 * A number from 0 up to 1 for one Mission Event's failure roll. It depends only on these three
 * values, so changing anything about another Mission Event can't change this roll. The hash is
 * FNV-1a followed by MurmurHash3's finaliser, which spreads out similar inputs such as adjacent seeds.
 */
function missionEventRoll(
  seed: number,
  turnNumber: number,
  eventId: string,
): number {
  let hash = 0x811c9dc5;
  for (const character of `${seed}:${turnNumber}:${eventId}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 2 ** 32;
}

export function createSimulation(catalogue: Catalogue): Simulation {
  function checkPlan(program: Program, plan: TurnPlan): PlanCheck {
    if (program.status.kind !== "active") {
      return { costMillions: 0, problems: ["This Program has ended."] };
    }
    if (!plan.mission) return { costMillions: 0, problems: [] };

    const { launchVehicleId, assetIds, reliability = {} } = plan.mission;
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

    const plannedEvents = missionEventsFor(launchVehicleId, assetIds);
    for (const [eventId, levelId] of Object.entries(reliability)) {
      if (!plannedEvents.some((event) => event.id === eventId)) {
        problems.push(`This Mission has no Mission Event called "${eventId}".`);
      }
      if (!catalogue.reliabilityLevels.some((level) => level.id === levelId)) {
        problems.push(`There is no Reliability level called "${levelId}".`);
      }
    }
    costMillions += sum(
      plannedEvents.map(
        (event) => reliabilityLevelFor(plan.mission, event.id).costMillions,
      ),
    );

    if (costMillions > program.moneyMillions) {
      problems.push(
        `This Mission costs ${formatMoney(costMillions)}, but the Program only has ${formatMoney(program.moneyMillions)}.`,
      );
    }
    return { costMillions, problems };
  }

  function dayOf({ timing }: Catalogue["missionEvents"][number]): number {
    return timing.from === "launch"
      ? timing.days
      : catalogue.program.transferDays + timing.days;
  }

  /** The level a Mission has bought for a Mission Event, which is the cheapest unless it chose another. */
  function reliabilityLevelFor(
    mission: PlannedMission | null,
    eventId: string,
  ): Catalogue["reliabilityLevels"][number] {
    const { reliabilityLevels } = catalogue;
    const chosenId = mission?.reliability?.[eventId];
    const level =
      reliabilityLevels.find(({ id }) => id === chosenId) ??
      reliabilityLevels[0];
    // The Catalogue guarantees at least one level.
    if (!level) throw new Error("The catalogue has no Reliability levels");
    return level;
  }

  /** The one calculation behind both a Mission Event's roll and the risk band Planning Mode shows. */
  function failureProbability(
    event: Catalogue["missionEvents"][number],
    level: Catalogue["reliabilityLevels"][number],
  ): number {
    return event.failureProbability * level.failureMultiplier;
  }

  function riskBandFor(probability: number): string {
    const band = catalogue.riskBands.find(({ upTo }) => probability <= upTo);
    // The Catalogue guarantees the last band goes up to 1.
    if (!band) throw new Error(`No risk band covers ${probability}`);
    return band.label;
  }

  /** The Mission Events a Mission goes through, in the order they happen. */
  function missionEventsFor(
    launchVehicleId: string,
    assetIds: string[],
  ): Catalogue["missionEvents"] {
    const vehicle = catalogue.launchVehicles.find(
      (candidate) => candidate.id === launchVehicleId,
    );
    const assets = catalogue.assets.filter((asset) =>
      assetIds.includes(asset.id),
    );
    const eventIds = new Set([
      ...(vehicle?.missionEvents ?? []),
      ...assets.flatMap((asset) => asset.missionEvents),
    ]);
    return [...eventIds]
      .flatMap((eventId) =>
        catalogue.missionEvents.filter((event) => event.id === eventId),
      )
      .sort((first, second) => dayOf(first) - dayOf(second));
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

    saveProgram(program) {
      return { formatVersion: saveFormatVersion, program };
    },

    restoreProgram(saved) {
      // Only the version is checked first, because another format may have any other shape.
      const version = z
        .looseObject({ formatVersion: z.number() })
        .safeParse(saved);
      if (!version.success) throw new SaveError(corruptSave);
      const { formatVersion } = version.data;
      if (formatVersion !== saveFormatVersion) {
        throw new SaveError(
          `This save is in format ${formatVersion}, which this version of the game can't read.`,
        );
      }
      const restored = savedProgramSchema.safeParse(version.data.program);
      if (!restored.success) throw new SaveError(corruptSave);
      if (restored.data.status.kind !== "active") {
        throw new SaveError(
          "This Program has ended, so it can't be continued.",
        );
      }
      return restored.data;
    },

    readProgram(program) {
      const nextThreshold = catalogue.fundingThresholds.find(
        ({ publicSupport }) =>
          !program.fundingThresholdsPaid.includes(publicSupport),
      );
      return {
        status: program.status,
        nextFundingThreshold: nextThreshold
          ? {
              ...nextThreshold,
              pointsAway: nextThreshold.publicSupport - program.publicSupport,
            }
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

    previewMission(mission) {
      return missionEventsFor(mission.launchVehicleId, mission.assetIds).map(
        (event) => {
          const chosen = reliabilityLevelFor(mission, event.id);
          return {
            eventId: event.id,
            name: event.name,
            riskBand: riskBandFor(failureProbability(event, chosen)),
            reliabilityLevelId: chosen.id,
            reliabilityLevels: catalogue.reliabilityLevels.map((level) => ({
              id: level.id,
              name: level.name,
              costMillions: level.costMillions,
              riskBand: riskBandFor(failureProbability(event, level)),
            })),
          };
        },
      );
    },

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

      const plannedEvents = plan.mission
        ? missionEventsFor(plan.mission.launchVehicleId, plan.mission.assetIds)
        : [];
      const failedIndex = plannedEvents.findIndex(
        (event) =>
          missionEventRoll(program.seed, program.turnNumber, event.id) <
          failureProbability(
            event,
            reliabilityLevelFor(plan.mission, event.id),
          ),
      );
      const failedEvent = plannedEvents[failedIndex];
      const assetNames = assets.map((asset) => asset.name);
      const publicSupportLost = failedEvent
        ? Math.min(failedEvent.publicSupportLoss, program.publicSupport)
        : 0;

      const missionEvents = plannedEvents
        .slice(0, failedEvent ? failedIndex + 1 : undefined)
        .map((event): MissionEventEntry =>
          event === failedEvent
            ? {
                kind: "missionEvent",
                day: dayOf(event),
                eventId: event.id,
                title: `${event.name} failed`,
                description: `${event.failureDescription} Lost with the Mission: ${assetNames.join(", ")}. It costs ${publicSupportLost} Public Support.`,
                outcome: "failure",
              }
            : {
                kind: "missionEvent",
                day: dayOf(event),
                eventId: event.id,
                title: event.name,
                description: event.description,
                outcome: "success",
              },
        );

      const deliveredAssets = failedEvent ? [] : assets;
      const arrivingKinds = deliveredAssets.map((asset) => asset.kind);
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
        program.publicSupport - publicSupportLost + publicSupportGained;

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

      // Public Support is whole points. Rounding down means it always falls, where rounding to the nearest point could stick at a low value.
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
            ...deliveredAssets.map((asset) => ({
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
                assetNames,
                failedOnDay: failedEvent ? dayOf(failedEvent) : null,
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
          failure: failedEvent
            ? {
                missionEventName: failedEvent.name,
                assetsLost: assetNames,
                publicSupportLost,
              }
            : null,
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
