import { dustStormOver } from "./dustStorms";
import type { Flight } from "./flight";
import type { MissionEvent } from "./rules";

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
 * The go/no-go check before a landing that is due in a dust storm, if this Mission Event is one. Going ahead raises
 * the landing's risk, and holding off waits for the storm to pass, which costs the Assets being landed Service Life and
 * moves the landing and everything after it later. Gives the risk the Mission Event has after the check, or null if
 * the Mission stops at the check's Decision Point for an answer.
 */
export function goNoGoCheck(
  flight: Flight,
  event: MissionEvent,
  usualRisk: number,
): number | null {
  const { catalogue, rules, answers, outcome, assets, landingSite } = flight;
  const storm = stormOnLanding(flight, event);
  if (!storm || !landingSite) return usualRisk;
  const { landingRiskMultiplier, serviceLifeLostPerDayHeld } =
    catalogue.hazards.dustStorm;
  const due = flight.dayOf(event);
  const wait = storm.toDay - due;
  const landing = flight.stillOnBoard(event);
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
    return null;
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
  if (!holdingOff) return raisedRisk;
  flight.daysHeld += wait;
  outcome.heldLanding = { eventId: event.id, days: wait };
  flight.shorten(landing, (days) => days - lifeLost);
  return usualRisk;
}
