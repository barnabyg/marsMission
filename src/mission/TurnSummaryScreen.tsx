import type { Timeline, TurnSummary } from "../simulation/simulation";
import { BailoutOffer, BailoutTaken } from "../ui/BailoutOffer";
import { GameText } from "../ui/GameText";
import { SummaryCard, type SummaryCardContent } from "./SummaryCard";
import { SummaryChanges } from "./SummaryChanges";
import { crewCards } from "./SummaryCrew";
import { decisionCards, failureCards } from "./SummaryEvents";
import { milestoneCards } from "./SummaryMilestones";
import { missionEventsCards } from "./SummaryMissionEvents";
import { earningCards, marsCards, technologyCards } from "./SummaryOutcomes";
import { sampleCards } from "./SummarySamples";
import { cardSpans, summaryColumns } from "./summaryGrid";
import { turnMissionEvents } from "./turnMissionEvents";

interface TurnSummaryScreenProps {
  summary: TurnSummary;
  /** The whole Turn as Mission Mode played it, for the list of its Mission Events. */
  timeline: Timeline;
  /** Whether the Bailout this summary offers has been taken, which the player can do here. */
  bailoutTaken: boolean;
  onTakeBailout: () => void;
  onContinue: () => void;
}

/** The Bailout on offer for the Turn's lost Mission, which the player can take here, and once taken, what it gave. */
function bailoutCards(
  { bailoutOffer }: TurnSummary,
  taken: boolean,
  onTake: () => void,
): SummaryCardContent[] {
  if (!bailoutOffer) return [];
  return [
    {
      key: "bailout",
      heading: "Bailout",
      testId: "summary-bailout",
      content: taken ? (
        <BailoutTaken offer={bailoutOffer} />
      ) : (
        <BailoutOffer offer={bailoutOffer} onTake={onTake} />
      ),
    },
  ];
}

/** A Program cancelled as the Turn ended, as a card of its own across the top of the screen. */
function cancellationCards({
  cancellationReason,
}: TurnSummary): SummaryCardContent[] {
  if (!cancellationReason) return [];
  return [
    {
      key: "cancelled",
      heading: "Program cancelled",
      problem: true,
      role: "alert",
      content: (
        <p>
          <GameText>
            {`The Program has been cancelled. ${cancellationReason}`}
          </GameText>
        </p>
      ),
    },
  ];
}

/**
 * The payoff of a Turn: how Money, Science and Public Support moved across the top, then everything else as headed
 * cards in the same three columns, with Continue beside the heading so that it is in the same place however many cards
 * there are.
 */
export function TurnSummaryScreen({
  summary,
  timeline,
  bailoutTaken,
  onTakeBailout,
  onContinue,
}: TurnSummaryScreenProps) {
  const cards = [
    ...failureCards(summary),
    ...bailoutCards(summary, bailoutTaken, onTakeBailout),
    ...milestoneCards(summary.milestones),
    ...earningCards(summary),
    ...missionEventsCards(turnMissionEvents(timeline)),
    ...crewCards(summary),
    ...decisionCards(summary),
    ...sampleCards(summary),
    ...technologyCards(summary),
    ...marsCards(summary),
  ];
  const spans = cardSpans(cards);
  return (
    <main className="summary-screen turn-summary" data-testid="turn-summary">
      <header className="turn-summary-header">
        <h1>
          <GameText>Turn summary</GameText>
        </h1>
        <button type="button" className="primary" onClick={onContinue}>
          Continue
        </button>
      </header>
      <div className="summary-cards">
        {/* A row of its own above the value cards, so that it is read first. */}
        {cancellationCards(summary).map((card) => (
          <SummaryCard key={card.key} card={card} span={summaryColumns} />
        ))}
        <SummaryChanges summary={summary} />
        {cards.map((card, index) => (
          <SummaryCard key={card.key} card={card} span={spans[index] ?? 1} />
        ))}
      </div>
    </main>
  );
}
