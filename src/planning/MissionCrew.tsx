import {
  formatMoney,
  type PlannedCrew,
  type ProgramView,
} from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { ActivitySelect } from "./ActivitySelect";

interface MissionCrewProps {
  crewedMission: ProgramView["crewedMission"];
  /** The Crew chosen for the Mission, which only a Crewed Mission has. */
  planned: PlannedCrew | null;
  onCrewSizeChange: (size: number | null) => void;
  onActivityChange: (activityId: string) => void;
  /** Whether the Crew land at the Mission's Landing Site, rather than staying in Mars orbit. */
  lands: boolean;
  onLandsChange: (lands: boolean) => void;
  onSuppliesChange: (suppliesId: string) => void;
}

/**
 * Whether the Mission carries Crew and, if it does, how many, who they are, whether they land, the Supplies they carry
 * and what they will do at Mars. It is a row among the Assets, without their class, so that ticking Assets leaves it alone. Landing brings in
 * the Landing Site choice below the Assets, which a lander shares.
 */
export function MissionCrew({
  crewedMission,
  planned,
  onCrewSizeChange,
  onActivityChange,
  lands,
  onLandsChange,
  onSuppliesChange,
}: MissionCrewProps) {
  const { vehicleName, sizes, maxHealth, namesLeft } = crewedMission;
  const smallest = sizes[0];
  return (
    <div className="asset-choice-row crew-choice">
      <label>
        <input
          type="checkbox"
          checked={planned !== null}
          // Every name has been given, so no one is left to fly.
          disabled={!smallest || namesLeft < smallest.crew}
          onChange={(event) => {
            onCrewSizeChange(
              event.target.checked ? (smallest?.crew ?? null) : null,
            );
          }}
        />
        {/* One piece, so that the label's gaps don't split it at each game term. */}
        <span>
          <GameText>{`Crewed Mission aboard the ${vehicleName}`}</GameText>
        </span>
        {planned && (
          // Its tooltip names who would fly, after what Health is, which keeps the row to one line.
          <span
            className="term operating-tag"
            data-term="Health"
            data-detail={`Flying: ${planned.names.join(", ")}, each starting at Health ${maxHealth}. Radiation on the way leaves them ${planned.arrivalHealth} as they reach Mars.`}
            data-testid="crew-names"
            tabIndex={0}
          >
            Health {maxHealth} each
          </span>
        )}
      </label>
      {planned && (
        <>
          <span>
            <GameText>Crew size</GameText>
          </span>
          <select
            aria-label="Crew size"
            value={planned.size}
            onChange={(event) => {
              onCrewSizeChange(Number(event.target.value));
            }}
          >
            {sizes.map(({ crew, costMillions, massTonnes }) => (
              <option key={crew} value={crew}>
                {crew} ({formatMoney(costMillions)}, {massTonnes} t)
              </option>
            ))}
          </select>
          <select
            aria-label="Crew destination"
            value={lands ? "landingSite" : "marsOrbit"}
            onChange={(event) => {
              onLandsChange(event.target.value === "landingSite");
            }}
          >
            <option value="marsOrbit">to Mars orbit</option>
            <option value="landingSite">to land</option>
          </select>
          <span>
            <GameText>Supplies</GameText>
          </span>
          {/* Each says how long it lasts this Crew, from launch. */}
          <select
            aria-label="Supplies"
            value={planned.suppliesId}
            onChange={(event) => {
              onSuppliesChange(event.target.value);
            }}
          >
            {planned.supplies.map(({ id, days, costMillions, massTonnes }) => (
              <option key={id} value={id}>
                {days.toLocaleString("en")} days ({formatMoney(costMillions)},{" "}
                {massTonnes} t)
              </option>
            ))}
          </select>
          <span>
            <GameText>Activity</GameText>
          </span>
          {planned.joining === null ? (
            <ActivitySelect
              assetName="the Crew"
              activityId={planned.activityId}
              activities={planned.activities}
              onChange={onActivityChange}
            />
          ) : (
            <span data-testid="crew-joining">
              <GameText>{`as the Crew in ${planned.joining}`}</GameText>
            </span>
          )}
        </>
      )}
    </div>
  );
}
