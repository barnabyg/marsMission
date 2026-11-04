import type { ReactNode } from "react";
import type {
  AssetChoices,
  PlannedActivity,
  PlannedAsset,
  ProgramView,
} from "../simulation/simulation";
import { MissionAssetChoice } from "./MissionAssetChoice";
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
  onCarriedChange: (assetId: string, carried: boolean) => void;
  onChoicesChange: (assetId: string, choices: AssetChoices) => void;
  /** The choice of Crew, shown after the Assets. */
  children: ReactNode;
}

/** The Assets the Mission can carry, the choices for each one it does, and what they would earn at Mars. */
export function MissionAssets({
  view,
  assetIds,
  plannedAssets,
  crewActivities,
  onCarriedChange,
  onChoicesChange,
  children,
}: MissionAssetsProps) {
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
            onCarriedChange={(carried) => {
              onCarriedChange(asset.id, carried);
            }}
            onChoicesChange={(choices) => {
              onChoicesChange(asset.id, choices);
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
    </>
  );
}
