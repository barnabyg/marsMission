import type { Catalogue } from "../catalogue/catalogue";
import { roll, type Asset, type Rules } from "./rules";
import type {
  DecisionAnswer,
  DecisionPoint,
  PlannedMission,
  Program,
} from "./types";
import type { TurnSummary } from "./turnSummary";
import type { DecisionPointEntry, HazardEntry } from "./timeline";
import type { Flight } from "./flight";
import { crewLoss, crewLossWarning } from "./lostCrew";
import { protectedFrom } from "./protection";

const solarParticleEventId = "solar-particle-event";

/**
 * The day of the Turn a solar particle event hits this Mission, if one does. It comes from one roll for the Turn, so
 * every Mission would meet it on the same day, and only one still on its way to Mars then does. That makes the chance
 * grow with the Duration, and a shorter Trajectory can miss one that a longer one would meet.
 */
export function solarParticleEventDay(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  mission: PlannedMission,
): number | null {
  const { chancePerDayInFlight } = catalogue.hazards.solarParticleEvent;
  // On its way means after the last Mission Event near Earth and before arriving.
  const departed = Math.max(
    0,
    ...rules
      .missionEventsFor(mission)
      .filter(({ timing }) => timing.from !== "arrival")
      .map((event) => rules.dayOf(event, mission)),
  );
  const day = Math.floor(
    roll(program.seed, program.turnNumber, solarParticleEventId) /
      chancePerDayInFlight,
  );
  return day > departed && day < rules.trajectoryFor(mission).transferDays
    ? day
    : null;
}

/** What a solar particle event does to the Assets and Crew on board, as far as the answer so far takes it. */
interface SolarParticleEventMet {
  entries: (HazardEntry | DecisionPointEntry)[];
  /** The Decision Point it raises, if it has no answer yet. */
  decisionPoint: DecisionPoint | null;
  /** How much shorter every Asset on board's Service Life is. */
  serviceLifeLossPercent: number;
  /** The Health every Crew member on board loses, after their Protection, and what it would be with none. */
  crewHealthLoss: { health: number; unprotected: number };
  /** The Public Support it costs if it loses the Assets, or null if it doesn't. */
  lostWithPublicSupport: number | null;
  summary: TurnSummary["solarParticleEvent"];
}

/**
 * What it costs those on board, such as "each Asset 15% of its Service Life and each Crew member 5 Health", or "15% of
 * each Asset's Service Life and 5 Health for each Crew member", leaving out the Assets or Crew if none are on board.
 */
function costs(
  onBoard: Asset[],
  crewOnBoard: string[],
  percent: number,
  health: number,
  each: "before" | "after",
): string {
  const parts = [
    ...(onBoard.length > 0
      ? [
          each === "before"
            ? `each Asset ${percent}% of its Service Life`
            : `${percent}% of each Asset's Service Life`,
        ]
      : []),
    ...(crewOnBoard.length > 0
      ? [
          each === "before"
            ? `each Crew member ${health} Health`
            : `${health} Health for each Crew member`,
        ]
      : []),
  ];
  return parts.join(" and ");
}

/**
 * Works out a solar particle event on its day, with the player's answer if there is one. The Crew's Protection,
 * which slows radiation's harm by `radiationCutPercent`, lessens what it costs them.
 */
function meetSolarParticleEvent(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  answer: DecisionAnswer | undefined,
  day: number,
  onBoard: Asset[],
  crewOnBoard: string[],
  radiationCutPercent: number,
): SolarParticleEventMet {
  const {
    name,
    description,
    safeModeServiceLifeLossPercent,
    damageChance,
    damageServiceLifeLossPercent,
    lossChanceIfDamaged,
    publicSupportLoss,
  } = catalogue.hazards.solarParticleEvent;
  const names = [...onBoard.map((asset) => asset.name), ...crewOnBoard].join(
    ", ",
  );
  const loss = Math.min(publicSupportLoss, program.publicSupport);
  const { safeModeLoss, hitLoss } = catalogue.crew.health.solarParticleEvent;
  const harm = (health: number) => ({
    health: Math.round(protectedFrom(health, radiationCutPercent)),
    unprotected: health,
  });
  const lossIf = { safeMode: harm(safeModeLoss), hit: harm(hitLoss) };
  const decisionEntry: DecisionPointEntry = {
    kind: "decisionPoint",
    hazard: "solarParticleEvent",
    day,
    title: `${name}: Decision Point`,
    description,
  };
  if (answer === undefined) {
    return {
      entries: [decisionEntry],
      decisionPoint: {
        id: solarParticleEventId,
        kind: "solarParticleEvent",
        day,
        title: name,
        description: `${description} On board: ${names}.`,
        assets: [...onBoard.map((asset) => asset.name), ...crewOnBoard],
        choices: [
          {
            answer: "safeMode",
            label: "Safe mode",
            riskBand: null,
            description: `Safe mode protects ${names}, but costs ${costs(onBoard, crewOnBoard, safeModeServiceLifeLossPercent, lossIf.safeMode.health, "before")}.`,
          },
          {
            answer: "carryOn",
            label: "Carry on",
            riskBand: rules.riskBandFor(damageChance),
            description: `No cost if all goes well. If the radiation hits, ${[
              ...(onBoard.length > 0
                ? [
                    `each Asset loses ${damageServiceLifeLossPercent}% of its Service Life`,
                  ]
                : []),
              ...(crewOnBoard.length > 0
                ? [`each Crew member loses ${lossIf.hit.health} Health`]
                : []),
            ].join(
              " and ",
            )}, and there's a chance of losing the Mission, which costs ${loss} Public Support.${crewLossWarning(catalogue, crewOnBoard)}`,
          },
        ],
      },
      serviceLifeLossPercent: 0,
      crewHealthLoss: { health: 0, unprotected: 0 },
      lostWithPublicSupport: null,
      summary: null,
    };
  }

  const rolled = (part: string) =>
    roll(program.seed, program.turnNumber, `${solarParticleEventId}:${part}`);
  const outcome: NonNullable<TurnSummary["solarParticleEvent"]>["outcome"] =
    answer !== "carryOn"
      ? "protected"
      : rolled("damage") >= damageChance
        ? "unharmed"
        : rolled("loss") < lossChanceIfDamaged
          ? "lost"
          : "damaged";
  const serviceLifeLossPercent =
    outcome === "protected"
      ? safeModeServiceLifeLossPercent
      : outcome === "damaged"
        ? damageServiceLifeLossPercent
        : 0;
  const crewHealthLoss =
    crewOnBoard.length === 0
      ? { health: 0, unprotected: 0 }
      : outcome === "protected"
        ? lossIf.safeMode
        : outcome === "damaged"
          ? lossIf.hit
          : { health: 0, unprotected: 0 };
  const cost = costs(
    onBoard,
    crewOnBoard,
    serviceLifeLossPercent,
    crewHealthLoss.health,
    "after",
  );
  const told: Record<typeof outcome, [title: string, text: string]> = {
    protected: [
      `${name}: safe mode`,
      `Safe mode protected ${names}, at a cost of ${cost}.`,
    ],
    unharmed: [
      `${name}: no harm done`,
      `The radiation passed without harming ${names}.`,
    ],
    damaged: [
      `${name}: damage`,
      `The radiation damaged ${names}, which cost ${costs(onBoard, crewOnBoard, serviceLifeLossPercent, crewHealthLoss.health, "before")}.`,
    ],
    lost: [
      `${name}: Mission lost`,
      `The radiation was too much for ${names}, and the Mission is lost. It costs ${loss} Public Support.`,
    ],
  };
  const [title, text] = told[outcome];
  return {
    entries: [
      decisionEntry,
      {
        kind: "hazard",
        hazard: "solarParticleEvent",
        day,
        title,
        description: text,
      },
    ],
    decisionPoint: null,
    serviceLifeLossPercent,
    crewHealthLoss,
    lostWithPublicSupport: outcome === "lost" ? loss : null,
    summary: {
      answer: answer === "carryOn" ? "carryOn" : "safeMode",
      outcome,
      assets: onBoard.map((asset) => asset.name),
      serviceLifeLossPercent,
      crew: crewOnBoard,
      crewHealthLoss: crewHealthLoss.health,
    },
  };
}

/**
 * Meets the solar particle event on its day, on the Assets and Crew still on board, and says whether the Mission stops
 * there. What it costs the Crew in Health lowers it as a blow on the day, which can kill them.
 */
export function solarParticleEventInFlight(
  flight: Flight,
  day: number,
): boolean {
  const { catalogue, rules, program, mission, answers, outcome, assets } =
    flight;
  const onBoard = assets.filter(
    (asset) => rules.deliveryDay(asset, mission) > day,
  );
  const crewOnBoard = flight.crewOnBoard(day);
  const met = meetSolarParticleEvent(
    catalogue,
    rules,
    program,
    answers[solarParticleEventId],
    day,
    onBoard,
    crewOnBoard,
    flight.radiationCutPercent,
  );
  outcome.entries.push(...met.entries);
  outcome.solarParticleEvent = { day, summary: met.summary };
  if (met.decisionPoint || met.lostWithPublicSupport !== null) {
    outcome.decisionPoint = met.decisionPoint;
    flight.stopWith(onBoard, crewOnBoard);
  }
  if (met.decisionPoint) return true;
  if (met.lostWithPublicSupport !== null) {
    outcome.failedOnDay = day;
    outcome.lostTo = catalogue.hazards.solarParticleEvent.name;
    outcome.publicSupportLost = met.lostWithPublicSupport;
    outcome.crewLost.push(
      ...crewLoss(
        crewOnBoard,
        day,
        "solarParticleEvent",
        `when the ${outcome.lostTo.toLowerCase()} lost the Mission`,
      ),
    );
    return true;
  }
  flight.cut(onBoard, met.serviceLifeLossPercent);
  if (met.crewHealthLoss.unprotected > 0) {
    outcome.crewBlows.push({
      cause: "solarParticleEvent",
      day,
      health: met.crewHealthLoss.health,
      unprotectedHealth: met.crewHealthLoss.unprotected,
      names: crewOnBoard,
    });
  }
  return false;
}
