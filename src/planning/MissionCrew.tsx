import { useId } from "react";
import {
  formatMoney,
  formatPropellant,
  type PlannedCrew,
  type ProgramView,
} from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { Icon } from "../ui/Icon";
import { ActivityEarnings, ActivitySelect } from "./ActivitySelect";
import { assetImageUrl, crewImageKind } from "./assetImages";
import { fitReason, type Fit } from "./missionFit";
import { UnavailableReason } from "../ui/UnavailableReason";

/** What each level of Protection would leave the Crew on arriving, such as " (with Protection: None 80, Light shielding 85)". */
function protectionDetail({ protection }: PlannedCrew): string {
  if (protection.length < 2) return "";
  const each = protection.map(
    ({ name, arrivalHealth }) => `${name} ${arrivalHealth}`,
  );
  return ` (with Protection: ${each.join(", ")})`;
}

interface MissionCrewProps {
  crewedMission: ProgramView["crewedMission"];
  /** The Crew chosen for the Mission, which only a Crewed Mission has. */
  planned: PlannedCrew | null;
  /** Whether adding the smallest Crew would take the Mission over its Launch Vehicle's capacity or the Money, which stops it being ticked. */
  fit: Fit;
  onCrewSizeChange: (size: number | null) => void;
  onActivityChange: (activityId: string) => void;
  /** Whether the Crew land at the Mission's Landing Site, rather than staying in Mars orbit. */
  lands: boolean;
  onLandsChange: (lands: boolean) => void;
  onSuppliesChange: (suppliesId: string) => void;
  onProtectionChange: (protectionId: string) => void;
  /** Whether the Crew go on a round trip, with an Earth return stage to bring them home on a later Turn. */
  roundTrip: boolean;
  onRoundTripChange: (roundTrip: boolean) => void;
}

/**
 * Whether the Mission carries Crew and, if it does, how many, who they are, whether they land, the Supplies and
 * Protection they carry, whether they go on a round trip and what they will do at Mars. It is a card across the width of the Assets' cards, without
 * their `asset-choice` class, so that ticking Assets leaves it alone, with the Supplies and Protection on a second
 * line. Before it is ticked, it shows what the smallest Crew costs and weighs, greyed out with the reason on hovering if they wouldn't fit. Landing brings in the Landing Site
 * choice below the Assets, which a lander shares.
 */
export function MissionCrew({
  crewedMission,
  planned,
  fit,
  onCrewSizeChange,
  onActivityChange,
  lands,
  onLandsChange,
  onSuppliesChange,
  onProtectionChange,
  roundTrip,
  onRoundTripChange,
}: MissionCrewProps) {
  const { vehicleName, sizes, maxHealth, namesLeft } = crewedMission;
  const smallest = sizes[0];
  const reasonId = useId();
  // Crew already chosen can always be taken off.
  const reason = planned
    ? undefined
    : !smallest || namesLeft < smallest.crew
      ? "Not enough Crew are left to fly."
      : fitReason(fit);
  return (
    <div
      className={
        planned
          ? "crew-choice carried"
          : reason
            ? "crew-choice unavailable"
            : "crew-choice"
      }
      title={reason}
    >
      <div className="asset-choice-row">
        {/* Its words are beside it, so the picture of the Crew's lander adds nothing for a screen reader. */}
        <img
          className="crew-choice-image"
          src={assetImageUrl(crewImageKind)}
          alt=""
        />
        <label>
          <input
            type="checkbox"
            checked={planned !== null}
            // Every name has been given, so no one is left to fly, or the smallest Crew wouldn't fit or can't be afforded.
            disabled={reason !== undefined}
            aria-describedby={reason && reasonId}
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
              data-detail={`Flying: ${planned.names.join(", ")}, each starting at Health ${maxHealth}. Radiation on the way leaves them ${planned.arrivalHealth} as they reach Mars${protectionDetail(planned)}.`}
              data-testid="crew-names"
            >
              Health {maxHealth} each
            </span>
          )}
        </label>
        {!planned && smallest && (
          <span className="asset-card-facts" data-testid="crew-facts">
            <span>
              <Icon name="coins" label="Cost" />
              from {formatMoney(smallest.costMillions)}
            </span>
            <span>
              <Icon name="weight" label="Mass" />
              {smallest.massTonnes} t
            </span>
          </span>
        )}
        <UnavailableReason id={reasonId} reason={reason} />
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
              <GameText>Activity</GameText>
            </span>
            {planned.joining === null ? (
              <>
                <ActivitySelect
                  assetName="the Crew"
                  activityId={planned.activityId}
                  activities={planned.activities}
                  onChange={onActivityChange}
                />
                <ActivityEarnings
                  activityId={planned.activityId}
                  activities={planned.activities}
                />
              </>
            ) : (
              <span data-testid="crew-joining">
                <GameText>{`as the Crew in ${planned.joining}`}</GameText>
              </span>
            )}
          </>
        )}
      </div>
      {planned && (
        // The Safety Margin and Supplies go on a line of their own, under the Crew's other choices, as one line is too
        // narrow for them all at 150% display scaling.
        <div className="asset-choice-row crew-choice-second-line">
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
            <GameText>Protection</GameText>
          </span>
          {/* Each says by how much it slows radiation's harm; the tooltip says what that leaves the Crew on arriving. */}
          <select
            aria-label="Protection"
            value={planned.protectionId}
            onChange={(event) => {
              onProtectionChange(event.target.value);
            }}
          >
            {planned.protection.map(
              ({ id, name, radiationCutPercent, costMillions, massTonnes }) => (
                <option key={id} value={id}>
                  {radiationCutPercent === 0
                    ? name
                    : `${name}, radiation −${radiationCutPercent}% (${formatMoney(costMillions)}, ${massTonnes} t)`}
                </option>
              ),
            )}
          </select>
          {/* Crew who land also need ascent propellant at their Landing Site to come home, which the tooltip says. */}
          <label
            className="round-trip-choice"
            title={
              lands
                ? `To come home, Mars ascent will need ${formatPropellant(crewedMission.roundTrip.ascentPropellantKg)} of ascent propellant at their Landing Site, which a fuel plant there makes.`
                : undefined
            }
          >
            <input
              type="checkbox"
              checked={roundTrip}
              aria-label="Round trip"
              onChange={(event) => {
                onRoundTripChange(event.target.checked);
              }}
            />
            <span>
              <GameText>{`Round trip (+${formatMoney(crewedMission.roundTrip.costMillions)}, +${crewedMission.roundTrip.massTonnes} t)`}</GameText>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
