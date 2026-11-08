import { useId } from "react";
import {
  canFly,
  formatDays,
  formatMoney,
  onlyGrantsPay,
  serviceLifeGain,
  formatPropellant,
  type AssetChoices,
  type PlannedAsset,
  type PlannedServiceLife,
  type ProgramView,
} from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { Icon } from "../ui/Icon";
import { ActivitySelect } from "./ActivitySelect";
import { assetImageUrl } from "./assetImages";
import {
  describeBenefitImpact,
  describeGrantImpact,
} from "./benefitImpactText";
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
  /** Opens the Asset's details, which only read the plan. */
  onShowDetails: () => void;
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

/** What each longer Service Life says it earns, on hovering its choice and under the Assets. */
export const serviceLifePayback = `Each longer Service Life says the Research Grants the Asset's Activity would earn over the days it adds, if the Asset doesn't fail, against its cost and the Upkeep of those Turns. ${onlyGrantsPay}`;

/**
 * One Asset the Mission can carry, as a card: a picture of its model, its cost, mass, Technology Readiness, Benefit and how many are at Mars,
 * greyed out, with the reason on hovering, when it can't be ticked. Ticking it reveals its Activity and Service Life; its Reliability is with the Mission Events'.
 * Its info button opens its details.
 */
export function MissionAssetChoice({
  asset,
  planned,
  operatingCount,
  carried,
  fit,
  onCarriedChange,
  onChoicesChange,
  onShowDetails,
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
      {/* Outside the label, so that it never ticks the Asset, and open even when the Asset can't be ticked. */}
      <button
        type="button"
        className="asset-info"
        aria-label={`About ${asset.name}`}
        title={`About ${asset.name}`}
        onClick={onShowDetails}
      >
        <Icon name="info" />
      </button>
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
        {asset.benefit && asset.grantImpact && (
          // It shows the money its Benefit would add this Turn where it would add most, and its tooltip says what the
          // Benefit does and where it would add that much, after what a Benefit is.
          <span
            className="term benefit-tag"
            data-term="Benefit"
            data-detail={`${asset.name}: ${asset.benefit} ${describeGrantImpact(asset.grantImpact)}`}
            data-testid="benefit-tag"
            tabIndex={0}
          >
            Benefit +{formatMoney(asset.grantImpact.extraGrantMillions)}
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
        {asset.benefit && asset.habitat && (
          // It shows how many more days it would give a Crew member at Mars, and its tooltip says what it does for the
          // Crew there and what those days assume, after what a Benefit is.
          <span
            className="term benefit-tag"
            data-term="Benefit"
            data-detail={`${asset.name}: ${asset.benefit} A Crew member landing beside it with full Health and no Protection would last about ${asset.habitat.extraDays.toLocaleString("en")} more days at Mars before their Health runs out.`}
            data-testid="benefit-tag"
            tabIndex={0}
          >
            Benefit +{asset.habitat.extraDays.toLocaleString("en")} days
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
            title={serviceLifePayback}
            value={planned.serviceLifeDays}
            onChange={(event) => {
              onChoicesChange({ serviceLifeDays: Number(event.target.value) });
            }}
          >
            {planned.serviceLifeOptions.map((option) => (
              <option key={option.days} value={option.days}>
                {serviceLifeLabel(option)}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
