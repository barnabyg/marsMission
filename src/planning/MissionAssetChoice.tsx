import { useId } from "react";
import {
  canFly,
  formatMoney,
  formatPropellant,
  type AssetChoices,
  type PlannedAsset,
  type ProgramView,
} from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { Icon } from "../ui/Icon";
import { ActivitySelect } from "./ActivitySelect";
import { assetImageUrl } from "./assetImages";
import { describeBenefitImpact } from "./benefitImpactText";
import { fitReason, type Fit } from "./missionFit";
import { ReadinessTag } from "./ReadinessTag";
import { UnavailableReason } from "./UnavailableReason";

interface MissionAssetChoiceProps {
  asset: ProgramView["assets"][number];
  /** The choices for this Asset, which only an Asset on the Mission has. */
  planned: PlannedAsset | undefined;
  /** How many of this Asset are operating at Mars this Turn, which keep working without being launched again. */
  operatingCount: number;
  carried: boolean;
  /** Whether ticking it would take the Mission over its Launch Vehicle's capacity or the Money, which stops it being ticked. */
  fit: Fit;
  onCarriedChange: (carried: boolean) => void;
  onChoicesChange: (choices: AssetChoices) => void;
}

/**
 * One Asset the Mission can carry, as a card: a picture of its model, its cost, mass, Technology Readiness, Benefit and how many are at Mars,
 * greyed out, with the reason on hovering, when it can't be ticked. Ticking it reveals its Activity and Service Life; its Reliability is with the Mission Events'.
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
  const reasonId = useId();
  // Something ticked can always be unticked, even once it no longer fits.
  const reason = carried
    ? undefined
    : flies
      ? fitReason(fit)
      : "Needs Development before it can fly.";
  return (
    <div
      className={[
        "asset-choice",
        "asset-card",
        carried && "carried",
        reason && "unavailable",
      ]
        .filter(Boolean)
        .join(" ")}
      title={reason}
    >
      {/* Its name is beside it, so the picture adds nothing for a screen reader. */}
      <img
        className="asset-card-image"
        src={assetImageUrl(asset.kind)}
        alt=""
      />
      <label className="asset-card-title">
        <input
          type="checkbox"
          checked={carried}
          // It can't fly until its Development has finished, which the Development panel shows, and can't be ticked
          // while it wouldn't fit or can't be afforded.
          disabled={reason !== undefined}
          aria-describedby={reason && reasonId}
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
        {asset.benefit && asset.benefitImpact && (
          // It shows the Science its Benefit would add this Turn, and its tooltip says what the Benefit does and why
          // it adds that much, after what a Benefit is.
          <span
            className="term benefit-tag"
            data-term="Benefit"
            data-detail={`${asset.name}: ${asset.benefit} ${describeBenefitImpact(asset.benefitImpact)}`}
            data-testid="benefit-tag"
            tabIndex={0}
          >
            Benefit +{asset.benefitImpact.extraScience} Science
          </span>
        )}
        {asset.benefit && asset.makes && (
          // It shows the ascent propellant it would make over a whole Turn at Mars, and its tooltip says what it makes
          // and where, after what a Benefit is.
          <span
            className="term benefit-tag"
            data-term="Benefit"
            data-detail={`${asset.name}: ${asset.benefit} Over a whole Turn at Mars it makes ${formatPropellant(asset.makes.ascentPropellantKgPerTurn)}.`}
            data-testid="benefit-tag"
            tabIndex={0}
          >
            Benefit +{formatPropellant(asset.makes.ascentPropellantKgPerTurn)}{" "}
            propellant
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
      <UnavailableReason id={reasonId} reason={reason} />
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
        </div>
      )}
    </div>
  );
}
