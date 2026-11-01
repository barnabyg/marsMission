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
  const { missionEventName, contingencyName, description, use, decline } =
    decisionPoint;
  return (
    <section
      className="decision-point"
      role="group"
      aria-label="Decision Point"
      data-testid="decision-point"
    >
      <h2>
        <GameText>{`Decision Point: ${missionEventName}`}</GameText>
      </h2>
      <p>
        <GameText>{description}</GameText>
      </p>
      <div className="decision-choices">
        <div>
          <button
            type="button"
            className="primary"
            onClick={() => {
              onAnswer("use");
            }}
          >
            Use {contingencyName}
          </button>
          <p>
            <strong data-testid="decision-risk-band">
              <GameText>{`Risk Band: ${use.riskBand}`}</GameText>
            </strong>
          </p>
          <p>
            <GameText>{use.description}</GameText>
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => {
              onAnswer("decline");
            }}
          >
            Don't use it
          </button>
          <p>
            <GameText>{decline.description}</GameText>
          </p>
        </div>
      </div>
    </section>
  );
}
