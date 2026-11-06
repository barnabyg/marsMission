import { useId } from "react";
import { formatMoney, type ProgramView } from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { Icon } from "../ui/Icon";
import { fitReason, type Fit } from "./missionFit";
import { UnavailableReason } from "./UnavailableReason";

interface ReturnVehicleChoiceProps {
  returnVehicle: ProgramView["crewedMission"]["returnVehicle"];
  /** The places at Mars with Crew who have no way home, whom a return vehicle can fetch. */
  places: ProgramView["crew"];
  /** The place whose Crew the return vehicle is for, by key, or null if the Mission carries none. */
  forCrewAt: string | null;
  /** Whether adding a return vehicle would take the Mission over its Launch Vehicle's capacity or the Money. */
  fit: Fit;
  onChange: (forCrewAt: string | null) => void;
}

/**
 * Whether the Mission carries a return vehicle, with or without Crew of its own, and which Crew at Mars with no way
 * home it is for. It is one line across the width of the Assets' cards, shown only while there are Crew to fetch, with
 * what it costs and weighs and how many Crew it has room for. A choice of Crew with more than it has room for is
 * marked, and the plan's problems say why it can't launch.
 */
export function ReturnVehicleChoice({
  returnVehicle,
  places,
  forCrewAt,
  fit,
  onChange,
}: ReturnVehicleChoiceProps) {
  const reasonId = useId();
  const [first] = places;
  if (!first) return null;
  const carried = forCrewAt !== null;
  // A return vehicle already chosen can always be taken off.
  const reason = carried ? undefined : fitReason(fit);
  return (
    <div
      className={`crew-choice return-vehicle-choice${carried ? " carried" : reason ? " unavailable" : ""}`}
      title={reason}
      data-testid="return-vehicle-choice"
    >
      <div className="asset-choice-row">
        <label title={returnVehicle.description}>
          <input
            type="checkbox"
            checked={carried}
            disabled={reason !== undefined}
            aria-describedby={reason && reasonId}
            onChange={(event) => {
              onChange(event.target.checked ? first.key : null);
            }}
          />
          <span>
            <GameText>{`Return vehicle ${returnVehicle.name}`}</GameText>
          </span>
        </label>
        <span className="asset-card-facts">
          <span>
            <Icon name="coins" label="Cost" />
            {formatMoney(returnVehicle.costMillions)}
          </span>
          <span>
            <Icon name="weight" label="Mass" />
            {returnVehicle.massTonnes} t
          </span>
          <span>
            <Icon name="users" label="Room for Crew" />
            room for {returnVehicle.crewRoom}
          </span>
        </span>
        <UnavailableReason id={reasonId} reason={reason} />
        {carried && (
          <>
            <span>for</span>
            <select
              aria-label="Crew to fetch"
              value={forCrewAt}
              onChange={(event) => {
                onChange(event.target.value);
              }}
            >
              {places.map(({ key, locationName, withoutWayHome }) => (
                <option key={key} value={key}>
                  {`${withoutWayHome.join(", ")} (${locationName})${withoutWayHome.length > returnVehicle.crewRoom ? ", no room" : ""}`}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
    </div>
  );
}
