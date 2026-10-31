import type { ProgramView } from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { ActivitySelect } from "./ActivitySelect";
import { ResearchEarnings } from "./ResearchEarnings";

interface OperatingPanelProps {
  assets: ProgramView["operatingAssets"];
  /** The new Activities chosen this Turn, by each Asset's key. */
  chosenActivities: Record<string, string>;
  onActivityChange: (key: string, activityId: string) => void;
}

/** The Assets already at Mars, each with what is left of its Service Life and the choice of its Activity. */
export function OperatingPanel({
  assets,
  chosenActivities,
  onActivityChange,
}: OperatingPanelProps) {
  return (
    <section className="panel">
      <h2>Operating at Mars</h2>
      {assets.length === 0 ? (
        <p>Nothing.</p>
      ) : (
        <>
          <p>
            <GameText>
              Each Asset keeps its Activity until you change it.
            </GameText>
          </p>
          <ResearchEarnings
            activities={assets.flatMap(({ activities }) => activities)}
          />
          <ul className="operating-assets" data-testid="operating-assets">
            {assets.map((asset) => (
              <li key={asset.key}>
                <span>
                  <GameText>
                    {`${
                      asset.landingSiteName
                        ? `${asset.name} at ${asset.landingSiteName}`
                        : asset.name
                    }: ${
                      asset.daysLeft > 0
                        ? `${asset.daysLeft} days of Service Life left`
                        : "Service Life ends as this Turn starts"
                    }`}
                  </GameText>
                </span>
                {asset.activities.length > 0 ? (
                  <ActivitySelect
                    assetName={asset.name}
                    activityId={chosenActivities[asset.key] ?? asset.activityId}
                    activities={asset.activities}
                    onChange={(activityId) => {
                      onActivityChange(asset.key, activityId);
                    }}
                  />
                ) : (
                  <GameText>{asset.activityName}</GameText>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
