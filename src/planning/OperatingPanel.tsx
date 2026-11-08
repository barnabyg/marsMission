import {
  formatMoney,
  formatPropellant,
  type ProgramView,
} from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { ActivitySelect, chosenEarnings, chosenYields } from "./ActivitySelect";
import { SamplesWaiting } from "./SamplesHomeChoice";
import { WayHomeChoice } from "./WayHomeChoice";
import {
  isSurveying,
  NothingLeftToSurvey,
  ResearchEarnings,
} from "./ResearchEarnings";

interface OperatingPanelProps {
  assets: ProgramView["operatingAssets"];
  crew: ProgramView["crew"];
  /** The known Landing Sites, for the ascent propellant at each. */
  landingSites: ProgramView["landingSites"];
  /** The samples waiting at each Landing Site that has any, and whether they can go home this Turn. */
  sampleReturns: ProgramView["sampleReturns"];
  /** The new Activities chosen this Turn for the Crew in each place, by its key. */
  chosenCrewActivities: Record<string, string>;
  onCrewActivityChange: (key: string, activityId: string) => void;
  /** The journey home the player has chosen this Turn, by key, if any: an Earth return stage's Crew, or samples. */
  bringHome: string | null;
  onBringHomeChange: (key: string, home: boolean) => void;
  somethingLeftToSurvey: boolean;
  /** The new Activities chosen this Turn, by each Asset's key. */
  chosenActivities: Record<string, string>;
  onActivityChange: (key: string, activityId: string) => void;
  /** The Assets whose missions the player has chosen to end as this Turn starts, by key. */
  endedKeys: string[];
  onEndedChange: (key: string, ended: boolean) => void;
}

/**
 * The Assets already at Mars, each with what is left of its Service Life, its Upkeep, the choice of its Activity and
 * the choice to end its mission, and the Crew there, with their Health, the choice of the Activity they share in each
 * place and, for round-trip Crew, the choice to bring them home this Turn, greyed out with the reason when they can't. Below them are the samples
 * waiting at each Landing Site, with the choice to send them home, then the ascent propellant at each
 * Landing Site that has any, which stays there whether or not anything is still operating, and the Supplies held in
 * Habitats at each Landing Site.
 */
export function OperatingPanel({
  assets,
  crew,
  landingSites,
  sampleReturns,
  chosenCrewActivities,
  onCrewActivityChange,
  bringHome,
  onBringHomeChange,
  somethingLeftToSurvey,
  chosenActivities,
  onActivityChange,
  endedKeys,
  onEndedChange,
}: OperatingPanelProps) {
  const stocked = landingSites.filter(
    ({ ascentPropellantKg }) => ascentPropellantKg > 0,
  );
  const held = landingSites.filter(
    ({ habitatSuppliesKg }) => habitatSuppliesKg > 0,
  );
  const empty =
    assets.length === 0 &&
    crew.length === 0 &&
    stocked.length === 0 &&
    held.length === 0 &&
    sampleReturns.length === 0;
  return (
    <section
      className={empty ? "panel empty" : "panel"}
      data-testid="operating-panel"
    >
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
                {chosenYields(
                  chosenCrewActivities[group.key] ?? group.activityId,
                  group.activities,
                ) && (
                  <span
                    className="activity-earnings"
                    data-testid="activity-earnings"
                  >
                    <GameText>
                      {chosenEarnings(
                        chosenCrewActivities[group.key] ?? group.activityId,
                        group.activities,
                      )}
                    </GameText>
                  </span>
                )}
              </span>
              <ActivitySelect
                assetName={`the Crew in ${group.locationName}`}
                activityId={chosenCrewActivities[group.key] ?? group.activityId}
                activities={group.activities}
                onChange={(activityId) => {
                  onCrewActivityChange(group.key, activityId);
                }}
              />
              {group.waysHome.map((way) => (
                <WayHomeChoice
                  key={way.key}
                  way={way}
                  chosen={bringHome === way.key}
                  onChange={(home) => {
                    onBringHomeChange(way.key, home);
                  }}
                />
              ))}
            </li>
          ))}
        </ul>
      )}
      {assets.length === 0 ? (
        empty && (
          <p className="empty-note">
            <GameText>
              Nothing at Mars yet. Your first orbiter will appear here.
            </GameText>
          </p>
        )
      ) : (
        <>
          {/* Each row has no room for its own Upkeep, so the panel says the total; each End mission says what it saves. */}
          <p data-testid="operating-upkeep">
            <GameText>
              {`Each Asset keeps its Activity until you change it. Upkeep this Turn: ${formatMoney(
                assets
                  .filter(({ key }) => !endedKeys.includes(key))
                  .reduce(
                    (total, { upkeepMillions }) => total + upkeepMillions,
                    0,
                  ),
              )}.`}
            </GameText>
          </p>
          <ResearchEarnings
            onlyRaises
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
            {assets.map((asset) => {
              const ended = endedKeys.includes(asset.key);
              const where = asset.landingSiteName
                ? `${asset.name} at ${asset.landingSiteName}`
                : asset.name;
              return (
                <li key={asset.key} className={ended ? "ended" : undefined}>
                  <span>
                    <GameText>
                      {`${where}: ${
                        ended
                          ? "its mission ends as this Turn starts"
                          : asset.daysLeft > 0
                            ? `${asset.daysLeft} days of Service Life left`
                            : "Service Life ends as this Turn starts"
                      }`}
                    </GameText>
                    {!ended &&
                      asset.daysLeft > 0 &&
                      chosenYields(
                        chosenActivities[asset.key] ?? asset.activityId,
                        asset.activities,
                      ) && (
                        <span
                          className="activity-earnings"
                          data-testid="activity-earnings"
                        >
                          <GameText>
                            {chosenEarnings(
                              chosenActivities[asset.key] ?? asset.activityId,
                              asset.activities,
                            )}
                          </GameText>
                        </span>
                      )}
                  </span>
                  {asset.activities.length > 0 ? (
                    <ActivitySelect
                      assetName={asset.name}
                      activityId={
                        chosenActivities[asset.key] ?? asset.activityId
                      }
                      activities={asset.activities}
                      onChange={(activityId) => {
                        onActivityChange(asset.key, activityId);
                      }}
                    />
                  ) : (
                    <GameText>{asset.activityName}</GameText>
                  )}
                  {/* Only one with Service Life left costs Upkeep, so only that one's mission is worth ending. */}
                  {asset.daysLeft > 0 && (
                    <label
                      className="end-mission"
                      title={`Takes it out of service as this Turn starts, saving its Upkeep of ${formatMoney(asset.upkeepMillions)} a Turn.`}
                    >
                      <input
                        type="checkbox"
                        checked={ended}
                        aria-label={`End the mission of ${where}`}
                        onChange={(event) => {
                          onEndedChange(asset.key, event.target.checked);
                        }}
                      />
                      End mission
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <SamplesWaiting
        samples={sampleReturns}
        bringHome={bringHome}
        onBringHomeChange={onBringHomeChange}
      />
      {stocked.length > 0 && (
        <p data-testid="ascent-propellant">
          <GameText>
            {`Ascent propellant: ${stocked
              .map(
                ({ name, ascentPropellantKg }) =>
                  `${formatPropellant(ascentPropellantKg)} at ${name}`,
              )
              .join(", ")}`}
          </GameText>
        </p>
      )}
      {held.length > 0 && (
        <p data-testid="habitat-supplies">
          <GameText>
            {`Supplies in Habitats: ${held
              .map(
                ({ name, habitatSuppliesKg }) =>
                  `${Math.floor(habitatSuppliesKg).toLocaleString("en")} kg at ${name}`,
              )
              .join(", ")}`}
          </GameText>
        </p>
      )}
    </section>
  );
}
