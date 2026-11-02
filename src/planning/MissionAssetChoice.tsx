import {
  formatMoney,
  type AssetChoices,
  type PlannedAsset,
  type ProgramView,
} from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { ActivitySelect } from "./ActivitySelect";
import { canFly, ReadinessTag } from "./ReadinessTag";

interface MissionAssetChoiceProps {
  asset: ProgramView["assets"][number];
  /** The choices for this Asset, which only an Asset on the Mission has. */
  planned: PlannedAsset | undefined;
  carried: boolean;
  onCarriedChange: (carried: boolean) => void;
  onChoicesChange: (choices: AssetChoices) => void;
}

/** One Asset the Mission can carry and, if it does, the choices for that Asset. */
export function MissionAssetChoice({
  asset,
  planned,
  carried,
  onCarriedChange,
  onChoicesChange,
}: MissionAssetChoiceProps) {
  return (
    <div className="asset-choice">
      <label>
        <input
          type="checkbox"
          checked={carried}
          // It can't fly until its Development has finished, which the Development panel shows.
          disabled={!canFly(asset)}
          onChange={(event) => {
            onCarriedChange(event.target.checked);
          }}
        />
        {asset.name} ({formatMoney(asset.costMillions)}, {asset.massTonnes} t)
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
      </label>
      {planned && (
        <>
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
          <strong data-testid="asset-risk-band">
            <GameText>{`${planned.riskBand} per Turn`}</GameText>
          </strong>
        </>
      )}
    </div>
  );
}
