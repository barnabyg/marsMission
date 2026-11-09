import { useRef } from "react";
import { formatPropellant, type ProgramView } from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { isSurveying, NothingLeftToSurvey } from "./NothingLeftToSurvey";
import { groupByPlace } from "./operatingGroups";
import { AssetRows, CrewRows, GroupRow } from "./OperatingRows";
import { SamplesWaiting } from "./SamplesHomeChoice";
import { ScrollCue } from "./ScrollCue";

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
 * Everything already at Mars, as a table: the Crew in each place, with their Supplies, the choice of the Activity they
 * share and, for round-trip Crew, the choice to bring them home this Turn, greyed out with the reason when they can't,
 * and a row for each Crew member with their Health; then the Assets, grouped by where they are, each with what is left
 * of its Service Life, the choice of its Activity and the choice to end its mission, which stops its Upkeep. Several
 * Assets of one kind are numbered in the order they arrived. The heading says how many Assets and Crew are there, and a
 * cue over the panel's foot says when more rows are below. Under the table are the samples waiting at each Landing
 * Site, with the choice to send them home, then the ascent propellant at each Landing Site that has any, which stays
 * there whether or not anything is still operating, and the Supplies held in Habitats at each Landing Site.
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
  const panel = useRef<HTMLElement>(null);
  const stocked = landingSites.filter(
    ({ ascentPropellantKg }) => ascentPropellantKg > 0,
  );
  const held = landingSites.filter(
    ({ habitatSuppliesKg }) => habitatSuppliesKg > 0,
  );
  const count =
    assets.length +
    crew.reduce((total, { members }) => total + members.length, 0);
  const empty =
    count === 0 &&
    stocked.length === 0 &&
    held.length === 0 &&
    sampleReturns.length === 0;
  return (
    <section
      ref={panel}
      className={
        empty ? "panel operating-panel empty" : "panel operating-panel"
      }
      data-testid="operating-panel"
    >
      <h2>
        Operating at Mars
        {count > 0 && (
          // How many rows there are, as the panel may hold more than it shows.
          <span className="operating-count" data-testid="operating-count">
            {` · ${String(count)}`}
          </span>
        )}
      </h2>
      {empty && (
        <p className="empty-note">
          <GameText>
            Nothing at Mars yet. Your first orbiter will appear here.
          </GameText>
        </p>
      )}
      {!somethingLeftToSurvey &&
        assets.some(({ key, activityId, activities }) =>
          isSurveying(chosenActivities[key] ?? activityId, activities),
        ) && <NothingLeftToSurvey />}
      {count > 0 && (
        <table className="operating-table">
          <colgroup>
            <col className="operating-col-name" />
            <col className="operating-col-left" />
            <col className="operating-col-activity" />
            <col className="operating-col-action" />
          </colgroup>
          {crew.length > 0 && (
            <tbody data-testid="crew-at-mars">
              {crew.map((group) => (
                <CrewRows
                  key={group.key}
                  group={group}
                  activityId={
                    chosenCrewActivities[group.key] ?? group.activityId
                  }
                  bringHome={bringHome}
                  onActivityChange={(activityId) => {
                    onCrewActivityChange(group.key, activityId);
                  }}
                  onBringHomeChange={onBringHomeChange}
                />
              ))}
            </tbody>
          )}
          {assets.length > 0 && (
            <tbody data-testid="operating-assets">
              {groupByPlace(assets).map(({ place, assets: there }) => (
                <GroupRows key={place} place={place}>
                  {there.map((asset) => (
                    <AssetRows
                      key={asset.key}
                      asset={asset}
                      activityId={
                        chosenActivities[asset.key] ?? asset.activityId
                      }
                      ended={endedKeys.includes(asset.key)}
                      onActivityChange={(activityId) => {
                        onActivityChange(asset.key, activityId);
                      }}
                      onEndedChange={(ended) => {
                        onEndedChange(asset.key, ended);
                      }}
                    />
                  ))}
                </GroupRows>
              ))}
            </tbody>
          )}
        </table>
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
      {!empty && <ScrollCue scroller={panel}>More below</ScrollCue>}
    </section>
  );
}

/** The rows of the Assets at one place, under a heading row naming it. */
function GroupRows({
  place,
  children,
}: {
  place: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <GroupRow>{place}</GroupRow>
      {children}
    </>
  );
}
