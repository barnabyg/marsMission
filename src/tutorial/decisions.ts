import type {
  DecisionAnswer,
  DecisionPoint,
  ProgramView,
  TurnPlan,
} from "../simulation/simulation";

export interface DecisionAdvice {
  answer: DecisionAnswer;
  reason: string;
}

/** What is at stake at a Decision Point: its Assets, and Crew if any are there. */
function atStake(
  decisionPoint: DecisionPoint,
  view: ProgramView,
  plan: TurnPlan,
): string {
  const crewThere =
    decisionPoint.kind === "dustStorm"
      ? view.crew.some(
          ({ locationName }) => locationName === decisionPoint.siteName,
        )
      : plan.mission?.crew !== undefined;
  if (crewThere) return "the Crew";
  return decisionPoint.assets.length === 1
    ? (decisionPoint.assets[0] ?? "the Mission")
    : "the Assets";
}

/** The answer the tutorial suggests for a kind of Decision Point, which is always the safe one, with why. */
function suggested(
  decisionPoint: DecisionPoint,
  stake: string,
): DecisionAdvice {
  const at = decisionPoint.siteName ? ` at ${decisionPoint.siteName}` : "";
  switch (decisionPoint.kind) {
    case "contingency":
      return {
        answer: "use",
        reason: `Using the Contingency gives ${stake} a second chance that is already paid for. Declining it loses them for certain.`,
      };
    case "dustStorm":
      return {
        answer: "shelter",
        reason: `Sheltering pauses the work${at} until the storm passes, but keeps ${stake} safe. Carrying on risks losing them for a little more Science.`,
      };
    case "solarParticleEvent":
      return {
        answer: "safeMode",
        reason: `Safe mode shields ${stake} from the worst of the radiation for a few days. Carrying on risks the whole Mission.`,
      };
    case "goNoGo":
      return {
        answer: "holdOff",
        reason: `Holding off waits for the dust storm${at} to clear before landing, which is far safer for ${stake} than landing in it.`,
      };
  }
}

/** The answer the tutorial suggests at a Decision Point, which is always one of its choices, with a short reason. */
export function decisionAdvice(
  decisionPoint: DecisionPoint,
  view: ProgramView,
  plan: TurnPlan,
): DecisionAdvice {
  const advice = suggested(decisionPoint, atStake(decisionPoint, view, plan));
  if (decisionPoint.choices.some(({ answer }) => answer === advice.answer)) {
    return advice;
  }
  const [first] = decisionPoint.choices;
  return {
    answer: first.answer,
    reason: `${first.label}: ${first.description}`,
  };
}
