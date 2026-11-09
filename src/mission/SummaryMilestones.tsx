import type { TurnSummary } from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { Icon } from "../ui/Icon";
import type { SummaryCardContent } from "./SummaryCard";

type Milestone = TurnSummary["milestones"][number] & { turn?: number | null };

const headingFor = (milestones: Milestone[]) =>
  milestones.length === 1 ? "Milestone earned" : "Milestones earned";

/**
 * An achievement for each Milestone earned, with its reward and what the Program did, and the Turn it was earned if
 * that is given, as the Program summary does.
 */
function MilestoneList({ milestones }: { milestones: Milestone[] }) {
  return (
    <ul className="milestone-list">
      {milestones.map(({ name, description, science, publicSupport, turn }) => (
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
          {typeof turn === "number" && (
            <p className="milestone-turn">
              <GameText>{`Earned on Turn ${String(turn)}`}</GameText>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The Program summary's Milestones, each an achievement card under one heading. */
export function SummaryMilestones({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) return null;
  return (
    <section className="summary-milestones">
      <h2>
        <GameText heading>{headingFor(milestones)}</GameText>
      </h2>
      <MilestoneList milestones={milestones} />
    </section>
  );
}

/** The Turn summary's card of the Milestones earned, across the screen when there are several. */
export function milestoneCards(milestones: Milestone[]): SummaryCardContent[] {
  if (milestones.length === 0) return [];
  return [
    {
      key: "milestones",
      heading: headingFor(milestones),
      wide: milestones.length > 1,
      className: "summary-milestones",
      content: <MilestoneList milestones={milestones} />,
    },
  ];
}
