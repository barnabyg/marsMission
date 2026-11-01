import type { Catalogue } from "../catalogue/catalogue";
import {
  formatMoney,
  roll,
  type Asset,
  type Contingency,
  type LandingSite,
  type MissionEvent,
  type Rules,
} from "./rules";
import type {
  DecisionAnswers,
  DecisionPoint,
  DecisionPointEntry,
  MissionAsset,
  MissionEventEntry,
  MissionReturnedEntry,
  Program,
  Timeline,
  TimelineEntry,
  TurnPlan,
  TurnSummary,
} from "./types";

/** One Decision Point and how it was answered, with the Assets that came through it. */
type ContingencyUsed = Omit<TurnSummary["contingencies"][number], "assets"> & {
  saved: Asset[];
};

/** What happened to the Turn's Mission, if there was one, as far as the answers so far take it. */
export interface MissionOutcome {
  vehicleName: string | null;
  assets: Asset[];
  /** The Mission Events that happened, ending with the one that failed if one did. */
  entries: (MissionEventEntry | DecisionPointEntry | MissionReturnedEntry)[];
  failedEvent: MissionEvent | undefined;
  /** The day of the failed Mission Event, if there was one. */
  failedOnDay: number | null;
  deliveredAssets: Asset[];
  publicSupportLost: number;
  landingSite: LandingSite | undefined;
  /** What a Free-return brought back, if it did. */
  returned: { refundMillions: number; backOnDay: number } | null;
  /** The first unanswered Decision Point, which the flight stopped at. */
  decisionPoint: DecisionPoint | null;
  /** How each Decision Point was answered, in the order they came. */
  contingencies: ContingencyUsed[];
  /** The Service Life of each Asset that a Contingency saved, which is what's left after every rescue it needed. */
  rescuedServiceLife: Map<Asset, number>;
}

// Slow to create, and balance runs fly a great many Missions.
const listOfKinds = new Intl.ListFormat("en");

/** What is landing, to start a sentence, such as "The rover". Always in the Catalogue's order, whatever order the Mission lists them. */
function whatLands(catalogue: Catalogue, assets: Asset[]): string {
  const kinds = catalogue.assets
    .filter((asset) => asset.landsAtSite && assets.includes(asset))
    .map(({ kind }) => `the ${kind}`);
  const named = listOfKinds.format(new Set(kinds));
  return named.charAt(0).toUpperCase() + named.slice(1);
}

const decisionIdOf = (event: MissionEvent) => `contingency:${event.id}`;

/**
 * Rolls each of the Mission's Mission Events in turn, up to the first that fails for good or the first Decision
 * Point with no answer yet. Each roll depends only on the seed, the Turn and its key, so an answer can't change another.
 */
export function flyMission(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
  answers: DecisionAnswers,
): MissionOutcome {
  const { mission } = plan;
  const vehicle = catalogue.launchVehicles.find(
    (candidate) => candidate.id === mission?.launchVehicleId,
  );
  const assets = (mission?.assetIds ?? []).flatMap((assetId) =>
    catalogue.assets.filter((candidate) => candidate.id === assetId),
  );
  const landingSite = rules.landingSiteById(mission?.landingSiteId);
  const filledIn = (text: string) =>
    text
      .replaceAll("{site}", landingSite?.name ?? "")
      .replaceAll("{lander}", whatLands(catalogue, assets));
  const plannedEvents = mission ? rules.missionEventsFor(mission) : [];
  const dayOf = (event: MissionEvent) => rules.dayOf(event, mission);
  const stillOnBoard = (event: MissionEvent) =>
    assets.filter((asset) => rules.deliveryDay(asset, mission) >= dayOf(event));
  const { freeReturn } = rules.trajectoryFor(mission);
  /** Whether failing this Mission Event brings the Mission home. */
  const comesHomeFrom = (event: MissionEvent) =>
    freeReturn?.arrivalBurn === event.id;
  const lossFor = (event: MissionEvent, used: Contingency | undefined) =>
    Math.min(
      (comesHomeFrom(event) ? 0 : event.publicSupportLoss) +
        (used?.extraPublicSupportLoss ?? 0),
      program.publicSupport,
    );
  const refundFor = (onBoard: Asset[]) =>
    Math.round(
      (onBoard.reduce((total, asset) => total + asset.costMillions, 0) *
        (freeReturn?.refundPercent ?? 0)) /
        100,
    );
  const supportCost = (loss: number) =>
    loss > 0 ? `${loss} Public Support` : "no Public Support";

  const outcome: MissionOutcome = {
    vehicleName: vehicle?.name ?? null,
    assets,
    entries: [],
    failedEvent: undefined,
    failedOnDay: null,
    deliveredAssets: assets,
    publicSupportLost: 0,
    landingSite,
    returned: null,
    decisionPoint: null,
    contingencies: [],
    rescuedServiceLife: new Map(),
  };
  const happened = (event: MissionEvent) => ({
    kind: "missionEvent" as const,
    day: dayOf(event),
    eventId: event.id,
  });

  for (const event of plannedEvents) {
    const failed =
      roll(program.seed, program.turnNumber, event.id) <
      rules.failureProbability(
        event,
        rules.reliabilityLevelFor(mission, event.id),
        program,
        mission,
      );
    if (!failed) {
      outcome.entries.push({
        ...happened(event),
        title: event.name,
        description: filledIn(event.description),
        outcome: "success",
      });
      continue;
    }

    const onBoard = stillOnBoard(event);
    const lostNames = onBoard.map((asset) => asset.name).join(", ");
    const contingency = rules.contingencyFor(mission, event.id);
    if (contingency) {
      outcome.entries.push({
        kind: "decisionPoint",
        day: dayOf(event),
        eventId: event.id,
        title: `${event.name}: Decision Point`,
        description: filledIn(contingency.troubleDescription),
      });
      const answer = answers[decisionIdOf(event)];
      if (answer === undefined) {
        outcome.decisionPoint = {
          id: decisionIdOf(event),
          day: dayOf(event),
          missionEventName: event.name,
          contingencyName: contingency.name,
          description: filledIn(contingency.troubleDescription),
          use: {
            riskBand: rules.riskBandFor(contingency.rescueFailureProbability),
            description: `A second try. If it works, ${lostNames} carry on with ${contingency.serviceLifeLossPercent}% less Service Life. If it fails, ${
              comesHomeFrom(event)
                ? `they swing back to Earth, which costs ${supportCost(lossFor(event, contingency))} and refunds ${formatMoney(refundFor(onBoard))}.`
                : `they are lost and it costs ${lossFor(event, contingency)} Public Support.`
            }`,
          },
          decline: {
            description: comesHomeFrom(event)
              ? `${lostNames} swing back to Earth, which costs ${supportCost(lossFor(event, undefined))} and refunds ${formatMoney(refundFor(onBoard))}.`
              : `${lostNames} are lost, and it costs ${lossFor(event, undefined)} Public Support.`,
          },
        };
        outcome.deliveredAssets = assets.filter(
          (asset) => !onBoard.includes(asset),
        );
        return outcome;
      }
      if (
        answer === "use" &&
        roll(program.seed, program.turnNumber, decisionIdOf(event)) >=
          contingency.rescueFailureProbability
      ) {
        for (const asset of onBoard) {
          const days =
            outcome.rescuedServiceLife.get(asset) ??
            rules.serviceLifeFor(mission, asset).days;
          outcome.rescuedServiceLife.set(
            asset,
            Math.max(
              1,
              Math.round(
                (days * (100 - contingency.serviceLifeLossPercent)) / 100,
              ),
            ),
          );
        }
        outcome.contingencies.push({
          missionEventName: event.name,
          contingencyName: contingency.name,
          answer,
          rescued: true,
          saved: onBoard,
        });
        outcome.entries.push({
          ...happened(event),
          title: `${event.name}: saved by ${contingency.name}`,
          description: `${filledIn(contingency.rescueDescription)} ${lostNames} lost ${contingency.serviceLifeLossPercent}% of their Service Life.`,
          outcome: "success",
        });
        continue;
      }
      outcome.contingencies.push({
        missionEventName: event.name,
        contingencyName: contingency.name,
        answer,
        rescued: false,
        saved: [],
      });
    }

    // An Asset is delivered when its last Mission Event succeeds, so anything delivered before a failure is safe.
    const used =
      answers[decisionIdOf(event)] === "use" ? contingency : undefined;
    outcome.failedEvent = event;
    outcome.failedOnDay = dayOf(event);
    outcome.deliveredAssets = assets.filter(
      (asset) => !onBoard.includes(asset),
    );
    outcome.publicSupportLost = lossFor(event, used);
    const safe =
      outcome.deliveredAssets.length > 0
        ? ` Still safe: ${outcome.deliveredAssets.map((asset) => asset.name).join(", ")}.`
        : "";
    const tried = used ? ` ${used.name} couldn't save it.` : "";
    if (freeReturn && comesHomeFrom(event)) {
      const refundMillions = refundFor(onBoard);
      const backOnDay = dayOf(event) + freeReturn.returnDays;
      outcome.returned = { refundMillions, backOnDay };
      outcome.entries.push(
        {
          ...happened(event),
          title: `${event.name} failed`,
          description: `${freeReturn.description}${tried} Coming back with the Mission: ${lostNames}.${safe} It costs ${supportCost(outcome.publicSupportLost)} and refunds ${formatMoney(refundMillions)}.`,
          outcome: "failure",
          returningToEarth: true,
        },
        {
          kind: "missionReturned",
          day: backOnDay,
          title: "Mission back at Earth",
          description: `${lostNames} came back to Earth, and won't fly again.`,
        },
      );
      return outcome;
    }
    outcome.entries.push({
      ...happened(event),
      title: `${event.name} failed`,
      description: `${filledIn(event.failureDescription)}${tried} Lost with the Mission: ${lostNames}.${safe} It costs ${outcome.publicSupportLost} Public Support.`,
      outcome: "failure",
    });
    return outcome;
  }
  return outcome;
}

/** The Mission as Mission Mode displays it, or null if nothing launched. */
export function missionOnTimeline(
  rules: Rules,
  plan: TurnPlan,
  flown: MissionOutcome,
): Timeline["mission"] {
  if (flown.vehicleName === null) return null;
  return {
    launchDay: 0,
    arrivalDay: rules.trajectoryFor(plan.mission).transferDays,
    launchVehicleName: flown.vehicleName,
    assetNames: flown.assets.map((asset) => asset.name),
    assets: flown.assets.map((asset): MissionAsset => {
      const delivered = flown.deliveredAssets.includes(asset);
      return {
        name: asset.name,
        kind: asset.kind,
        landingSiteName: asset.landsAtSite
          ? (flown.landingSite?.name ?? null)
          : null,
        deliveredOnDay: delivered
          ? rules.deliveryDay(asset, plan.mission)
          : null,
        lostOnDay: delivered ? null : flown.failedOnDay,
        crashed:
          !delivered &&
          asset.landsAtSite === true &&
          flown.failedEvent !== undefined &&
          asset.missionEvents.includes(flown.failedEvent.id),
      };
    }),
    failedOnDay: flown.failedOnDay,
    ...(flown.returned && flown.failedOnDay !== null
      ? {
          returnsToEarth: {
            fromDay: flown.failedOnDay,
            backOnDay: flown.returned.backOnDay,
          },
        }
      : {}),
  };
}

/**
 * What the Turn summary says about each Decision Point. It goes by how the flight ended, so an Asset saved
 * and then lost to a later Mission Event isn't listed, and one saved twice shows the Service Life it ended with.
 */
export function contingenciesAnswered(
  flown: MissionOutcome,
): TurnSummary["contingencies"] {
  return flown.contingencies.map(({ saved, ...answered }) => ({
    ...answered,
    assets: saved
      .filter((asset) => flown.deliveredAssets.includes(asset))
      .map((asset) => ({
        name: asset.name,
        serviceLifeDays: flown.rescuedServiceLife.get(asset) ?? 0,
      })),
  }));
}

/** What the Turn summary says about a Mission that failed, or null if none did. */
export function missionFailure(flown: MissionOutcome): TurnSummary["failure"] {
  return flown.failedEvent
    ? {
        missionEventName: flown.failedEvent.name,
        assetsLost: flown.assets
          .filter((asset) => !flown.deliveredAssets.includes(asset))
          .map((asset) => asset.name),
        publicSupportLost: flown.publicSupportLost,
        returnedToEarth: flown.returned !== null,
        refundMillions: flown.returned?.refundMillions ?? 0,
      }
    : null;
}

const partOfTheFlight = ({ kind }: TimelineEntry) =>
  kind === "missionEvent" || kind === "decisionPoint";

/**
 * What Mission Mode plays up to a Decision Point: the flight so far, and what else happens in the Turn before that
 * day, worked out as if the answer were no. The answer can still change one thing already shown: a Funding Threshold's
 * day depends on Public Support later in the Turn, so an answer can move it, and playback carries on from there.
 */
export function timelineUpToDecision(
  asIfDeclined: Timeline,
  flown: MissionOutcome & { decisionPoint: DecisionPoint },
  mission: Timeline["mission"],
): Timeline {
  const { day } = flown.decisionPoint;
  return {
    ...asIfDeclined,
    mission,
    decisionDay: day,
    // The sort is stable, so the flight stays first on any day, as it does on a finished Turn's Timeline.
    entries: [
      ...flown.entries,
      ...asIfDeclined.entries.filter(
        (entry) => entry.day < day && !partOfTheFlight(entry),
      ),
    ].sort((first, second) => first.day - second.day),
  };
}
