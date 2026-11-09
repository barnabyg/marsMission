import { useId } from "react";
import {
  canFly,
  formatMoney,
  type ProgramView,
} from "../simulation/simulation";
import { Icon } from "../ui/Icon";
import { assetImageUrl } from "./assetImages";
import { benefitTag } from "./benefitImpactText";
import { fitReason, type Fit } from "./missionFit";
import { ReadinessTag } from "./ReadinessTag";
import { UnavailableReason } from "./UnavailableReason";

interface MissionAssetChoiceProps {
  asset: ProgramView["assets"][number];
  /** How many of this Asset are operating at Mars this Turn, which keep working without being launched again. */
  operatingCount: number;
  carried: boolean;
  /** Whether ticking it would take the Mission over its Launch Vehicle's capacity or the Money, which stops it being ticked. */
  fit: Fit;
  onCarriedChange: (carried: boolean) => void;
  /** Opens the Asset's details, which only read the plan. */
  onShowDetails: () => void;
}

/**
 * One Asset the Mission can carry, as a card: a picture of its model, its cost, mass, its Technology Readiness if it
 * isn't Flight-proven, its Benefit if that would add anything this Turn, and how many are at Mars, greyed out, with the
 * reason on hovering, when it can't be ticked. The card keeps one height whether or not it is ticked: a ticked Asset's
 * Activity and Service Life are chosen under the cards (ChosenAssets.tsx), and its Reliability is with the Mission
 * Events'. Its info button opens its details.
 */
export function MissionAssetChoice({
  asset,
  operatingCount,
  carried,
  fit,
  onCarriedChange,
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
  const benefit = benefitTag(asset);
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
        {/* Flight-proven is the usual case and changes no decision, so only the other two are a pill here. */}
        {asset.technologyReadiness !== "flight-proven" && (
          <ReadinessTag
            readiness={asset.technologyReadiness}
            testId="technology-readiness"
            pill
          />
        )}
        {benefit && (
          // A fact in plain text: its tooltip says what the Benefit does and why it adds that much, after what a
          // Benefit is.
          <span
            className="benefit-tag"
            data-term="Benefit"
            data-detail={benefit.detail}
            data-testid="benefit-tag"
          >
            {benefit.text}
          </span>
        )}
        {operatingCount > 0 && (
          // A fact in plain text: its tooltip says the one at Mars keeps working, after what an Asset is.
          <span
            className="operating-tag"
            data-term="Asset"
            data-detail={`${asset.name} operating at Mars: ${operatingCount}. Each keeps working without being launched again, so ticking this launches another.`}
            data-testid="operating-tag"
          >
            {operatingCount} at Mars
          </span>
        )}
      </div>
      <UnavailableReason id={reasonId} reason={reason} />
    </div>
  );
}
