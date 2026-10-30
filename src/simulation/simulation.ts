import type { Catalogue } from "../catalogue/catalogue";
import { restoreProgram, saveProgram, type SavedProgram } from "./saveFormat";
import type {
  FundingThresholdEntry,
  MilestoneEntry,
  MissionEventEntry,
  PlanCheck,
  PlannedMission,
  PlannedMissionEvent,
  Program,
  ProgramView,
  TurnPlan,
  TurnResult,
} from "./types";

export { corruptSave, SaveError } from "./saveFormat";
export type {
  Program,
  ProgramView,
  Timeline,
  TimelineEntry,
  TurnPlan,
  TurnResult,
  TurnSummary,
} from "./types";

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

    saveProgram,

    restoreProgram,

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
