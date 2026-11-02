import type { DecisionAnswer, DecisionPoint } from "../simulation/simulation";
import { GameText } from "../ui/GameText";

interface DecisionPointPanelProps {
  decisionPoint: DecisionPoint;
  onAnswer: (answer: DecisionAnswer) => void;
}

/** Holds the Turn until the player chooses. It leaves the views and the events column usable, as there's no time limit. */
export function DecisionPointPanel({
  decisionPoint,
  onAnswer,
}: DecisionPointPanelProps) {
  const { title, description, choices } = decisionPoint;
  return (
    <section
      className="decision-point"
      role="group"
      aria-label="Decision Point"
      data-testid="decision-point"
    >
      <h2>
        <GameText>{`Decision Point: ${title}`}</GameText>
      </h2>
      <p>
        <GameText>{description}</GameText>
      </p>
      <div className="decision-choices">
        {choices.map(
          ({ answer, label, riskBand, description: what }, index) => (
            <div key={answer} data-testid={`decision-choice-${answer}`}>
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
