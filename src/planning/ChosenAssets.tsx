import {
  formatDays,
  formatMoney,
  onlyGrantsPay,
  serviceLifeGain,
  type AssetChoices,
  type PlannedAsset,
  type PlannedServiceLife,
} from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { ActivityEarnings, ActivitySelect } from "./ActivitySelect";

interface ChosenAssetsProps {
  /** The Assets ticked for the Mission, in the order the catalogue lists them, with the choices made for each. */
  plannedAssets: PlannedAsset[];
  /** Each Asset's name, by id. */
  nameOf: (assetId: string) => string;
  onChoicesChange: (assetId: string, choices: AssetChoices) => void;
}

/**
 * A Service Life as its choice names it: the shortest with its cost, and a longer one with the days it adds, roughly in
 * Turns, and the Research Grants the chosen Activity would earn over them against its cost and their Upkeep.
 */
function serviceLifeLabel(option: PlannedServiceLife): string {
  return option.extraDays > 0
    ? `${formatDays(option.days)}: ${serviceLifeGain(option)}`
    : `${formatDays(option.days)} (${formatMoney(option.costMillions)})`;
}

/** What each longer Service Life says it earns, on hovering its label and its choice. */
const serviceLifePayback = `Each longer Service Life says the Research Grants the Asset's Activity would earn over the days it adds, if the Asset doesn't fail, against its cost and the Upkeep of those Turns. ${onlyGrantsPay}`;

/**
 * The choices for each Asset ticked for the Mission, in one place under the cards, so that ticking a card never changes
 * its height or its neighbours': one row per Asset with its Activity and Service Life side by side, and what the chosen
 * Activity earns as a line under them. Its Reliability is with the Mission Events'. Nothing while nothing is ticked.
 */
export function ChosenAssets({
  plannedAssets,
  nameOf,
  onChoicesChange,
}: ChosenAssetsProps) {
  if (plannedAssets.length === 0) return null;
  return (
    <div className="chosen-assets" data-testid="chosen-assets">
      <p className="chosen-assets-heading">
        <GameText>Chosen for this Mission</GameText>
      </p>
      <ul className="plain-list">
        {plannedAssets.map((planned) => {
          const name = nameOf(planned.assetId);
          return (
            <li key={planned.assetId} data-testid="chosen-asset">
              <span className="chosen-asset-name">{name}</span>
              <span className="chosen-asset-choice">
                <span>
                  <GameText>Activity</GameText>
                </span>
                <ActivitySelect
                  assetName={name}
                  activityId={planned.activityId}
                  activities={planned.activities}
                  onChange={(activityId) => {
                    onChoicesChange(planned.assetId, { activityId });
                  }}
                />
              </span>
              <span className="chosen-asset-choice">
                {/* Its tooltip says how to read each longer Service Life's choice, after what a Service Life is. */}
                <span
                  className="term"
                  data-term="Service Life"
                  data-detail={serviceLifePayback}
                >
                  Service Life
                </span>
                <select
                  aria-label={`Service Life for ${name}`}
                  title={serviceLifePayback}
                  value={planned.serviceLifeDays}
                  onChange={(event) => {
                    onChoicesChange(planned.assetId, {
                      serviceLifeDays: Number(event.target.value),
                    });
                  }}
                >
                  {planned.serviceLifeOptions.map((option) => (
                    <option key={option.days} value={option.days}>
                      {serviceLifeLabel(option)}
                    </option>
                  ))}
                </select>
              </span>
              <ActivityEarnings
                activityId={planned.activityId}
                activities={planned.activities}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
