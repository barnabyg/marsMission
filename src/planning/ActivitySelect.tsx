import { formatMoney, type PlannedActivity } from "../simulation/simulation";
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
 * An Activity as its choice names it, with what it earns over a whole Turn in each of Science, Public Support and
 * Research Grant if it's research, or the samples it collects if it caches them, so that the choices can be compared.
 */
function activityLabel({
  name,
  earnsPerTurn,
  cachesPerTurn,
}: PlannedActivity): string {
  if (earnsPerTurn) {
    const { science, publicSupport, researchGrantMillions } = earnsPerTurn;
    return `${name}: ${String(science)} Science, ${String(publicSupport)} Public Support and ${formatMoney(researchGrantMillions)} Research Grant a Turn`;
  }
  return cachesPerTurn
    ? `${name}: ${String(cachesPerTurn.samples)} samples a Turn`
    : name;
}

/** The choice of what one Asset does, each Activity with what it earns a Turn. */
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
          {activityLabel(activity)}
        </option>
      ))}
    </select>
  );
}
