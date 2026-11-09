import {
  formatMoney,
  type PlannedAsset,
  type Simulation,
} from "../simulation/simulation";

type PlannedMissionEvent = ReturnType<Simulation["previewMission"]>[number];
import { GameText } from "../ui/GameText";

interface MissionEventChoicesProps {
  plannedEvents: ReturnType<Simulation["previewMission"]>;
  /** The Assets on the Mission, each with the Reliability bought against its failing in service at Mars. */
  plannedAssets: PlannedAsset[];
  onReliabilityChange: (eventId: string, levelId: string) => void;
  onAssetReliabilityChange: (assetId: string, levelId: string) => void;
  onContingencyChange: (contingencyId: string, bought: boolean) => void;
}

/**
 * Reliability levels as a list shows them: each one's name and cost. The Risk Band the chosen one leaves is beside the
 * list, so the options don't say it again.
 */
function ReliabilityOptions({
  levels,
}: {
  levels: PlannedAsset["reliabilityLevels"];
}) {
  return levels.map((level) => (
    <option key={level.id} value={level.id}>
      {level.name} ({formatMoney(level.costMillions)})
    </option>
  ));
}

/** What a Contingency costs and its Risk Band if used, after its name: "Kick stage · $60M · 0.3 t · ~20% if used". */
function contingencyLabel({
  name,
  costMillions,
  massTonnes,
  riskBand,
}: NonNullable<PlannedMissionEvent["contingency"]>): string {
  return [
    name,
    formatMoney(costMillions),
    `${massTonnes} t`,
    `${riskBand} if used`,
  ].join(" · ");
}

/** Over a list of Mission Events, naming the Contingency once rather than in each one's label, if any offers one. */
function eventsHeading(text: string, events: PlannedMissionEvent[]): string {
  return events.some(({ contingency }) => contingency)
    ? `${text}, with a Contingency for some`
    : text;
}

/**
 * Every Reliability choice for the Mission, in one place: each Mission Event it goes through on the way, with its Risk
 * Band, the Reliability bought for it and its Contingency, then those of a round trip's journey home, which are bought
 * now, then each Asset in service at Mars, with its Risk Band for each Turn after it arrives and the Reliability bought
 * for that.
 */
export function MissionEventChoices({
  plannedEvents,
  plannedAssets,
  onReliabilityChange,
  onAssetReliabilityChange,
  onContingencyChange,
}: MissionEventChoicesProps) {
  const onTheWay = plannedEvents.filter(({ homeward }) => !homeward);
  const homeward = plannedEvents.filter((event) => event.homeward);
  const eventItem = (event: PlannedMissionEvent) => (
    <li key={event.eventId} data-testid="mission-event">
      <span className="mission-event-name">
        <GameText>{event.name}</GameText>
      </span>
      <strong className="risk-band" data-testid="risk-band">
        {event.riskBand}
      </strong>
      <select
        aria-label={`Reliability for ${event.name}`}
        value={event.reliabilityLevelId}
        onChange={(change) => {
          onReliabilityChange(event.eventId, change.target.value);
        }}
      >
        <ReliabilityOptions levels={event.reliabilityLevels} />
      </select>
      {event.contingency && (
        <label
          className="contingency-choice"
          title={event.contingency.description}
        >
          <input
            type="checkbox"
            checked={event.contingency.bought}
            onChange={(change) => {
              const { id } = event.contingency ?? {};
              if (id === undefined) return;
              onContingencyChange(id, change.target.checked);
            }}
          />
          {/* One flex item, so that the label's gap never falls inside its text. */}
          <span>
            <GameText>{contingencyLabel(event.contingency)}</GameText>
          </span>
        </label>
      )}
    </li>
  );
  return (
    <>
      <p className="mission-events-heading">
        <GameText>{eventsHeading("On the way, once each", onTheWay)}</GameText>
      </p>
      <ol className="mission-events plain-list" data-testid="mission-events">
        {onTheWay.map(eventItem)}
      </ol>
      {homeward.length > 0 && (
        <>
          <p className="mission-events-heading">
            <GameText>
              {eventsHeading("Journey home, on a later Turn", homeward)}
            </GameText>
          </p>
          <ol
            className="mission-events plain-list"
            data-testid="homeward-events"
          >
            {homeward.map(eventItem)}
          </ol>
        </>
      )}
      {plannedAssets.length > 0 && (
        <>
          <p className="mission-events-heading">
            <GameText>In service at Mars, each Turn after arriving</GameText>
          </p>
          <ul
            className="mission-events plain-list"
            data-testid="assets-in-service"
          >
            {plannedAssets.map((asset) => (
              <li key={asset.assetId} data-testid="asset-in-service">
                <span className="mission-event-name">
                  <GameText>{asset.name}</GameText>
                </span>
                <strong className="risk-band" data-testid="asset-risk-band">
                  <GameText>{`${asset.riskBand} per Turn`}</GameText>
                </strong>
                <select
                  aria-label={`Reliability for ${asset.name} in service`}
                  value={asset.reliabilityLevelId}
                  onChange={(change) => {
                    onAssetReliabilityChange(
                      asset.assetId,
                      change.target.value,
                    );
                  }}
                >
                  <ReliabilityOptions levels={asset.reliabilityLevels} />
                </select>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
