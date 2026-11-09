import type { Flight } from "./flight";
import { crewLossWarning } from "./lostCrew";
import {
  comesHomeFrom,
  lossFor,
  refundFor,
  supportCost,
} from "./missionEventFailure";
import {
  formatMoney,
  roll,
  type Asset,
  type Contingency,
  type MissionEvent,
} from "./rules";

// Slow to create, and balance runs fly a great many Missions.
const listOfNames = new Intl.ListFormat("en");

const decisionIdOf = (event: MissionEvent) => `contingency:${event.id}`;

/**
 * What came of a failed Mission Event's Contingency: it saved the Mission, the Mission stopped at its Decision Point
 * for an answer, or the Mission Event failed for good, with the Contingency that was used and couldn't save it, if one was.
 */
type ContingencyResult =
  | { kind: "rescued" }
  | { kind: "decisionPoint" }
  | { kind: "failed"; used: Contingency | undefined };

/**
 * Offers the Contingency the Mission bought for a Mission Event that failed, if it bought one, as a Decision Point, and
 * rolls for the rescue once the player has chosen to use it. A rescue costs the Assets on board some Service Life, and
 * the Crew on board some Health.
 */
export function tryContingency(
  flight: Flight,
  event: MissionEvent,
  onBoard: Asset[],
): ContingencyResult {
  const { rules, program, mission, answers, outcome } = flight;
  const crewOnBoard = flight.crewOnBoard(event);
  const cargoOnBoard = flight.cargoOnBoard(event);
  const assetNames = onBoard.map((asset) => asset.name).join(", ");
  const lostNames = [
    ...onBoard.map((asset) => asset.name),
    ...cargoOnBoard,
    ...crewOnBoard,
  ];
  const named = lostNames.join(", ");
  // One Asset is lost, one Crew member or several of anything are: the verb agrees with what is named.
  const one = lostNames.length === 1 && crewOnBoard.length === 0;
  const verb = (singular: string, plural: string) => (one ? singular : plural);
  const they = one ? "it" : "they";
  const { contingencyRescueLoss } = flight.catalogue.crew.health;
  // An Asset loses Service Life to a rescue, and Crew lose Health.
  const crewCost = `${contingencyRescueLoss} less Health each`;
  const carryOn = (percent: number) => {
    const assetCost = `${percent}% less Service Life`;
    if (crewOnBoard.length === 0) {
      return onBoard.length === 0 ? "" : ` with ${assetCost}`;
    }
    return onBoard.length === 0
      ? ` with ${crewCost}`
      : `, the Assets with ${assetCost} and the Crew with ${crewCost}`;
  };
  const lifeLost = (percent: number) =>
    [
      ...(onBoard.length > 0
        ? [` ${assetNames} lost ${percent}% of their Service Life.`]
        : []),
      ...(crewOnBoard.length > 0
        ? [
            ` ${listOfNames.format(crewOnBoard)} lost ${contingencyRescueLoss} Health${crewOnBoard.length > 1 ? " each" : ""}.`,
          ]
        : []),
    ].join("");
  const contingency = rules.contingencyFor(mission, event.id);
  if (contingency) {
    outcome.entries.push({
      kind: "decisionPoint",
      day: flight.dayOf(event),
      eventId: event.id,
      title: `${event.name}: Decision Point`,
      description: flight.filledIn(contingency.troubleDescription),
    });
    const answer = answers[decisionIdOf(event)];
    if (answer === undefined) {
      outcome.decisionPoint = {
        id: decisionIdOf(event),
        kind: "contingency",
        day: flight.dayOf(event),
        title: event.name,
        description: flight.filledIn(contingency.troubleDescription),
        assets: [
          ...onBoard.map((asset) => asset.name),
          ...cargoOnBoard,
          ...crewOnBoard,
        ],
        choices: [
          {
            answer: "use",
            label: `Use ${contingency.name}`,
            riskBand: rules.riskBandFor(contingency.rescueFailureProbability),
            description: `A second try. If it works, ${named} ${verb("carries", "carry")} on${carryOn(contingency.serviceLifeLossPercent)}. If it fails, ${
              comesHomeFrom(flight, event)
                ? `${they} ${verb("swings", "swing")} back to Earth, which costs ${supportCost(lossFor(flight, event, contingency))} and refunds ${formatMoney(refundFor(flight, onBoard))}.`
                : `${they} ${verb("is", "are")} lost and it costs ${lossFor(flight, event, contingency)} Public Support.${crewLossWarning(flight.catalogue, crewOnBoard)}`
            }`,
          },
          {
            answer: "decline",
            label: "Don't use it",
            riskBand: null,
            description: comesHomeFrom(flight, event)
              ? `${named} ${verb("swings", "swing")} back to Earth, which costs ${supportCost(lossFor(flight, event, undefined))} and refunds ${formatMoney(refundFor(flight, onBoard))}.`
              : `${named} ${verb("is", "are")} lost, and it costs ${lossFor(flight, event, undefined)} Public Support.${crewLossWarning(flight.catalogue, crewOnBoard)}`,
          },
        ],
      };
      flight.stopWith(onBoard, crewOnBoard);
      return { kind: "decisionPoint" };
    }
    if (
      answer === "use" &&
      roll(program.seed, program.turnNumber, decisionIdOf(event)) >=
        contingency.rescueFailureProbability
    ) {
      flight.cut(onBoard, contingency.serviceLifeLossPercent);
      if (crewOnBoard.length > 0) {
        outcome.crewBlows.push({
          names: crewOnBoard,
          cause: "contingency",
          day: flight.dayOf(event),
          health: contingencyRescueLoss,
        });
      }
      outcome.contingencies.push({
        missionEventName: event.name,
        contingencyName: contingency.name,
        answer,
        rescued: true,
        saved: onBoard,
      });
      outcome.entries.push({
        ...flight.happened(event),
        title: `${event.name}: saved by ${contingency.name}`,
        description: `${flight.filledIn(contingency.rescueDescription)}${lifeLost(contingency.serviceLifeLossPercent)}`,
        outcome: "success",
      });
      return { kind: "rescued" };
    }
    outcome.contingencies.push({
      missionEventName: event.name,
      contingencyName: contingency.name,
      answer,
      rescued: false,
      saved: [],
    });
  }
  return {
    kind: "failed",
    used: answers[decisionIdOf(event)] === "use" ? contingency : undefined,
  };
}
