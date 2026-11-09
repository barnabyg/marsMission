import { formatMoney, type ProgramView } from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { ActivitySelect, chosenEarnings, chosenYields } from "./ActivitySelect";
import { WayHomeChoice } from "./WayHomeChoice";

type OperatingAsset = ProgramView["operatingAssets"][number];
type CrewGroup = ProgramView["crew"][number];

/** What the chosen Activity earns, on a row of its own under the Asset or Crew it is for, if it earns anything. */
function EarningsRow({
  activityId,
  activities,
}: {
  activityId: string;
  activities: OperatingAsset["activities"];
}) {
  if (!chosenYields(activityId, activities)) return null;
  return (
    <tr className="operating-earnings">
      <td colSpan={4}>
        <span className="activity-earnings" data-testid="activity-earnings">
          <GameText>{chosenEarnings(activityId, activities)}</GameText>
        </span>
      </td>
    </tr>
  );
}

/** The heading row of a group of rows: the place the Assets are at, or the Crew in one place with their Supplies. */
export function GroupRow({ children }: { children: string }) {
  return (
    <tr className="operating-group">
      <th scope="rowgroup" colSpan={4}>
        <GameText>{children}</GameText>
      </th>
    </tr>
  );
}

interface AssetRowProps {
  asset: OperatingAsset;
  /** The Activity chosen for it this Turn, or the one it has. */
  activityId: string;
  ended: boolean;
  onActivityChange: (activityId: string) => void;
  onEndedChange: (ended: boolean) => void;
}

/**
 * One Asset at Mars: its label, what is left of its Service Life, the choice of its Activity and the choice to end its
 * mission, then what its Activity earns if it earns anything. An Asset whose mission is ending is greyed out.
 */
export function AssetRows({
  asset,
  activityId,
  ended,
  onActivityChange,
  onEndedChange,
}: AssetRowProps) {
  const where = asset.landingSiteName
    ? `${asset.label} at ${asset.landingSiteName}`
    : asset.label;
  const going = ended || asset.daysLeft === 0;
  return (
    <>
      <tr className={ended ? "ended" : undefined} data-testid="operating-asset">
        <td className="operating-name">{asset.label}</td>
        <td>
          {going ? (
            <GameText>Ends as this Turn starts</GameText>
          ) : (
            // Its tooltip says what the days are, after what a Service Life is.
            <span
              className="operating-days"
              data-term="Service Life"
              data-detail={`${asset.label}: ${asset.daysLeft.toLocaleString("en")} days of Service Life left.`}
              tabIndex={0}
            >
              {asset.daysLeft.toLocaleString("en")} days
            </span>
          )}
        </td>
        <td>
          {asset.activities.length > 0 ? (
            <ActivitySelect
              assetName={asset.label}
              activityId={activityId}
              activities={asset.activities}
              onChange={onActivityChange}
            />
          ) : (
            <GameText>{asset.activityName}</GameText>
          )}
        </td>
        <td>
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
                  onEndedChange(event.target.checked);
                }}
              />
              End mission
            </label>
          )}
        </td>
      </tr>
      {!going && (
        <EarningsRow activityId={activityId} activities={asset.activities} />
      )}
    </>
  );
}

interface CrewRowsProps {
  group: CrewGroup;
  /** The Activity chosen for them this Turn, or the one they have. */
  activityId: string;
  /** The journey home the player has chosen this Turn, by key, if any. */
  bringHome: string | null;
  onActivityChange: (activityId: string) => void;
  onBringHomeChange: (key: string, home: boolean) => void;
}

/**
 * The Crew in one place at Mars: a heading row with where they are and their Supplies, the choice of the Activity they
 * share and, for round-trip Crew, the choice to bring them home this Turn, then what the Activity earns if it earns
 * anything, then one row for each Crew member with their Health.
 */
export function CrewRows({
  group,
  activityId,
  bringHome,
  onActivityChange,
  onBringHomeChange,
}: CrewRowsProps) {
  const supplies =
    group.suppliesDaysLeft > 0
      ? `Supplies for ${group.suppliesDaysLeft.toLocaleString("en")} days`
      : "No Supplies left";
  return (
    <>
      <tr className="operating-group" data-testid="crew-group">
        <th scope="rowgroup" colSpan={2}>
          <GameText>{`Crew in ${group.locationName} · ${supplies}`}</GameText>
        </th>
        <td>
          <ActivitySelect
            assetName={`the Crew in ${group.locationName}`}
            activityId={activityId}
            activities={group.activities}
            onChange={onActivityChange}
          />
        </td>
        <td>
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
        </td>
      </tr>
      <EarningsRow activityId={activityId} activities={group.activities} />
      {group.members.map(({ name, health }) => (
        <tr key={name} data-testid="crew-member">
          <td className="operating-name">{name}</td>
          <td colSpan={3}>
            <GameText>{`Health ${String(health)}`}</GameText>
          </td>
        </tr>
      ))}
    </>
  );
}
