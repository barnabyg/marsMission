import type { Catalogue } from "../catalogue/catalogue";
import { tryContingency } from "./contingency";
import { endCrewFlight } from "./crewHealthInFlight";
import { startFlight, type Flight, type MissionOutcome } from "./flight";
import { goNoGoCheck } from "./goNoGo";
import { missionEventFailed } from "./missionEventFailure";
import { roll, type Rules } from "./rules";
import {
  solarParticleEventDay,
  solarParticleEventInFlight,
} from "./solarParticleEvents";
import type { DecisionAnswers, Program, TurnPlan } from "./types";

/**
 * Rolls each of the Mission's Mission Events in turn, up to the first that fails for good or the first Decision
 * Point with no answer yet. Each roll depends only on the seed, the Turn and its key, so an answer can't change another.
 *
 * Each subject of the flight has its own module: the solar particle event on the way (`solarParticleEvents.ts`), the
 * go/no-go check before a landing in a dust storm (`goNoGo.ts`), the Contingency for a Mission Event that fails
 * (`contingency.ts`), what failing for good costs (`missionEventFailure.ts`) and what the flight did to the Crew's
 * Health (`crewHealthInFlight.ts`). They share the `Flight`.
 */
export function flyMission(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
  answers: DecisionAnswers,
): MissionOutcome {
  const flight = startFlight(catalogue, rules, program, plan, answers);
  flyEvents(flight);
  endCrewFlight(flight);
  return flight.outcome;
}

function flyEvents(flight: Flight): void {
  const { rules, program, mission, outcome } = flight;
  const plannedEvents = mission ? rules.missionEventsFor(mission) : [];
  const particleDay = mission
    ? solarParticleEventDay(flight.catalogue, rules, program, mission)
    : null;

  for (const event of plannedEvents) {
    if (
      particleDay !== null &&
      outcome.solarParticleEvent === null &&
      flight.dayOf(event) > particleDay &&
      solarParticleEventInFlight(flight, particleDay)
    ) {
      return;
    }
    const risk = goNoGoCheck(
      flight,
      event,
      rules.failureProbability(
        event,
        rules.reliabilityLevelFor(mission, event.id),
        program,
        mission,
      ),
    );
    if (risk === null) return;
    const failed = roll(program.seed, program.turnNumber, event.id) < risk;
    if (!failed) {
      outcome.entries.push({
        ...flight.happened(event),
        title: event.name,
        description: flight.filledIn(event.description),
        outcome: "success",
      });
      continue;
    }

    const onBoard = flight.stillOnBoard(event);
    const contingency = tryContingency(flight, event, onBoard);
    if (contingency.kind === "rescued") continue;
    if (contingency.kind === "failed") {
      missionEventFailed(flight, event, onBoard, contingency.used);
    }
    return;
  }
  // A Mission with nothing to do on arrival still meets one on the way.
  if (particleDay !== null && outcome.solarParticleEvent === null) {
    solarParticleEventInFlight(flight, particleDay);
  }
}
