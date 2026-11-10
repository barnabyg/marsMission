import type {
  DecisionAnswer,
  DecisionPoint,
  PlannedAsset,
  PlannedCrew,
  PlannedTrajectory,
  ProgramView,
  Simulation,
  TurnPlan,
} from "../simulation/simulation";

type PlannedMission = NonNullable<TurnPlan["mission"]>;

/** What a strategy can ask the Simulation while it plans a Turn. */
export interface PlanningTools {
  previewAssets(mission: PlannedMission): PlannedAsset[];
  previewMission(
    mission: PlannedMission,
  ): ReturnType<Simulation["previewMission"]>;
  previewTrajectories(mission: PlannedMission): PlannedTrajectory[];
  previewCrew(mission: PlannedMission): PlannedCrew | null;
  /** What's wrong with a plan for this Turn, which is nothing if it can be submitted. */
  problemsWith(plan: TurnPlan): string[];
  /** What a plan for this Turn costs, with any Development it starts. */
  costOf(plan: TurnPlan): number;
}

/** The smallest refund for which a strategy takes the Bailout, unless it says otherwise: about a robotic Mission. */
const bailoutAtLeastMillions = 1000;

/** Whether a strategy that doesn't say otherwise takes the Bailout on offer. */
export function takesBailoutByDefault(view: ProgramView): boolean {
  return (
    view.bailout.kind === "offered" &&
    view.bailout.millions >= bailoutAtLeastMillions
  );
}

/** One way of playing the game. It sees what a player sees, so it can't know the seed or what will happen. */
export interface Strategy {
  name: string;
  description: string;
  plan(view: ProgramView, tools: PlanningTools): TurnPlan;
  /** What it does at a Decision Point on a Turn it planned this way. It takes the first choice offered unless it says otherwise. */
  answer?(
    decisionPoint: DecisionPoint,
    view: ProgramView,
    plan: TurnPlan,
  ): DecisionAnswer;
  /**
   * Whether it takes the Bailout on offer after a lost Mission, going by what the player sees. Left out, it takes the
   * first one that refunds at least `bailoutAtLeastMillions`, keeping it for a bigger loss otherwise.
   */
  takeBailout?(view: ProgramView): boolean;
  /**
   * For a strategy with a goal, such as the tutorial's: whether a Program has reached it, and whether it can no longer,
   * going by what the player sees. The report says how often each happens.
   */
  goal?: {
    reached(view: ProgramView): boolean;
    cantRecover(view: ProgramView): boolean;
  };
}
