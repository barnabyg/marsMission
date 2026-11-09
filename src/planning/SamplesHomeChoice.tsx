import { useId } from "react";
import type { ProgramView } from "../simulation/simulation";
import { formatDate } from "../ui/format";
import { GameText } from "../ui/GameText";
import { UnavailableReason } from "./UnavailableReason";

type SampleWayHome = ProgramView["sampleReturns"][number];

/**
 * The samples waiting at each Landing Site, with the Science they would earn once home, and the choice to send them
 * home this Turn, saying on hovering what would fly them and when they would leave and get home, or, greyed out, why
 * they can't go yet. Choosing them takes the Turn's one journey home.
 */
export function SamplesWaiting({
  samples,
  bringHome,
  onBringHomeChange,
}: {
  samples: SampleWayHome[];
  /** The journey home chosen this Turn, by key, if any, which may be Crew's. */
  bringHome: string | null;
  onBringHomeChange: (key: string, home: boolean) => void;
}) {
  if (samples.length === 0) return null;
  return (
    <ul className="operating-assets plain-list" data-testid="samples-waiting">
      {samples.map((way) => (
        <li key={way.key}>
          <span>
            <GameText>
              {`Samples at ${way.siteName}: ${String(way.samples)}, worth ${String(way.science)} Science once home`}
            </GameText>
          </span>
          <SamplesHomeChoice
            way={way}
            chosen={bringHome === way.key}
            onChange={(home) => {
              onBringHomeChange(way.key, home);
            }}
          />
        </li>
      ))}
    </ul>
  );
}

function SamplesHomeChoice({
  way,
  chosen,
  onChange,
}: {
  way: SampleWayHome;
  chosen: boolean;
  onChange: (home: boolean) => void;
}) {
  const reasonId = useId();
  // Something ticked can always be unticked, even once it is barred.
  const reason = chosen ? undefined : (way.reason ?? undefined);
  return (
    <label
      className={["end-mission", reason && "unavailable"]
        .filter(Boolean)
        .join(" ")}
      title={
        reason ??
        `The ${way.ascentVehicle ?? ""} lifts them off ${way.siteName} on ${formatDate(way.leavesMarsOn)}, and the ${way.orbiter ?? ""} brings them home on ${formatDate(way.homeOn)}, if the journey home goes well. It is this Turn's one journey home.`
      }
      data-testid="samples-home"
    >
      <input
        type="checkbox"
        checked={chosen}
        disabled={reason !== undefined}
        aria-describedby={reason && reasonId}
        aria-label={`Send the samples at ${way.siteName} home`}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      <GameText>Send home</GameText>
      <UnavailableReason id={reasonId} reason={reason} />
    </label>
  );
}
