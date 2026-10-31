import type { PlannedActivity } from "../simulation/simulation";

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
  return (
    <select
      aria-label={`Activity for ${assetName}`}
      title={activities.find(({ id }) => id === activityId)?.description}
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
