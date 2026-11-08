import type { PlannedActivity } from "../simulation/simulation";
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

/** The choice of what one Asset does. */
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
          {activity.name}
        </option>
      ))}
    </select>
  );
}
