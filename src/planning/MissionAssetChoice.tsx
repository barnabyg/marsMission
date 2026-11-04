import {
  canFly,
  formatMoney,
  type AssetChoices,
  type PlannedAsset,
  type ProgramView,
} from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { Icon } from "../ui/Icon";
import { ActivitySelect } from "./ActivitySelect";
import { FitWarning } from "./FitWarning";
import type { Fit } from "./missionFit";
import { ReadinessTag } from "./ReadinessTag";

interface MissionAssetChoiceProps {
  asset: ProgramView["assets"][number];
  /** The choices for this Asset, which only an Asset on the Mission has. */
  planned: PlannedAsset | undefined;
  /** How many of this Asset are operating at Mars this Turn, which keep working without being launched again. */
  operatingCount: number;
  carried: boolean;
  /** Whether ticking it would take the Mission over its Launch Vehicle's capacity or the Money. */
  fit: Fit;
  onCarriedChange: (carried: boolean) => void;
  onChoicesChange: (choices: AssetChoices) => void;
}

/**
 * One Asset the Mission can carry, as a card: its cost, mass, Technology Readiness, Benefit and how many are at Mars,
 * and whether it would fit. Ticking it reveals its choices.
 */
export function MissionAssetChoice({
  asset,
  planned,
  operatingCount,
  carried,
  fit,
  onCarriedChange,
  onChoicesChange,
}: MissionAssetChoiceProps) {
  const flies = canFly(asset);
  return (
    <div
      className={[
        "asset-choice",
        "asset-card",
        carried && "carried",
        !flies && "unavailable",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <label className="asset-card-title">
        <input
          type="checkbox"
          checked={carried}
          // It can't fly until its Development has finished, which the Development panel shows.
          disabled={!flies}
          onChange={(event) => {
            onCarriedChange(event.target.checked);
          }}
        />
        {asset.name}
      </label>
      <div className="asset-card-facts">
        <span data-testid="asset-cost">
          <Icon name="coins" label="Cost" />
          {formatMoney(asset.costMillions)}
        </span>
        <span data-testid="asset-mass">
          <Icon name="weight" label="Mass" />
          {asset.massTonnes} t
        </span>
        <ReadinessTag
          readiness={asset.technologyReadiness}
          testId="technology-readiness"
        />
        {asset.benefit && (
          // Its tooltip says what this Asset's Benefit does, after what a Benefit is.
          <span
            className="term benefit-tag"
            data-term="Benefit"
            data-detail={`${asset.name}: ${asset.benefit}`}
            data-testid="benefit-tag"
            tabIndex={0}
          >
            Benefit
          </span>
        )}
        {operatingCount > 0 && (
          // Its tooltip says the one at Mars keeps working, after what an Asset is.
          <span
            className="term operating-tag"
            data-term="Asset"
            data-detail={`${asset.name} operating at Mars: ${operatingCount}. Each keeps working without being launched again, so ticking this launches another.`}
            data-testid="operating-tag"
            tabIndex={0}
          >
            {operatingCount} at Mars
          </span>
        )}
      </div>
      {/* Only before ticking, and only for an Asset that could be ticked: once on the Mission, the budget bar says it. */}
      {!carried && flies && <FitWarning fit={fit} />}
      {planned && (
        <div className="asset-card-choices">
          <span>
            <GameText>Activity</GameText>
          </span>
          <ActivitySelect
            assetName={asset.name}
            activityId={planned.activityId}
            activities={planned.activities}
            onChange={(activityId) => {
              onChoicesChange({ activityId });
            }}
          />
          <span>
            <GameText>Service Life</GameText>
          </span>
          <select
            aria-label={`Service Life for ${asset.name}`}
            value={planned.serviceLifeDays}
            onChange={(event) => {
              onChoicesChange({ serviceLifeDays: Number(event.target.value) });
            }}
          >
            {planned.serviceLifeOptions.map((option) => (
              <option key={option.days} value={option.days}>
                {option.days} days ({formatMoney(option.costMillions)})
              </option>
            ))}
          </select>
          <span>
            <GameText>Reliability</GameText>
          </span>
          <select
            aria-label={`Reliability for ${asset.name} in service`}
            value={planned.reliabilityLevelId}
            onChange={(event) => {
              onChoicesChange({ reliabilityLevelId: event.target.value });
            }}
          >
            {planned.reliabilityLevels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name} ({formatMoney(level.costMillions)},{" "}
                {level.riskBand})
              </option>
            ))}
          </select>
          <strong className="asset-card-risk" data-testid="asset-risk-band">
            <GameText>{`${planned.riskBand} per Turn`}</GameText>
          </strong>
        </div>
      )}
    </div>
  );
}
