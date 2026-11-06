import type { Catalogue } from "../catalogue/catalogue";
import { flyMission } from "./flyMission";
import { missionOnTimeline, timelineUpToDecision } from "./missionReport";
import type { PlanCheck } from "./previews";
import type { Rules } from "./rules";
import { resolveTurn } from "./turnSteps";
import type {
  DecisionAnswer,
  DecisionAnswers,
  DecisionPoint,
  Program,
  TurnPlan,
  TurnProgress,
} from "./types";
import { withMissionsEnded } from "./upkeep";

/** The answer that plays a Turn on with nothing rolled for it, for what comes before a Decision Point. */
function cautiousAnswer({ kind }: DecisionPoint): DecisionAnswer {
  const cautious: Record<DecisionPoint["kind"], DecisionAnswer> = {
    contingency: "decline",
    dustStorm: "shelter",
    solarParticleEvent: "safeMode",
    goNoGo: "holdOff",
  };
  return cautious[kind];
}

/**
 * Works out a Turn from the seed, the plan and the answers so far: flies the Mission, carries out the rest of the
 * Turn's steps, and stops at the earliest Decision Point with no answer, from the Mission or a dust storm.
 */
export function workOutTurn(
  catalogue: Catalogue,
  rules: Rules,
  checkPlan: (program: Program, plan: TurnPlan) => PlanCheck,
  planned: Program,
  plan: TurnPlan,
  answers: DecisionAnswers,
): TurnProgress {
  const { costMillions, upkeepMillions, problems } = checkPlan(planned, plan);
  if (problems.length > 0) throw new Error(problems.join(" "));
  // The Assets whose missions the player ended leave service as the Turn starts, before anything else happens.
  const program = withMissionsEnded(planned, plan);

  const fly = (given: DecisionAnswers) =>
    flyMission(catalogue, rules, program, plan, given);
  const flown = fly(answers);
  const missionDecision = flown.decisionPoint;
  // The Mission never depends on the rest of the Turn, but what's at stake on a day depends on the Mission so far.
  const asIfCautious = missionDecision
    ? fly({
        ...answers,
        [missionDecision.id]: cautiousAnswer(missionDecision),
      })
    : flown;
  const { result, otherEntries, stormDecision } = resolveTurn(
    catalogue,
    rules,
    program,
    plan,
    { missionMillions: costMillions, upkeepMillions },
    asIfCautious,
    answers,
  );
  const stormComesFirst =
    stormDecision !== null &&
    (missionDecision === null ||
      stormDecision.decisionPoint.day < missionDecision.day);
  const decisionPoint = stormComesFirst
    ? stormDecision.decisionPoint
    : missionDecision;
  if (!decisionPoint) {
    return { decisionPoint, timeline: result.timeline, result };
  }
  return {
    decisionPoint,
    timeline: timelineUpToDecision(
      result.timeline,
      otherEntries,
      flown.entries,
      missionOnTimeline(catalogue, rules, plan, flown),
      {
        day: decisionPoint.day,
        entry: stormComesFirst ? stormDecision.entry : null,
      },
    ),
  };
}
