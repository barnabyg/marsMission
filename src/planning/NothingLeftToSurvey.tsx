import type { PlannedActivity } from "../simulation/simulation";
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
