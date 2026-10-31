import type { Timeline } from "../../simulation/simulation";
import { GameText } from "../../ui/GameText";
import type { MissionViewId } from "../missionViews";
import { sequenceStatus, type SequenceNow } from "./sequence";
import { describeSite } from "./surface";

/** Ties the reason on screen to the disabled button it explains. */
export const surfaceUnavailableId = "surface-unavailable";

interface SurfaceControlsProps {
  timeline: Pick<Timeline, "assetsAtMars" | "mission">;
  day: number;
  view: MissionViewId;
  sites: readonly string[];
  site: string | null;
  sequence: SequenceNow | null;
  onPickSite: (siteName: string) => void;
}

/** Why the surface view can't be chosen, or else which Landing Site it's showing and what's there. */
export function SurfaceControls({
  timeline,
  day,
  view,
  sites,
  site,
  sequence,
  onPickSite,
}: SurfaceControlsProps) {
  if (site === null) {
    return (
      <p id={surfaceUnavailableId} data-testid={surfaceUnavailableId}>
        Surface view: nothing is on the surface and no landing is on its way.
      </p>
    );
  }
  if (view !== "surface") return null;
  const status = sequenceStatus(sequence, site);
  return (
    <>
      <h2>
        <GameText>Landing Site</GameText>
      </h2>
      <p>
        <strong data-testid="surface-site">{site}</strong>
      </p>
      {sites.length > 1 && (
        <label className="surface-site-choice">
          <span>Show</span>
          <select
            aria-label="Landing Site to show"
            value={site}
            onChange={(event) => {
              onPickSite(event.target.value);
            }}
          >
            {sites.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}
      <ul data-testid="surface-status">
        {[
          ...(status === null ? [] : [status]),
          ...describeSite(timeline, day, site),
        ].map((line) => (
          <li key={line}>
            <GameText>{line}</GameText>
          </li>
        ))}
      </ul>
    </>
  );
}
