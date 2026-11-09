import {
  whatActivityDoes,
  type PlannedActivity,
} from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { termFor } from "../ui/tooltips";

interface ActivitySelectProps {
  assetName: string;
  activityId: string;
  activities: PlannedActivity[];
  onChange: (activityId: string) => void;
}

/**
 * What an Activity does, as its choice says on hovering, with what Sample caching collects over a whole Turn and what
 * its samples earn once they reach Earth, and which Benefit raises its research, if one does.
 */
export function describeActivity({
  description,
  cachesPerTurn,
  raisedBy,
}: PlannedActivity): string {
  const caches = cachesPerTurn
    ? ` Over a whole Turn it collects ${String(cachesPerTurn.samples)} samples, which earn ${String(cachesPerTurn.science)} Science once they reach Earth.`
    : "";
  const raised = raisedBy
    ? ` ${raisedBy.givenBy.join(" and ")}'s Benefit adds ${String(raisedBy.percent)}% on the surface.`
    : "";
  return `${description}${caches}${raised}`;
}

/**
 * An Activity as its choice names it: the chosen one by its name alone, so that the closed choice never cuts it short,
 * as the line under the choice says what it earns, and the others with what they earn a Turn, so that the open list
 * compares them.
 */
const activityLabel = (activity: PlannedActivity, chosen: boolean) =>
  chosen ? activity.name : `${activity.name}: ${whatActivityDoes(activity)}`;

/**
 * What the chosen Activity earns a Turn, or does, written out under its choice, whose closed label is its name alone:
 * "Soil analysis earns 80 Science, 9 Public Support and $800M Research Grant a Turn."
 */
function chosenEarnings(
  activityId: string,
  activities: PlannedActivity[],
): string {
  const chosen = activities.find(({ id }) => id === activityId);
  return chosen ? `${chosen.name} ${whatActivityDoes(chosen)}.` : "";
}

/** What the chosen Activity earns a Turn, or does, as a muted line by its choice, whose closed label is its name alone. */
export function ActivityEarnings({
  activityId,
  activities,
}: {
  activityId: string;
  activities: PlannedActivity[];
}) {
  return (
    <span className="activity-earnings" data-testid="activity-earnings">
      <GameText>{chosenEarnings(activityId, activities)}</GameText>
    </span>
  );
}

/**
 * Whether the chosen Activity earns or collects something each Turn. Operating at Mars writes out only those, as a
 * busy Program's rows are too many to fit with a line for each Survey, whose choice already names it.
 */
export function chosenYields(
  activityId: string,
  activities: PlannedActivity[],
): boolean {
  const chosen = activities.find(({ id }) => id === activityId);
  if (!chosen) return false;
  const earns = chosen.earnsPerTurn;
  return (
    chosen.cachesPerTurn !== null ||
    (earns !== null &&
      earns.science + earns.publicSupport + earns.researchGrantMillions > 0)
  );
}

/** The choice of what one Asset does, each other Activity with what it earns a Turn. */
export function ActivitySelect({
  assetName,
  activityId,
  activities,
  onChange,
}: ActivitySelectProps) {
  const chosen = activities.find(({ id }) => id === activityId);
  return (
    <select
      aria-label={`Activity for ${assetName}`}
      // An option can't hold a tooltip, so a game term chosen here has it on the whole choice.
      data-term={chosen && termFor(chosen.name)}
      title={chosen && describeActivity(chosen)}
      value={activityId}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    >
      {activities.map((activity) => (
        <option key={activity.id} value={activity.id}>
          {activityLabel(activity, activity.id === activityId)}
        </option>
      ))}
    </select>
  );
}
