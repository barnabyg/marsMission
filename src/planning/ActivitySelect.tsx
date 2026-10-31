import type { PlannedActivity } from "../simulation/simulation";
import { termFor } from "../ui/tooltips";

interface ActivitySelectProps {
  assetName: string;
  activityId: string;
  activities: PlannedActivity[];
  onChange: (activityId: string) => void;
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
      title={chosen?.description}
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
