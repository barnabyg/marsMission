import type { Timeline, TurnSummary } from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { SummaryChanges } from "./SummaryChanges";
import { SummaryEvents } from "./SummaryEvents";
import { SummaryMilestones } from "./SummaryMilestones";
import { SummaryMissionEvents } from "./SummaryMissionEvents";
import { SummaryOutcomes } from "./SummaryOutcomes";
import { SummarySamples } from "./SummarySamples";
import { turnMissionEvents } from "./turnMissionEvents";

interface TurnSummaryScreenProps {
  summary: TurnSummary;
  /** The whole Turn as Mission Mode played it, for the list of its Mission Events. */
  timeline: Timeline;
  onContinue: () => void;
}

/** The payoff of a Turn: how Money, Science and Public Support moved, the Milestones earned, then everything else. */
export function TurnSummaryScreen({
  summary,
  timeline,
  onContinue,
}: TurnSummaryScreenProps) {
  return (
    <main className="summary-screen turn-summary" data-testid="turn-summary">
      <h1>
        <GameText>Turn summary</GameText>
      </h1>
      {summary.cancellationReason && (
        <p className="problem" role="alert">
          <GameText>
            {`The Program has been cancelled. ${summary.cancellationReason}`}
          </GameText>
        </p>
      )}
      <SummaryChanges summary={summary} />
      <SummaryMilestones milestones={summary.milestones} />
      <div className="turn-summary-details">
        <SummaryMissionEvents events={turnMissionEvents(timeline)} />
        <SummaryEvents summary={summary} />
        <SummarySamples summary={summary} />
        <SummaryOutcomes summary={summary} />
      </div>
      <button type="button" className="primary" onClick={onContinue}>
        Continue
      </button>
    </main>
  );
}
