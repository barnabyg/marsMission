import {
  whatActivityDoes,
  type PlannedActivity,
} from "../simulation/simulation";
import { termFor } from "../ui/tooltips";

interface ActivitySelectProps {
  assetName: string;
  activityId: string;
  activities: PlannedActivity[];
  onChange: (activityId: string) => void;
}

/**
 * What an Activity does, as its choice says on hovering, with what Sample caching collects over a whole Turn and what
 * its samples earn once they reach Earth.
 */
export function describeActivity({
  description,
  cachesPerTurn,
}: PlannedActivity): string {
  return cachesPerTurn
    ? `${description} Over a whole Turn it collects ${String(cachesPerTurn.samples)} samples, which earn ${String(cachesPerTurn.science)} Science once they reach Earth.`
    : description;
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
export function chosenEarnings(
  activityId: string,
  activities: PlannedActivity[],
): string {
  const chosen = activities.find(({ id }) => id === activityId);
  return chosen ? `${chosen.name} ${whatActivityDoes(chosen)}.` : "";
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
