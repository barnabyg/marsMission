import type { ProgramView } from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { ActivitySelect } from "./ActivitySelect";
import {
  isSurveying,
  NothingLeftToSurvey,
  ResearchEarnings,
} from "./ResearchEarnings";

interface OperatingPanelProps {
  assets: ProgramView["operatingAssets"];
  crew: ProgramView["crew"];
  /** The new Activities chosen this Turn for the Crew in each place, by its key. */
  chosenCrewActivities: Record<string, string>;
  onCrewActivityChange: (key: string, activityId: string) => void;
  somethingLeftToSurvey: boolean;
  /** The new Activities chosen this Turn, by each Asset's key. */
  chosenActivities: Record<string, string>;
  onActivityChange: (key: string, activityId: string) => void;
}

/**
 * The Assets already at Mars, each with what is left of its Service Life and the choice of its Activity, and the Crew
 * there, with their Health and the choice of the Activity they share in each place.
 */
export function OperatingPanel({
  assets,
  crew,
  chosenCrewActivities,
  onCrewActivityChange,
  somethingLeftToSurvey,
  chosenActivities,
  onActivityChange,
}: OperatingPanelProps) {
  return (
    <section className="panel">
      <h2>Operating at Mars</h2>
      {crew.length > 0 && (
        <ul className="operating-assets" data-testid="crew-at-mars">
          {crew.map((group) => (
            <li key={group.key}>
              <span>
                <GameText>
                  {`Crew in ${group.locationName}: ${group.members
                    .map(({ name, health }) => `${name} (Health ${health})`)
                    .join(", ")}. ${
                    group.suppliesDaysLeft > 0
                      ? `Supplies for ${group.suppliesDaysLeft.toLocaleString("en")} days`
                      : "No Supplies left"
                  }`}
                </GameText>
              </span>
              <ActivitySelect
                assetName={`the Crew in ${group.locationName}`}
                activityId={chosenCrewActivities[group.key] ?? group.activityId}
                activities={group.activities}
                onChange={(activityId) => {
                  onCrewActivityChange(group.key, activityId);
                }}
              />
            </li>
          ))}
        </ul>
      )}
      {assets.length === 0 ? (
        crew.length === 0 && <p>Nothing.</p>
      ) : (
        <>
          <p>
            <GameText>
              Each Asset keeps its Activity until you change it.
            </GameText>
          </p>
          <ResearchEarnings
            activities={[
              ...assets.flatMap(({ activities }) => activities),
              ...crew.flatMap(({ activities }) => activities),
            ]}
          />
          {!somethingLeftToSurvey &&
            assets.some(({ key, activityId, activities }) =>
              isSurveying(chosenActivities[key] ?? activityId, activities),
            ) && <NothingLeftToSurvey />}
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
