import { useId } from "react";
import type { ProgramView } from "../simulation/simulation";
import { formatDate } from "../ui/format";
import { GameText } from "../ui/GameText";
import { UnavailableReason } from "./UnavailableReason";

type WayHome = ProgramView["crew"][number]["waysHome"][number];

/**
 * The choice to bring round-trip Crew home this Turn, saying on hovering when they would leave and get home, or, greyed
 * out, why they can't come home yet, such as too little ascent propellant at their Landing Site for Mars ascent.
 */
export function WayHomeChoice({
  way,
  chosen,
  onChange,
}: {
  way: WayHome;
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
        `${way.names.join(" and ")} leave Mars on ${formatDate(way.leavesMarsOn)} and are home on ${formatDate(way.homeOn)}, if the journey home goes well.`
      }
      data-testid="way-home"
    >
      <input
        type="checkbox"
        checked={chosen}
        disabled={reason !== undefined}
        aria-describedby={reason && reasonId}
        aria-label={`Bring ${way.names.join(" and ")} home`}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      <GameText>Bring home</GameText>
      <UnavailableReason id={reasonId} reason={reason} />
    </label>
  );
}
