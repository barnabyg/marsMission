import type {
  AssetChoices,
  PlannedAsset,
  ProgramView,
} from "../simulation/simulation";
import { GameText } from "../ui/GameText";
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
  onCarriedChange: (assetId: string, carried: boolean) => void;
  onChoicesChange: (assetId: string, choices: AssetChoices) => void;
}

/** The Assets the Mission can carry, the choices for each one it does, and what they would earn at Mars. */
export function MissionAssets({
  view,
  assetIds,
  plannedAssets,
  onCarriedChange,
  onChoicesChange,
}: MissionAssetsProps) {
  return (
    <>
      <fieldset className="asset-choices">
        <legend>
          <GameText>Assets</GameText>
        </legend>
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
      </fieldset>
      <ResearchEarnings
        activities={plannedAssets.flatMap(({ activities }) => activities)}
      />
      {!view.somethingLeftToSurvey &&
        plannedAssets.some(({ activityId, activities }) =>
          isSurveying(activityId, activities),
        ) && <NothingLeftToSurvey />}
    </>
  );
}
