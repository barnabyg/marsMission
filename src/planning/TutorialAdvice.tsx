import { stages, type PlanningAdvice } from "../tutorial/tutorial";
import { GameText } from "../ui/GameText";

interface TutorialAdviceProps {
  advice: PlanningAdvice;
}

/**
 * The tutorial's advice for this Planning session, as the tutorial strategy worked it out: why it changed course, if
 * it did, then the stage the Program is at, with the whole route behind a disclosure, then what to plan and why. It
 * only says: the player sets every control. The panel around it (TutorialPanel.tsx) says so.
 */
export function TutorialAdvice({ advice }: TutorialAdviceProps) {
  const { stage, changeOfCourse, items } = advice;
  const current = stages.findIndex(({ id }) => id === stage);
  const { name, aim } = stages[current] ?? { name: "", aim: "" };
  return (
    <div className="tutorial-advice" data-testid="tutorial-advice">
      {changeOfCourse !== null && (
        <p className="tutorial-change" data-testid="tutorial-change">
          <GameText>{changeOfCourse}</GameText>
        </p>
      )}
      <div className="tutorial-stage" data-testid="tutorial-stage">
        <h3>
          <GameText
            heading
          >{`Stage ${current + 1} of ${stages.length}: ${name}`}</GameText>
        </h3>
        <p>
          <GameText>{aim}</GameText>
        </p>
        {/* The whole route only when asked for, so that this Turn's advice comes first. */}
        <details className="tutorial-route-disclosure">
          <summary>Show the route</summary>
          <ol className="tutorial-route" aria-label="The route">
            {stages.map((each, index) => (
              <li
                key={each.id}
                aria-current={index === current ? "step" : undefined}
                className={index < current ? "done" : undefined}
              >
                <GameText>{each.name}</GameText>
              </li>
            ))}
          </ol>
        </details>
      </div>
      <h3>
        <GameText heading>This Turn</GameText>
      </h3>
      <ul className="tutorial-items" data-testid="tutorial-items">
        {items.map(({ topic, advice: what, reason }, index) => (
          <li key={`${topic}-${index}`} data-topic={topic}>
            <p>
              <GameText>{what}</GameText>
            </p>
            <p className="tutorial-reason">
              <GameText>{reason}</GameText>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
