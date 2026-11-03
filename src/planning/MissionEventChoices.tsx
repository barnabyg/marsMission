import { formatMoney, type Simulation } from "../simulation/simulation";
import { GameText } from "../ui/GameText";

interface MissionEventChoicesProps {
  plannedEvents: ReturnType<Simulation["previewMission"]>;
  onReliabilityChange: (eventId: string, levelId: string) => void;
  onContingencyChange: (contingencyId: string, bought: boolean) => void;
}

/** Each Mission Event the Mission goes through, with its Risk Band, the Reliability bought for it and its Contingency. */
export function MissionEventChoices({
  plannedEvents,
  onReliabilityChange,
  onContingencyChange,
}: MissionEventChoicesProps) {
  return (
    <>
      <h3>
        <GameText>
          Mission Events, Risk Bands, Reliability and Contingency
        </GameText>
      </h3>
      <ol className="mission-events" data-testid="mission-events">
        {plannedEvents.map((event) => (
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
              {event.reliabilityLevels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name} ({formatMoney(level.costMillions)},{" "}
                  {level.riskBand})
                </option>
              ))}
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
                <GameText>
                  {`Contingency: ${event.contingency.name} (${formatMoney(event.contingency.costMillions)}, ${event.contingency.massTonnes} t, ${event.contingency.riskBand} if used)`}
                </GameText>
              </label>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}
