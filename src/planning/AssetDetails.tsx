import type { ReactNode } from "react";
import {
  formatMoney,
  type PlannedActivity,
  type PlannedAsset,
  type ProgramView,
} from "../simulation/simulation";
import { Dialog } from "../ui/Dialog";
import { GameText } from "../ui/GameText";
import { describeActivity } from "./ActivitySelect";
import { benefitThisTurn } from "./benefitImpactText";
import { ReadinessTag } from "./ReadinessTag";

interface AssetDetailsProps {
  asset: ProgramView["assets"][number];
  /** Its Service Life, Activities and Reliability as the Mission would have them, previewed on its own if it isn't on it. */
  planned: PlannedAsset;
  onClose: () => void;
}

/** One fact about the Asset, named so that a test can find it, as a term and its value. */
function Fact({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div data-testid={`detail-${name}`}>
      <dt>
        <GameText>{name}</GameText>
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

/** What an Activity does, as its choice says on hovering, and what it earns over a whole Turn in service if it's research. */
function activityDetails(activity: PlannedActivity): string {
  const { earnsPerTurn } = activity;
  const earns = earnsPerTurn
    ? ` Over a whole Turn it earns ${earnsPerTurn.science} Science and ${earnsPerTurn.publicSupport} Public Support${
        earnsPerTurn.researchGrantMillions > 0
          ? `, with a ${formatMoney(earnsPerTurn.researchGrantMillions)} Research Grant`
          : ""
      }.`
    : "";
  return `${activity.name}: ${describeActivity(activity)}${earns}`;
}

/**
 * An Asset's details, opened from its card in Planning Mode: what it is and does in plain words, then every figure that
 * matters when choosing it. It only reads the plan, so closing it leaves the Mission as it was.
 */
export function AssetDetails({ asset, planned, onClose }: AssetDetailsProps) {
  return (
    <Dialog title={asset.name} cancelLabel="Close" onClose={onClose}>
      <div className="asset-details">
        <p data-testid="asset-description">
          <GameText>{asset.description}</GameText>
        </p>
        <dl>
          <Fact name="Cost">{formatMoney(asset.costMillions)}</Fact>
          <Fact name="Mass">{asset.massTonnes} t</Fact>
          <Fact name="Upkeep">
            <GameText>{`${formatMoney(asset.upkeepMillionsPerTurn)} per Turn`}</GameText>
          </Fact>
          <Fact name="Technology Readiness">
            <ReadinessTag
              readiness={asset.technologyReadiness}
              testId="detail-readiness"
            />
          </Fact>
          <Fact name="Lands">
            <GameText>
              {asset.landsAtSite ? "At a Landing Site" : "No, stays in orbit"}
            </GameText>
          </Fact>
          <Fact name="Service Life">
            {planned.serviceLifeOptions
              .map(
                ({ days, costMillions }) =>
                  `${days} days (${formatMoney(costMillions)})`,
              )
              .join(" or ")}
          </Fact>
          <Fact name="Reliability">
            <GameText>
              Chance of failing in service, each Turn after it arrives:
            </GameText>
            <ul>
              {planned.reliabilityLevels.map((level) => (
                <li key={level.id}>
                  <GameText>{`${level.name}: ${level.riskBand} per Turn (${formatMoney(level.costMillions)})`}</GameText>
                </li>
              ))}
            </ul>
          </Fact>
          <Fact name="Activities">
            <ul>
              {planned.activities.map((activity) => (
                <li key={activity.id}>
                  <GameText>{activityDetails(activity)}</GameText>
                </li>
              ))}
            </ul>
          </Fact>
          {asset.benefit && (
            // With what it would add this Turn, or why nothing, which the card's tag then leaves out.
            <Fact name="Benefit">
              <GameText>
                {[asset.benefit, benefitThisTurn(asset)]
                  .filter((part) => part !== null)
                  .join(" ")}
              </GameText>
            </Fact>
          )}
        </dl>
      </div>
    </Dialog>
  );
}
