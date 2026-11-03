import type { Flight } from "./flight";
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
 * rolls for the rescue once the player has chosen to use it. A rescue costs the Assets on board some Service Life.
 */
export function tryContingency(
  flight: Flight,
  event: MissionEvent,
  onBoard: Asset[],
): ContingencyResult {
  const { rules, program, mission, answers, outcome, assets } = flight;
  const lostNames = onBoard.map((asset) => asset.name).join(", ");
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
        assets: onBoard.map((asset) => asset.name),
        choices: [
          {
            answer: "use",
            label: `Use ${contingency.name}`,
            riskBand: rules.riskBandFor(contingency.rescueFailureProbability),
            description: `A second try. If it works, ${lostNames} carry on with ${contingency.serviceLifeLossPercent}% less Service Life. If it fails, ${
              comesHomeFrom(flight, event)
                ? `they swing back to Earth, which costs ${supportCost(lossFor(flight, event, contingency))} and refunds ${formatMoney(refundFor(flight, onBoard))}.`
                : `they are lost and it costs ${lossFor(flight, event, contingency)} Public Support.`
            }`,
          },
          {
            answer: "decline",
            label: "Don't use it",
            riskBand: null,
            description: comesHomeFrom(flight, event)
              ? `${lostNames} swing back to Earth, which costs ${supportCost(lossFor(flight, event, undefined))} and refunds ${formatMoney(refundFor(flight, onBoard))}.`
              : `${lostNames} are lost, and it costs ${lossFor(flight, event, undefined)} Public Support.`,
          },
        ],
      };
      outcome.deliveredAssets = assets.filter(
        (asset) => !onBoard.includes(asset),
      );
      return { kind: "decisionPoint" };
    }
    if (
      answer === "use" &&
      roll(program.seed, program.turnNumber, decisionIdOf(event)) >=
        contingency.rescueFailureProbability
    ) {
      flight.cut(onBoard, contingency.serviceLifeLossPercent);
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
        description: `${flight.filledIn(contingency.rescueDescription)} ${lostNames} lost ${contingency.serviceLifeLossPercent}% of their Service Life.`,
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
