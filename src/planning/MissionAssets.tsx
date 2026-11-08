import { useState, type ReactNode } from "react";
import type {
  AssetChoices,
  PlannedActivity,
  PlannedAsset,
  ProgramView,
} from "../simulation/simulation";
import { AssetDetails } from "./AssetDetails";
import { MissionAssetChoice } from "./MissionAssetChoice";
import type { Addition, Fit } from "./missionFit";
import {
  isSurveying,
  NothingLeftToSurvey,
  ResearchEarnings,
} from "./ResearchEarnings";

interface MissionAssetsProps {
  view: ProgramView;
  /** The Assets ticked to carry. */
  assetIds: string[];
  plannedAssets: PlannedAsset[];
  /** The Activities on offer to the Mission's Crew, if it has Crew, whose earnings show with the Assets'. */
  crewActivities: PlannedActivity[];
  /** Whether adding this to the Mission would take it over its Launch Vehicle's capacity or the Money. */
  fitOf: (addition: Addition) => Fit;
  onCarriedChange: (assetId: string, carried: boolean) => void;
  onChoicesChange: (assetId: string, choices: AssetChoices) => void;
  /** An Asset's Service Life, Activities and Reliability, as on the Mission if it's ticked, or on its own if it isn't. */
  detailsOf: (assetId: string) => PlannedAsset | undefined;
  /** The choice of Crew, shown after the Assets. */
  children: ReactNode;
}

/** The Assets the Mission can carry, as cards, the choices for each one it does, and what they would earn at Mars. */
export function MissionAssets({
  view,
  assetIds,
  plannedAssets,
  crewActivities,
  fitOf,
  onCarriedChange,
  onChoicesChange,
  detailsOf,
  children,
}: MissionAssetsProps) {
  const [shownId, setShownId] = useState<string | null>(null);
  const shown = view.assets.find(({ id }) => id === shownId);
  const shownPlan = shown && detailsOf(shown.id);
  return (
    <>
      {/* The step's heading names the Assets, so the group needs no legend of its own. */}
      <fieldset className="asset-choices" aria-label="Assets">
        {view.assets.map((asset) => (
          <MissionAssetChoice
            key={asset.id}
            asset={asset}
            planned={plannedAssets.find(({ assetId }) => assetId === asset.id)}
            operatingCount={
              view.operatingAssets.filter(
                ({ assetId, daysLeft }) => assetId === asset.id && daysLeft > 0,
              ).length
            }
            carried={assetIds.includes(asset.id)}
            fit={fitOf({ assetId: asset.id })}
            onCarriedChange={(carried) => {
              onCarriedChange(asset.id, carried);
            }}
            onChoicesChange={(choices) => {
              onChoicesChange(asset.id, choices);
            }}
            onShowDetails={() => {
              setShownId(asset.id);
            }}
          />
        ))}
        {children}
      </fieldset>
      <ResearchEarnings
        activities={[
          ...plannedAssets.flatMap(({ activities }) => activities),
          ...crewActivities,
        ]}
      />
      {!view.somethingLeftToSurvey &&
        plannedAssets.some(({ activityId, activities }) =>
          isSurveying(activityId, activities),
        ) && <NothingLeftToSurvey />}
      {shown && shownPlan && (
        <AssetDetails
          asset={shown}
          planned={shownPlan}
          onClose={() => {
            setShownId(null);
          }}
        />
      )}
    </>
  );
}
