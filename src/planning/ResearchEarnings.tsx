import type { PlannedActivity } from "../simulation/simulation";
import { GameText } from "../ui/GameText";

/** What each research Activity on offer earns, once each however many Assets can do it. */
export function ResearchEarnings({
  activities,
}: {
  activities: PlannedActivity[];
}) {
  const earnings = new Map(
    activities.flatMap(({ name, earnsPerTurn }) =>
      earnsPerTurn
        ? [
            [
              name,
              `${name} earns ${earnsPerTurn.science} Science${
                earnsPerTurn.publicSupport > 0
                  ? ` and ${earnsPerTurn.publicSupport} Public Support`
                  : ""
              }.`,
            ] as const,
          ]
        : [],
    ),
  );
  if (earnings.size === 0) return null;
  return (
    <p data-testid="research-earnings">
      <GameText>
        {`Ongoing Research for a whole Turn: ${[...earnings.values()].join(" ")}`}
      </GameText>
    </p>
  );
}
