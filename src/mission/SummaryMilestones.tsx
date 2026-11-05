import type { TurnSummary } from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { Icon } from "../ui/Icon";

/** An achievement card for each Milestone earned in the Turn, with its reward and what the Program did. */
export function SummaryMilestones({
  milestones,
}: {
  milestones: TurnSummary["milestones"];
}) {
  if (milestones.length === 0) return null;
  return (
    <section className="summary-milestones">
      <h2>
        <GameText heading>
          {milestones.length === 1 ? "Milestone earned" : "Milestones earned"}
        </GameText>
      </h2>
      <ul>
        {milestones.map(({ name, description, science, publicSupport }) => (
          <li
            key={name}
            className="milestone-card"
            data-testid="summary-milestone"
          >
            <Icon name="trophy" className="milestone-icon" />
            <h3>
              <GameText heading>{name}</GameText>
              {/* So that a screen reader, and the text as a whole, reads "name: reward". */}
              <span className="visually-hidden">: </span>
            </h3>
            <p className="milestone-reward">
              <span>
                <Icon name="flask-conical" />
                <GameText>{`${science} Science`}</GameText>
              </span>
              <span className="visually-hidden"> and </span>
              <span>
                <Icon name="users" />
                <GameText>{`${publicSupport} Public Support`}</GameText>
              </span>
            </p>
            <p>
              <GameText>{description}</GameText>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
