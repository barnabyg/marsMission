import type { DecisionAnswer, DecisionPoint } from "../simulation/simulation";
import type { DecisionAdvice } from "../tutorial/tutorial";
import { GameText } from "../ui/GameText";

interface DecisionPointPanelProps {
  decisionPoint: DecisionPoint;
  onAnswer: (answer: DecisionAnswer) => void;
  /** Tutorial mode's suggested answer, while it is on. The player still chooses. */
  advice?: DecisionAdvice | null;
}

/** Holds the Turn until the player chooses. It leaves the views and the events column usable, as there's no time limit. */
export function DecisionPointPanel({
  decisionPoint,
  onAnswer,
  advice = null,
}: DecisionPointPanelProps) {
  const { title, description, choices } = decisionPoint;
  const suggested = choices.find(({ answer }) => answer === advice?.answer);
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
      {advice && suggested && (
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
      )}
      <div className="decision-choices">
        {choices.map(
          ({ answer, label, riskBand, description: what }, index) => (
            <div
              key={answer}
              data-testid={`decision-choice-${answer}`}
              className={suggested?.answer === answer ? "suggested" : undefined}
            >
              <button
                type="button"
                className={index === 0 ? "primary" : undefined}
                onClick={() => {
                  onAnswer(answer);
                }}
              >
                {label}
              </button>
              {riskBand !== null && (
                <p>
                  <strong data-testid="decision-risk-band">
                    <GameText>{`Risk Band: ${riskBand}`}</GameText>
                  </strong>
                </p>
              )}
              <p>
                <GameText>{what}</GameText>
              </p>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
