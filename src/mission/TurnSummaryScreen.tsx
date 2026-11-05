import type { TurnSummary } from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { SummaryChanges } from "./SummaryChanges";
import { SummaryEvents } from "./SummaryEvents";
import { SummaryMilestones } from "./SummaryMilestones";
import { SummaryOutcomes } from "./SummaryOutcomes";

interface TurnSummaryScreenProps {
  summary: TurnSummary;
  onContinue: () => void;
}

/** The payoff of a Turn: how Money, Science and Public Support moved, the Milestones earned, then everything else. */
export function TurnSummaryScreen({
  summary,
  onContinue,
}: TurnSummaryScreenProps) {
  return (
    <main className="summary-screen turn-summary" data-testid="turn-summary">
      <h1>
        <GameText heading>Turn summary</GameText>
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
        <SummaryEvents summary={summary} />
        <SummaryOutcomes summary={summary} />
      </div>
      <button type="button" className="primary" onClick={onContinue}>
        Continue
      </button>
    </main>
  );
}
