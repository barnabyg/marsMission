import type { Flight } from "./flight";
import { crewLoss } from "./lostCrew";
import {
  formatMoney,
  type Asset,
  type Contingency,
  type MissionEvent,
} from "./rules";
import { costOf } from "./technologyReadiness";

// Slow to create, and balance runs fly a great many Missions.
const listOfNames = new Intl.ListFormat("en");

/** Whether failing this Mission Event brings the Mission home, on a Free-return. */
export const comesHomeFrom = (flight: Flight, event: MissionEvent) =>
  flight.freeReturn?.arrivalBurn === event.id;

/** The Public Support that failing this Mission Event costs, after any Contingency that was tried. */
export const lossFor = (
  flight: Flight,
  event: MissionEvent,
  used: Contingency | undefined,
) =>
  Math.min(
    (comesHomeFrom(flight, event) ? 0 : event.publicSupportLoss) +
      (used?.extraPublicSupportLoss ?? 0),
    flight.program.publicSupport,
  );

/** What a Free-return refunds for the Assets it brings back. */
export const refundFor = (flight: Flight, onBoard: Asset[]) =>
  Math.round(
    (onBoard.reduce(
      (total, asset) => total + costOf(flight.program, asset),
      0,
    ) *
      (flight.freeReturn?.refundPercent ?? 0)) /
      100,
  );

export const supportCost = (loss: number) =>
  loss > 0 ? `${loss} Public Support` : "no Public Support";

/**
 * Ends the Mission at a Mission Event that failed for good, after any Contingency that was tried. It loses the Assets
 * and Crew still on board, or brings them home if it was the arrival burn of a Free-return, the Crew alive. Anything
 * delivered before is safe.
 */
export function missionEventFailed(
  flight: Flight,
  event: MissionEvent,
  onBoard: Asset[],
  used: Contingency | undefined,
): void {
  const { outcome, freeReturn } = flight;
  const crewOnBoard = flight.crewOnBoard(event);
  const lostNames = [
    ...onBoard.map((asset) => asset.name),
    ...crewOnBoard,
  ].join(", ");
  // An Asset or Crew are delivered when their last Mission Event succeeds, so anything delivered before a failure is safe.
  outcome.failedEvent = event;
  outcome.failedOnDay = flight.dayOf(event);
  flight.stopWith(onBoard, crewOnBoard);
  outcome.publicSupportLost = lossFor(flight, event, used);
  const stillSafe = [
    ...outcome.deliveredAssets.map((asset) => asset.name),
    ...outcome.deliveredCrew,
  ];
  const safe =
    stillSafe.length > 0 ? ` Still safe: ${stillSafe.join(", ")}.` : "";
  const tried = used ? ` ${used.name} couldn't save it.` : "";
  if (freeReturn && comesHomeFrom(flight, event)) {
    const refundMillions = refundFor(flight, onBoard);
    const backOnDay = flight.dayOf(event) + freeReturn.returnDays;
    outcome.returned = { refundMillions, backOnDay, crew: crewOnBoard };
    const assetsBack = onBoard.map((asset) => asset.name).join(", ");
    outcome.entries.push(
      {
        ...flight.happened(event),
        title: `${event.name} failed`,
        description: `${freeReturn.description}${tried} Coming back with the Mission: ${lostNames}.${safe} It costs ${supportCost(outcome.publicSupportLost)} and refunds ${formatMoney(refundMillions)}.`,
        outcome: "failure",
        returningToEarth: true,
      },
      {
        kind: "missionReturned",
        day: backOnDay,
        title: "Mission back at Earth",
        description: [
          ...(assetsBack ? [`${assetsBack} came back to Earth.`] : []),
          ...(crewOnBoard.length > 0
            ? [`${listOfNames.format(crewOnBoard)} are home safe.`]
            : []),
          "None of them will fly again.",
        ].join(" "),
      },
    );
    return;
  }
  outcome.crewLost.push(
    ...crewLoss(
      crewOnBoard,
      flight.dayOf(event),
      "missionEvent",
      `when ${event.name} failed`,
    ),
  );
  outcome.entries.push({
    ...flight.happened(event),
    title: `${event.name} failed`,
    description: `${flight.filledIn(event.failureDescription)}${tried} Lost with the Mission: ${lostNames}.${safe} It costs ${outcome.publicSupportLost} Public Support.`,
    outcome: "failure",
  });
}
