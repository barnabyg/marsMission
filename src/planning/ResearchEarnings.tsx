import { formatMoney, type PlannedActivity } from "../simulation/simulation";
import { GameText } from "../ui/GameText";

/** Whether an Asset's current Activity is a Survey. */
export function isSurveying(
  activityId: string,
  activities: PlannedActivity[],
): boolean {
  return activities.some(({ id, surveys }) => id === activityId && surveys);
}

/** An Asset set to Survey with nothing left would otherwise sit idle with no sign of it. */
export function NothingLeftToSurvey() {
  return (
    <p data-testid="nothing-left-to-survey">
      <GameText>
        Nothing is left to Survey, so an Asset set to Survey does nothing.
      </GameText>
    </p>
  );
}

/** What each research Activity on offer earns and any Research Grant it pays, once each however many Assets can do it. */
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
              }${
                earnsPerTurn.researchGrantMillions > 0
                  ? `, and pays a ${formatMoney(earnsPerTurn.researchGrantMillions)} Research Grant`
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
