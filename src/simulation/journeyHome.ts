import type { Catalogue } from "../catalogue/catalogue";
import { tryContingency } from "./contingency";
import type { CrewMemberAtMars } from "./crewPlaces";
import { journeyHomeDays } from "./earthReturnStages";
import { outcomeBefore, type Flight, type MissionOutcome } from "./flight";
import { drainsInFlight, drainsWithoutSupplies, healthCourse } from "./health";
import { healthRanOut } from "./lostCrew";
import { missionEventFailed } from "./missionEventFailure";
import { radiationCutOf } from "./protection";
import { roll, type Rules } from "./rules";
import {
  settleSupplies,
  suppliesCourse,
  type Outage,
  type SettledSupplies,
  type SuppliesUser,
} from "./supplies";
import type {
  DecisionAnswers,
  EarthReturnStage,
  PlannedMission,
  Program,
} from "./types";

/**
 * A journey home: round-trip Crew leaving Mars orbit aboard their Earth return stage on the Turn's day for leaving Mars,
 * through the Mission Events of the way home, each with the Reliability and Contingency bought for it with their
 * Mission, to Earth. It flies as a `Flight` of its own, with the Crew aboard and no Assets, so a Mission Event that
 * fails and its Contingency work as they do on the way to Mars (`contingency.ts`, `missionEventFailure.ts`): a failure
 * loses the Crew aboard. Radiation and having no Supplies lower their Health on the way, as on the way out, with each
 * Crew member's own Protection slowing the radiation. Crew leaving a Landing Site first fly Mars ascent, which uses up
 * the ascent propellant it needs there whether or not it succeeds, and the rendezvous with their stage in Mars orbit.
 */

/** What became of a journey home, as far as the answers so far take it. */
export interface JourneyHome {
  /** The Crew who left Mars, alive as they left. */
  crew: string[];
  /** The day of the Turn they get home if nothing goes wrong. */
  homeOn: number;
  /** Its `deliveredCrew` are the Crew home safe, and its `crewLost` those lost on the way. */
  outcome: MissionOutcome;
  /** The ascent propellant Mars ascent used at the Landing Site it left, if Crew left one and the ascent flew. */
  propellantUsed: { landingSiteId: string; kg: number } | null;
}

/** Flies the journey home of the Crew leaving Mars this Turn with the Supplies they take, if any leave alive. */
export function flyJourneyHome(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  stage: EarthReturnStage,
  leaving: {
    crew: { member: CrewMemberAtMars; health: number }[];
    suppliesKg: number;
  },
  answers: DecisionAnswers,
): JourneyHome | null {
  if (leaving.crew.length === 0) return null;
  const { homeOn } = journeyHomeDays(catalogue, rules);
  const flight = homewardFlight(
    catalogue,
    rules,
    program,
    stage,
    leaving,
    answers,
  );
  const from = leaving.crew[0]?.member.location;
  const site = from?.kind === "landingSite" ? from.landingSiteId : null;
  const [ascent] = site === null ? [] : rules.journeyHomeEvents(true);
  let propellantUsed: JourneyHome["propellantUsed"] = null;
  for (const event of rules.journeyHomeEvents(site !== null)) {
    // Crew whose Health ran out before this Mission Event leave no one to fly it.
    if (flight.crewOnBoard(event).length === 0) break;
    if (site !== null && event === ascent) {
      propellantUsed = {
        landingSiteId: site,
        kg: catalogue.crew.roundTrip.ascent.propellantKg,
      };
    }
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
        description: event.description,
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
  endJourney(flight, homeOn);
  // Marked, so that the events column and the checks of the Timeline can tell them from the Mission's.
  flight.outcome.entries = flight.outcome.entries.map((entry) =>
    entry.kind === "missionEvent" ? { ...entry, homeward: true } : entry,
  );
  return { crew: flight.crew, homeOn, outcome: flight.outcome, propellantUsed };
}

/** The journey home as a `Flight`, on the day it leaves Mars, with nothing yet happened to it. */
function homewardFlight(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  stage: EarthReturnStage,
  leaving: {
    crew: { member: CrewMemberAtMars; health: number }[];
    suppliesKg: number;
  },
  answers: DecisionAnswers,
): Flight {
  const { leavesOn, homeOn } = journeyHomeDays(catalogue, rules);
  // What the round trip bought for the journey home, as a Mission with nothing aboard but its Crew.
  const mission: PlannedMission = {
    launchVehicleId: "",
    assetIds: [],
    reliability: stage.reliability,
    contingencyIds: stage.contingencyIds,
  };
  const crew = leaving.crew.map(({ member }) => member.name);
  const outcome = outcomeBefore(
    catalogue.crew.roundTrip.name,
    [],
    crew,
    undefined,
  );
  const blowsTo = (name: string) =>
    outcome.crewBlows.filter(({ names }) => names.includes(name));
  const healthWith = (name: string, toDay: number, outages: Outage[]) => {
    const leaver = leaving.crew.find(({ member }) => member.name === name);
    const cut = radiationCutOf(catalogue, leaver?.member.protectionId ?? "");
    return healthCourse(
      leaver?.health ?? 0,
      [
        ...drainsInFlight(catalogue, toDay, cut, leavesOn),
        ...drainsWithoutSupplies(catalogue, outages, leavesOn, toDay),
      ],
      blowsTo(name),
    );
  };
  // Health on the way is asked for often, and the Supplies change only with a new blow.
  let settledSoFar: {
    blows: number;
    supplies: SettledSupplies<SuppliesUser>;
  } | null = null;
  const settled = () => {
    if (settledSoFar?.blows !== outcome.crewBlows.length) {
      settledSoFar = {
        blows: outcome.crewBlows.length,
        supplies: settleSupplies(
          catalogue,
          { startKg: leaving.suppliesKg, refills: [] },
          homeOn,
          (outages) =>
            crew.map((name) => ({
              fromDay: leavesOn,
              untilDay: healthWith(name, homeOn, outages).diedOn,
            })),
        ),
      };
    }
    return settledSoFar.supplies;
  };
  const flight: Flight = {
    catalogue,
    rules,
    program,
    mission,
    answers,
    assets: [],
    crew,
    radiationCutPercent: 0,
    landingSite: undefined,
    freeReturn: undefined,
    outcome,
    daysHeld: 0,
    leavesMarsOn: leavesOn,
    dayOf: (event) => rules.dayOf(event, mission, leavesOn),
    stillOnBoard: () => [],
    // The Crew are aboard from leaving Mars until they are home.
    crewOnBoard: (when) => {
      const day = typeof when === "number" ? when : flight.dayOf(when);
      return day <= homeOn ? flight.aliveOn(crew, day) : [];
    },
    healthInFlight: (name, toDay) => healthWith(name, toDay, settled().outages),
    suppliesOutages: () => settled().outages,
    suppliesLeftOn: (day) =>
      suppliesCourse(catalogue, leaving.suppliesKg, settled().users, [], day)
        .leftKg,
    aliveOn: (names, day) =>
      names.filter((name) => flight.healthInFlight(name, day).diedOn === null),
    stopWith: (_onBoard, crewOnBoard) => {
      outcome.deliveredCrew = crew.filter(
        (name) => !crewOnBoard.includes(name),
      );
    },
    filledIn: (text) => text,
    // Nothing aboard has a Service Life.
    shorten: () => undefined,
    cut: () => undefined,
    happened: (event) => ({
      kind: "missionEvent" as const,
      day: flight.dayOf(event),
      eventId: event.id,
    }),
  };
  return flight;
}

/**
 * Works out what the journey did to the Health and Supplies of the Crew not lost with it, up to the day they got home,
 * a Mission Event failed or a Decision Point with no answer yet. Those whose Health ran out on the way are lost then,
 * to their Supplies if those had run out first, and otherwise to their Health, so they don't come home.
 */
function endJourney(flight: Flight, homeOn: number): void {
  const { catalogue, outcome } = flight;
  const lostWithIt = new Set(outcome.crewLost.flatMap(({ names }) => names));
  const stoppedOn = Math.min(
    homeOn,
    outcome.failedOnDay ?? Infinity,
    outcome.decisionPoint?.day ?? Infinity,
  );
  const flown = flight.crew
    .filter((name) => !lostWithIt.has(name))
    .map((name) => ({ name, ...flight.healthInFlight(name, stoppedOn) }));
  outcome.crewHealth = flown.map(({ name, health, lost, saved }) => ({
    name,
    health,
    lost,
    saved,
  }));
  const outages = flight.suppliesOutages();
  const ranOut = outages.find(({ fromDay }) => fromDay < stoppedOn);
  if (ranOut) {
    outcome.crewSuppliesOutOn = ranOut.fromDay;
    outcome.entries.push({
      kind: "suppliesOut",
      day: ranOut.fromDay,
      title: `Supplies out aboard the ${catalogue.crew.roundTrip.name}`,
      description: `The Crew aboard the ${catalogue.crew.roundTrip.name} have run out of Supplies on the way home, so their Health falls quickly.`,
    });
  }
  const died = flown.filter(({ diedOn }) => diedOn !== null);
  const diedNames = new Set(died.map(({ name }) => name));
  outcome.deliveredCrew = outcome.deliveredCrew.filter(
    (name) => !diedNames.has(name),
  );
  const days = [...new Set(died.flatMap(({ diedOn }) => diedOn ?? []))];
  for (const day of days.toSorted((first, second) => first - second)) {
    outcome.crewLost.push(
      ...healthRanOut(
        died.filter(({ diedOn }) => diedOn === day).map(({ name }) => name),
        day,
        outages,
        "on the way home",
      ),
    );
  }
}
