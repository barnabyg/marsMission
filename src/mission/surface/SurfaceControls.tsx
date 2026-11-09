import type { Timeline } from "../../simulation/simulation";
import { GameText } from "../../ui/GameText";
import type { MissionViewId } from "../missionViews";
import { ascentStatus, type AscentNow } from "./ascent";
import { landingNowOn, sequenceStatus, type SequenceNow } from "./sequence";
import { describeSite, dustStormAt } from "./surface";

/** Why the surface view's button is disabled, which the button itself tells the player. */
export const surfaceUnavailableReason =
  "Surface view: nothing is on the surface and no landing is on its way.";

interface SurfaceControlsProps {
  timeline: Pick<Timeline, "assetsAtMars" | "mission" | "dustStorms">;
  day: number;
  view: MissionViewId;
  sites: readonly string[];
  site: string | null;
  sequence: SequenceNow | null;
  ascent: AscentNow | null;
  onPickSite: (siteName: string) => void;
}

/** Which Landing Site the surface view is showing and what's there, while it's showing one. */
export function SurfaceControls({
  timeline,
  day,
  view,
  sites,
  site,
  sequence,
  ascent,
  onPickSite,
}: SurfaceControlsProps) {
  if (site === null || view !== "surface") return null;
  const status = sequenceStatus(sequence, site) ?? ascentStatus(ascent, site);
  const storm = dustStormAt(timeline, day, site);
  return (
    <>
      <h2>
        <GameText heading>Landing Site</GameText>
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
          ...(storm === null
            ? []
            : [`Dust storm: ${Math.ceil(storm.toDay - day)} days left`]),
          ...describeSite(
            timeline,
            day,
            site,
            ascent?.sequence.siteName === site,
            landingNowOn(sequence, site),
          ),
        ].map((line) => (
          <li key={line}>
            <GameText>{line}</GameText>
          </li>
        ))}
      </ul>
    </>
  );
}
