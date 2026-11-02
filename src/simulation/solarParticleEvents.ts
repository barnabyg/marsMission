import type { Catalogue } from "../catalogue/catalogue";
import { roll, type Asset, type Rules } from "./rules";
import type {
  DecisionAnswer,
  DecisionPoint,
  DecisionPointEntry,
  HazardEntry,
  PlannedMission,
  Program,
  TurnSummary,
} from "./types";

export const solarParticleEventId = "solar-particle-event";

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
      .filter(({ timing }) => timing.from === "launch")
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

/** What a solar particle event does to the Assets on board, as far as the answer so far takes it. */
export interface SolarParticleEventMet {
  entries: (HazardEntry | DecisionPointEntry)[];
  /** The Decision Point it raises, if it has no answer yet. */
  decisionPoint: DecisionPoint | null;
  /** How much shorter every Asset on board's Service Life is. */
  serviceLifeLossPercent: number;
  /** The Public Support it costs if it loses the Assets, or null if it doesn't. */
  lostWithPublicSupport: number | null;
  summary: TurnSummary["solarParticleEvent"];
}

/** Works out a solar particle event on its day, with the player's answer if there is one. */
export function meetSolarParticleEvent(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  answer: DecisionAnswer | undefined,
  day: number,
  onBoard: Asset[],
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
  const names = onBoard.map((asset) => asset.name).join(", ");
  const loss = Math.min(publicSupportLoss, program.publicSupport);
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
        assets: onBoard.map((asset) => asset.name),
        choices: [
          {
            answer: "safeMode",
            label: "Safe mode",
            riskBand: null,
            description: `${names} are protected, but each loses ${safeModeServiceLifeLossPercent}% of its Service Life.`,
          },
          {
            answer: "carryOn",
            label: "Carry on",
            riskBand: rules.riskBandFor(damageChance),
            description: `No cost if all goes well. If they're hit, each loses ${damageServiceLifeLossPercent}% of its Service Life, and there's a chance of losing them all, which costs ${loss} Public Support.`,
          },
        ],
      },
      serviceLifeLossPercent: 0,
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
  const told: Record<typeof outcome, [title: string, text: string]> = {
    protected: [
      `${name}: safe mode`,
      `${names} rode it out in safe mode, and each lost ${serviceLifeLossPercent}% of its Service Life.`,
    ],
    unharmed: [`${name}: no harm done`, `${names} carried on unharmed.`],
    damaged: [
      `${name}: damage`,
      `The radiation damaged ${names}, and each lost ${serviceLifeLossPercent}% of its Service Life.`,
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
    lostWithPublicSupport: outcome === "lost" ? loss : null,
    summary: {
      answer: answer === "carryOn" ? "carryOn" : "safeMode",
      outcome,
      assets: onBoard.map((asset) => asset.name),
      serviceLifeLossPercent,
    },
  };
}
