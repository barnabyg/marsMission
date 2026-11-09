import type { DecisionAnswer, DecisionPoint } from "../simulation/simulation";
import type { DecisionAdvice } from "../tutorial/tutorial";
import { GameText } from "../ui/GameText";

interface DecisionPointPanelProps {
  decisionPoint: DecisionPoint;
  onAnswer: (answer: DecisionAnswer) => void;
  /** Tutorial mode's suggested answer, while it is on. The player still chooses. */
  advice?: DecisionAdvice | null;
}

/** The choice Tutorial mode suggests, if it suggests one of these. */
const suggestedChoice = (
  { choices }: DecisionPoint,
  advice: DecisionAdvice | null,
) => choices.find(({ answer }) => answer === advice?.answer);

/**
 * Holds the Turn until the player chooses. It leaves the views and the events column usable, as there's no time limit.
 * Docked at the bottom of the view, it is kept short so that the scene above it stays clear: Tutorial mode's reason for
 * its suggestion is in the panel beside the scene, in {@link DecisionPointAdvice}.
 */
export function DecisionPointPanel({
  decisionPoint,
  onAnswer,
  advice = null,
}: DecisionPointPanelProps) {
  const { title, description, choices } = decisionPoint;
  const suggested = suggestedChoice(decisionPoint, advice);
  return (
    <section
      className="decision-point"
      role="group"
      aria-label="Decision Point"
      data-testid="decision-point"
    >
      <h2>
        <GameText heading>{`Decision Point: ${title}`}</GameText>
      </h2>
      <p>
        <GameText>{description}</GameText>
      </p>
      {/* Two equal cards, each with its button at the top and the same fields underneath. Only the choice Tutorial
          mode suggests is primary, as neither answer is a default. */}
      <div className="decision-choices">
        {choices.map(({ answer, label, riskBand, description: what }) => {
          const isSuggested = suggested?.answer === answer;
          return (
            <div
              key={answer}
              data-testid={`decision-choice-${answer}`}
              className={isSuggested ? "suggested" : undefined}
            >
              <button
                type="button"
                className={isSuggested ? "primary" : undefined}
                onClick={() => {
                  onAnswer(answer);
                }}
              >
                {label}
              </button>
              <p>
                <GameText>{what}</GameText>
              </p>
              {riskBand !== null && (
                <p>
                  <strong data-testid="decision-risk-band">
                    <GameText>{`Risk Band: ${riskBand}`}</GameText>
                  </strong>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

interface DecisionPointAdviceProps {
  decisionPoint: DecisionPoint;
  /** Tutorial mode's suggested answer, while it is on. */
  advice: DecisionAdvice | null;
}

/** What Tutorial mode suggests at a Decision Point and why, or nothing while it suggests nothing. */
export function DecisionPointAdvice({
  decisionPoint,
  advice,
}: DecisionPointAdviceProps) {
  const suggested = suggestedChoice(decisionPoint, advice);
  if (!advice || !suggested) return null;
  return (
    <div
      className="decision-advice tutorial-voice"
      data-testid="decision-advice"
    >
      <p>
        <GameText>{`Tutorial mode suggests: ${suggested.label}.`}</GameText>
      </p>
      <p className="tutorial-reason">
        <GameText>{advice.reason}</GameText>
      </p>
    </div>
  );
}
