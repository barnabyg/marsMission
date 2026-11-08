import { formatMoney, type ProgramView } from "../simulation/simulation";
import { crewAtBase } from "./base";

export type TutorialStatus =
  | { kind: "inProgress" }
  | {
      kind: "goalReached";
      /** Short sentences summarising what the player learnt along the route. */
      learnt: string[];
    }
  | {
      kind: "cantRecover";
      /** What went wrong, for the player. */
      reason: string;
    };

/** How close to the Cancellation Level Public Support must be, in points, for the tutorial to give up. */
const cantRecoverSupportPoints = 75;

/** How little Money there must be, alongside that, for the tutorial to give up: less than a rover Mission costs. */
const cantRecoverMillions = 1000;

/** What the route teaches, for the summary at the goal. */
const learnt = [
  "An orbiter's Survey lowers the landing risk at a Landing Site for every Mission that lands there later.",
  "Rovers on Research Grants pay for the Program, and the longest Service Life keeps them earning for more Turns.",
  "Reliability on every Mission Event costs a little each time, but far less than losing a Mission.",
  "A Launch Vehicle that isn't built needs Development first, and Crew wait until it has flown.",
  "A Base is a fuel plant, a Habitat and a Mars lab operating together at one Landing Site, so they go together.",
  "Crew on a round trip land beside the fuel plant, which makes the ascent propellant they need to come home.",
];

/**
 * Whether the tutorial has reached its goal, Crew at a Base, or can no longer reach it. It can't when the Program has
 * been cancelled, or when Public Support is within 75 points of the Cancellation Level and there is less than $1B:
 * too little to launch the rover that would earn the money back, with too little Public Support left to wait for it.
 */
export function tutorialStatus(view: ProgramView): TutorialStatus {
  if (crewAtBase(view)) return { kind: "goalReached", learnt };
  if (view.status.kind === "cancelled") {
    return {
      kind: "cantRecover",
      reason: `The Program was cancelled: ${view.status.reason}`,
    };
  }
  const pointsLeft = view.publicSupport - view.cancellationLevel;
  if (
    pointsLeft < cantRecoverSupportPoints &&
    view.moneyMillions < cantRecoverMillions
  ) {
    return {
      kind: "cantRecover",
      reason:
        `Public Support is only ${pointsLeft} points above the Cancellation Level, and with ` +
        `${formatMoney(view.moneyMillions)} there isn't the money for a rover to earn Research Grants. ` +
        "The Program can't now build a Base before it is cancelled, so the tutorial ends here. You can keep playing.",
    };
  }
  return { kind: "inProgress" };
}

/** How the tutorial ended: at its goal, or once it couldn't recover. */
export type TutorialEnd = Exclude<TutorialStatus, { kind: "inProgress" }>;
