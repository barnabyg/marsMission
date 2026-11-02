import type { Catalogue } from "../catalogue/catalogue";
import { dustStormOver } from "./dustStorms";
import {
  formatMoney,
  roll,
  type Asset,
  type Contingency,
  type LandingSite,
  type MissionEvent,
  type Rules,
} from "./rules";
import {
  meetSolarParticleEvent,
  solarParticleEventDay,
  solarParticleEventId,
} from "./solarParticleEvents";
import type {
  DecisionAnswers,
  DecisionPoint,
  DecisionPointEntry,
  HazardEntry,
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
  entries: (
    MissionEventEntry | DecisionPointEntry | HazardEntry | MissionReturnedEntry
  )[];
  failedEvent: MissionEvent | undefined;
  /** The day of the failed Mission Event, if there was one. */
  failedOnDay: number | null;
  deliveredAssets: Asset[];
  publicSupportLost: number;
  landingSite: LandingSite | undefined;
  /** What a Free-return brought back, if it did. */
  returned: { refundMillions: number; backOnDay: number } | null;
  /** The first unanswered Decision Point, which the Mission stopped at. */
  decisionPoint: DecisionPoint | null;
  /** How each Decision Point was answered, in the order they came. */
  contingencies: ContingencyUsed[];
  /** The Service Life of each Asset that something on the way cut short, which is what's left after every cut. */
  cutServiceLife: Map<Asset, number>;
  /** The Hazard that lost the Mission, if one did. */
  lostTo: string | null;
  /** A landing held off for a dust storm, if one was: its Mission Event, and how long it waited. */
  heldLanding: { eventId: string; days: number } | null;
  goNoGo: TurnSummary["goNoGo"];
  /** The solar particle event the Mission met, if it did. */
  solarParticleEvent: {
    day: number;
    summary: TurnSummary["solarParticleEvent"];
  } | null;
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
const goNoGoIdOf = (event: MissionEvent) => `go-no-go:${event.id}`;

/** The day this Mission delivers an Asset, which a landing held off for a dust storm moves later. */
export function deliveryDayOf(
  rules: Rules,
  plan: TurnPlan,
  flown: Pick<MissionOutcome, "heldLanding">,
  asset: Asset,
): number {
  const { heldLanding } = flown;
  return (
    rules.deliveryDay(asset, plan.mission) +
    (heldLanding && asset.missionEvents.includes(heldLanding.eventId)
      ? heldLanding.days
      : 0)
  );
}

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
  /** How long a landing has waited for a dust storm to pass, which moves it and everything after it. */
  let daysHeld = 0;
  const dayOf = (event: MissionEvent) => rules.dayOf(event, mission) + daysHeld;
  const stillOnBoard = (event: MissionEvent) =>
    assets.filter(
      (asset) =>
        rules.deliveryDay(asset, mission) >= rules.dayOf(event, mission),
    );
  const { landingRiskMultiplier, serviceLifeLostPerDayHeld } =
    catalogue.hazards.dustStorm;
  /** The dust storm over the Landing Site on the day this Mission Event is due, if it lands and there is one. */
  const stormOnLanding = (event: MissionEvent) => {
    if (event.failureProbability !== "landingSite" || !landingSite) return null;
    const storm = dustStormOver(catalogue, program, landingSite);
    const due = dayOf(event);
    return storm && due >= storm.fromDay && due < storm.toDay ? storm : null;
  };
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
    cutServiceLife: new Map(),
    lostTo: null,
    solarParticleEvent: null,
    heldLanding: null,
    goNoGo: null,
  };
  /** Shortens the Service Life of each of these Assets, to no less than a day. */
  const shorten = (onBoard: Asset[], to: (days: number) => number) => {
    for (const asset of onBoard) {
      const days =
        outcome.cutServiceLife.get(asset) ??
        rules.serviceLifeFor(mission, asset).days;
      outcome.cutServiceLife.set(asset, Math.max(1, Math.round(to(days))));
    }
  };
  /** Shortens the Service Life of each of these Assets by this share. */
  const cut = (onBoard: Asset[], percent: number) => {
    shorten(onBoard, (days) => (days * (100 - percent)) / 100);
  };
  const particleDay = mission
    ? solarParticleEventDay(catalogue, rules, program, mission)
    : null;
  /** Meets the solar particle event, and says whether the Mission stops there. */
  const meetParticles = (day: number): boolean => {
    const onBoard = assets.filter(
      (asset) => rules.deliveryDay(asset, mission) > day,
    );
    const met = meetSolarParticleEvent(
      catalogue,
      rules,
      program,
      answers[solarParticleEventId],
      day,
      onBoard,
    );
    outcome.entries.push(...met.entries);
    outcome.solarParticleEvent = { day, summary: met.summary };
    if (met.decisionPoint || met.lostWithPublicSupport !== null) {
      outcome.decisionPoint = met.decisionPoint;
      outcome.deliveredAssets = assets.filter(
        (asset) => !onBoard.includes(asset),
      );
    }
    if (met.decisionPoint) return true;
    if (met.lostWithPublicSupport !== null) {
      outcome.failedOnDay = day;
      outcome.lostTo = catalogue.hazards.solarParticleEvent.name;
      outcome.publicSupportLost = met.lostWithPublicSupport;
      return true;
    }
    cut(onBoard, met.serviceLifeLossPercent);
    return false;
  };
  const happened = (event: MissionEvent) => ({
    kind: "missionEvent" as const,
    day: dayOf(event),
    eventId: event.id,
  });

  for (const event of plannedEvents) {
    if (
      particleDay !== null &&
      outcome.solarParticleEvent === null &&
      dayOf(event) > particleDay &&
      meetParticles(particleDay)
    ) {
      return outcome;
    }
    const usualRisk = rules.failureProbability(
      event,
      rules.reliabilityLevelFor(mission, event.id),
      program,
      mission,
    );
    let risk = usualRisk;
    const storm = stormOnLanding(event);
    if (storm && landingSite) {
      const due = dayOf(event);
      const wait = storm.toDay - due;
      const landing = stillOnBoard(event);
      const names = landing.map((asset) => asset.name).join(", ");
      const lifeLost = Math.round(wait * serviceLifeLostPerDayHeld);
      const raisedRisk = Math.min(1, usualRisk * landingRiskMultiplier);
      outcome.entries.push({
        kind: "decisionPoint",
        day: due,
        eventId: event.id,
        hazard: "dustStorm",
        siteName: landingSite.name,
        title: `Go/no-go check at ${landingSite.name}: Decision Point`,
        description: `A dust storm is over ${landingSite.name}, with ${wait} days still to go.`,
      });
      const answer = answers[goNoGoIdOf(event)];
      if (answer === undefined) {
        outcome.decisionPoint = {
          id: goNoGoIdOf(event),
          kind: "goNoGo",
          day: due,
          title: `Go/no-go check at ${landingSite.name}`,
          description: `A dust storm is over ${landingSite.name}, with ${wait} days still to go, and ${event.name} is due. Landing: ${names}.`,
          assets: landing.map((asset) => asset.name),
          siteName: landingSite.name,
          choices: [
            {
              answer: "go",
              label: "Go",
              riskBand: rules.riskBandFor(raisedRisk),
              description: `Land now, in the storm, at a higher risk than usual.`,
            },
            {
              answer: "holdOff",
              label: "Hold off",
              riskBand: rules.riskBandFor(usualRisk),
              description: `Land in ${wait} days, once the storm has passed, at the usual risk. Waiting costs each Asset being landed ${lifeLost} days of Service Life, and its research starts later.`,
            },
          ],
        };
        outcome.deliveredAssets = assets.filter(
          (asset) => !landing.includes(asset),
        );
        return outcome;
      }
      const holdingOff = answer === "holdOff";
      outcome.goNoGo = {
        siteName: landingSite.name,
        answer: holdingOff ? "holdOff" : "go",
        daysHeld: holdingOff ? wait : 0,
        serviceLifeDaysLost: holdingOff ? lifeLost : 0,
      };
      outcome.entries.push({
        kind: "hazard",
        hazard: "dustStorm",
        day: due,
        title: holdingOff
          ? `Holding off the landing at ${landingSite.name}`
          : `Go for landing at ${landingSite.name}`,
        description: holdingOff
          ? `The landing waits ${wait} days for the storm to pass, which costs each Asset being landed ${lifeLost} days of Service Life.`
          : `Going down through the storm with ${names}.`,
      });
      if (holdingOff) {
        daysHeld += wait;
        outcome.heldLanding = { eventId: event.id, days: wait };
        shorten(landing, (days) => days - lifeLost);
      } else {
        risk = raisedRisk;
      }
    }
    const failed = roll(program.seed, program.turnNumber, event.id) < risk;
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
          kind: "contingency",
          day: dayOf(event),
          title: event.name,
          description: filledIn(contingency.troubleDescription),
          assets: onBoard.map((asset) => asset.name),
          choices: [
            {
              answer: "use",
              label: `Use ${contingency.name}`,
              riskBand: rules.riskBandFor(contingency.rescueFailureProbability),
              description: `A second try. If it works, ${lostNames} carry on with ${contingency.serviceLifeLossPercent}% less Service Life. If it fails, ${
                comesHomeFrom(event)
                  ? `they swing back to Earth, which costs ${supportCost(lossFor(event, contingency))} and refunds ${formatMoney(refundFor(onBoard))}.`
                  : `they are lost and it costs ${lossFor(event, contingency)} Public Support.`
              }`,
            },
            {
              answer: "decline",
              label: "Don't use it",
              riskBand: null,
              description: comesHomeFrom(event)
                ? `${lostNames} swing back to Earth, which costs ${supportCost(lossFor(event, undefined))} and refunds ${formatMoney(refundFor(onBoard))}.`
                : `${lostNames} are lost, and it costs ${lossFor(event, undefined)} Public Support.`,
            },
          ],
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
        cut(onBoard, contingency.serviceLifeLossPercent);
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
  // A Mission with nothing to do on arrival still meets one on the way.
  if (particleDay !== null && outcome.solarParticleEvent === null) {
    meetParticles(particleDay);
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
          ? deliveryDayOf(rules, plan, flown, asset)
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
    ...(flown.solarParticleEvent
      ? { solarParticleEventDay: flown.solarParticleEvent.day }
      : {}),
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
 * What the Turn summary says about each Decision Point. It goes by how the Mission ended, so an Asset saved
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
        serviceLifeDays: flown.cutServiceLife.get(asset) ?? 0,
      })),
  }));
}

/** What the Turn summary says about a Mission that failed, or null if none did. */
export function missionFailure(flown: MissionOutcome): TurnSummary["failure"] {
  const name = flown.failedEvent?.name ?? flown.lostTo;
  return name !== null
    ? {
        missionEventName: name,
        ...(flown.lostTo === null ? {} : { hazard: true as const }),
        assetsLost: flown.assets
          .filter((asset) => !flown.deliveredAssets.includes(asset))
          .map((asset) => asset.name),
        publicSupportLost: flown.publicSupportLost,
        returnedToEarth: flown.returned !== null,
        refundMillions: flown.returned?.refundMillions ?? 0,
      }
    : null;
}

/** The Mission as it stands on a day, with nothing in it of what happens after that. */
function missionSoFar(
  mission: Timeline["mission"],
  day: number,
): Timeline["mission"] {
  if (!mission) return null;
  const { returnsToEarth, solarParticleEventDay, ...rest } = mission;
  const failedSoFar =
    mission.failedOnDay !== null && mission.failedOnDay <= day;
  return {
    ...rest,
    failedOnDay: failedSoFar ? mission.failedOnDay : null,
    ...(returnsToEarth && failedSoFar ? { returnsToEarth } : {}),
    ...(solarParticleEventDay !== undefined && solarParticleEventDay <= day
      ? { solarParticleEventDay }
      : {}),
    assets: mission.assets.map((asset) => {
      const lostSoFar = asset.lostOnDay !== null && asset.lostOnDay <= day;
      return {
        ...asset,
        deliveredOnDay:
          asset.deliveredOnDay !== null && asset.deliveredOnDay <= day
            ? asset.deliveredOnDay
            : null,
        lostOnDay: lostSoFar ? asset.lostOnDay : null,
        crashed: lostSoFar && asset.crashed,
      };
    }),
  };
}

/**
 * What Mission Mode plays up to a Decision Point: the Mission so far, and what else happens in the Turn before that
 * day, worked out as if the answer were the cautious one. The answer can still change one thing already shown: a
 * Funding Threshold's day depends on Public Support later in the Turn, so an answer can move it, and playback carries
 * on from there.
 */
export function timelineUpToDecision(
  asIfCautious: Timeline,
  otherEntries: readonly TimelineEntry[],
  flightEntries: readonly TimelineEntry[],
  mission: Timeline["mission"],
  { day, entry }: { day: number; entry: DecisionPointEntry | null },
): Timeline {
  return {
    ...asIfCautious,
    mission: missionSoFar(mission, day),
    decisionDay: day,
    dustStorms: asIfCautious.dustStorms.filter(({ fromDay }) => fromDay <= day),
    // The sort is stable, so the Mission's entries stay first on any day, as it does on a finished Turn's Timeline.
    entries: [
      ...flightEntries.filter((flown) => flown.day <= day),
      ...otherEntries.filter((other) => other.day < day),
      ...(entry ? [entry] : []),
    ].sort((first, second) => first.day - second.day),
  };
}
