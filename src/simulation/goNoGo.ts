import { dustStormOver } from "./dustStorms";
import type { Flight } from "./flight";
import type { Asset, MissionEvent } from "./rules";

const goNoGoIdOf = (event: MissionEvent) => `go-no-go:${event.id}`;

/** The dust storm over the Landing Site on the day this Mission Event is due, if it lands and there is one. */
function stormOnLanding(flight: Flight, event: MissionEvent) {
  const { catalogue, program, landingSite } = flight;
  if (event.failureProbability !== "landingSite" || !landingSite) return null;
  const storm = dustStormOver(catalogue, program, landingSite);
  const due = flight.dayOf(event);
  return storm && due >= storm.fromDay && due < storm.toDay ? storm : null;
}

/**
 * What holding off a landing for `wait` days costs what is being landed, said for the player, and paying it. Each Asset
 * being landed loses Service Life for each day held. Crew being landed lose nothing until there are Supplies to spend.
 */
function costOfHoldingOff(
  flight: Flight,
  landing: Asset[],
  crewLanding: string[],
  wait: number,
): { says: string; serviceLifeDaysLost: number; pay: () => void } {
  const { serviceLifeLostPerDayHeld } = flight.catalogue.hazards.dustStorm;
  const lifeLost =
    landing.length > 0 ? Math.round(wait * serviceLifeLostPerDayHeld) : 0;
  const parts = [
    ...(landing.length > 0
      ? [`costs each Asset being landed ${lifeLost} days of Service Life`]
      : []),
    // Supplies will be spent here for Crew aboard.
    ...(crewLanding.length > 0 && landing.length === 0
      ? ["costs nothing but time"]
      : []),
  ];
  return {
    says: parts.join(", and "),
    serviceLifeDaysLost: lifeLost,
    pay: () => {
      flight.shorten(landing, (days) => days - lifeLost);
    },
  };
}

/**
 * The go/no-go check before a landing that is due in a dust storm, if this Mission Event is one. Going ahead raises
 * the landing's risk, and holding off waits for the storm to pass, which costs what is being landed (`costOfHoldingOff`)
 * and moves the landing and everything after it later. Gives the risk the Mission Event has after the check, or null if
 * the Mission stops at the check's Decision Point for an answer.
 */
export function goNoGoCheck(
  flight: Flight,
  event: MissionEvent,
  usualRisk: number,
): number | null {
  const { catalogue, rules, answers, outcome, landingSite } = flight;
  const storm = stormOnLanding(flight, event);
  if (!storm || !landingSite) return usualRisk;
  const { landingRiskMultiplier } = catalogue.hazards.dustStorm;
  const due = flight.dayOf(event);
  const wait = storm.toDay - due;
  const landing = flight.stillOnBoard(event);
  const crewLanding = flight.crewOnBoard(event);
  const landingNames = [...landing.map((asset) => asset.name), ...crewLanding];
  const names = landingNames.join(", ");
  const holdingOffCosts = costOfHoldingOff(flight, landing, crewLanding, wait);
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
      assets: landingNames,
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
          description: `Land in ${wait} days, once the storm has passed, at the usual risk. Waiting ${holdingOffCosts.says}, and research starts later.`,
        },
      ],
    };
    flight.stopWith(landing, crewLanding);
    return null;
  }
  const holdingOff = answer === "holdOff";
  outcome.goNoGo = {
    siteName: landingSite.name,
    answer: holdingOff ? "holdOff" : "go",
    daysHeld: holdingOff ? wait : 0,
    serviceLifeDaysLost: holdingOff ? holdingOffCosts.serviceLifeDaysLost : 0,
  };
  outcome.entries.push({
    kind: "hazard",
    hazard: "dustStorm",
    day: due,
    title: holdingOff
      ? `Holding off the landing at ${landingSite.name}`
      : `Go for landing at ${landingSite.name}`,
    description: holdingOff
      ? `The landing waits ${wait} days for the storm to pass, which ${holdingOffCosts.says}.`
      : `Going down through the storm with ${names}.`,
  });
  if (!holdingOff) return raisedRisk;
  flight.daysHeld += wait;
  outcome.heldLanding = { eventId: event.id, days: wait };
  holdingOffCosts.pay();
  return usualRisk;
}
