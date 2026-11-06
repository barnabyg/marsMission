import type { Catalogue } from "../catalogue/catalogue";
import { tryContingency } from "./contingency";
import type { Flight, MissionOutcome } from "./flight";
import { journeyHomeDays } from "./homeward";
import { missionEventFailed } from "./missionEventFailure";
import { roll, type MissionEvent, type Rules } from "./rules";
import type { DecisionAnswers, PlannedMission, Program } from "./types";

/*
 * What a journey home flies as, whether Crew (`journeyHome.ts`) or samples (`sampleReturn.ts`) are aboard: a `Flight`
 * that leaves Mars on the Turn's day for leaving, with no Assets aboard, and its Mission Events, each with the
 * Reliability and Contingency bought for it, flown in turn until one fails or a Decision Point waits for an answer.
 */

const capitalised = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The text of a Mission Event or Contingency of the way home, with what it carries and what carries it filled in, as
 * the data files share them between Crew and samples: `{aboard}` such as "the Crew", and `{stage}` such as "their
 * Earth return stage", each with a capital to start a sentence.
 */
export function homewardText(
  text: string,
  aboard: string,
  stage: string,
): string {
  return text
    .replaceAll("{aboard}", aboard)
    .replaceAll("{Aboard}", capitalised(aboard))
    .replaceAll("{stage}", stage)
    .replaceAll("{Stage}", capitalised(stage));
}

/** What a journey home's `Flight` has of its own: what is aboard and what becomes of it. */
type AboardHomeward =
  | "crew"
  | "crewOnBoard"
  | "cargoOnBoard"
  | "healthInFlight"
  | "suppliesOutages"
  | "suppliesLeftOn"
  | "aliveOn"
  | "stopWith"
  | "filledIn";

/**
 * The parts of a journey home's `Flight` that Crew and samples share, on the day it leaves Mars, flying what `mission`
 * bought for the way home, with no Assets aboard.
 */
export function homewardFlightBase(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  answers: DecisionAnswers,
  mission: PlannedMission,
  outcome: MissionOutcome,
): Omit<Flight, AboardHomeward> {
  const { leavesOn } = journeyHomeDays(catalogue, rules);
  const dayOf = (event: MissionEvent) => rules.dayOf(event, mission, leavesOn);
  return {
    catalogue,
    rules,
    program,
    mission,
    answers,
    assets: [],
    radiationCutPercent: 0,
    landingSite: undefined,
    freeReturn: undefined,
    outcome,
    daysHeld: 0,
    leavesMarsOn: leavesOn,
    dayOf,
    stillOnBoard: () => [],
    // Nothing aboard has a Service Life.
    shorten: () => undefined,
    cut: () => undefined,
    happened: (event) => ({
      kind: "missionEvent" as const,
      day: dayOf(event),
      eventId: event.id,
    }),
  };
}

/**
 * Flies these Mission Events of a journey home in turn, each with its Reliability and Contingency, until one fails, a
 * Decision Point waits for an answer, or `flies` says one doesn't fly, which it is asked just before each. Its Mission
 * Events on the Timeline are then marked, so that the events column and the checks of the Timeline can tell them from
 * the Mission's.
 */
export function flyHomewardEvents(
  flight: Flight,
  events: readonly MissionEvent[],
  flies: (event: MissionEvent) => boolean,
): void {
  const { rules, program } = flight;
  for (const event of events) {
    if (!flies(event)) break;
    const risk = rules.failureProbability(
      event,
      rules.reliabilityLevelFor(flight.mission, event.id),
      program,
      flight.mission,
    );
    if (roll(program.seed, program.turnNumber, event.id) >= risk) {
      flight.outcome.entries.push({
        ...flight.happened(event),
        title: event.name,
        description: flight.filledIn(event.description),
        outcome: "success",
      });
      continue;
    }
    const contingency = tryContingency(flight, event, []);
    if (contingency.kind === "rescued") continue;
    if (contingency.kind === "failed") {
      missionEventFailed(flight, event, [], contingency.used);
    }
    break;
  }
  flight.outcome.entries = flight.outcome.entries.map((entry) =>
    entry.kind === "missionEvent" ? { ...entry, homeward: true } : entry,
  );
}
