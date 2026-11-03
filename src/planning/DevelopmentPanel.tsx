import { formatMoney, type PlannedDevelopment } from "../simulation/simulation";
import { GameText } from "../ui/GameText";

interface DevelopmentPanelProps {
  developments: PlannedDevelopment[];
  moneyMillions: number;
  /** The Developments chosen to start this Turn, by id, which either button sends. */
  chosenIds: string[];
  onChosenChange: (chosenIds: string[]) => void;
}

const turns = (count: number) => `${count} ${count === 1 ? "Turn" : "Turns"}`;

/** Each technology that needs Development: its cost and Turns, the choice to start it, or how far it has got. */
export function DevelopmentPanel({
  developments,
  moneyMillions,
  chosenIds,
  onChosenChange,
}: DevelopmentPanelProps) {
  const chosenMillions = developments
    .filter(({ id }) => chosenIds.includes(id))
    .reduce((total, { costMillions }) => total + costMillions, 0);
  return (
    <section className="panel">
      <h2>
        <GameText>Development</GameText>
      </h2>
      {developments.length === 0 ? (
        <p>Nothing needs it.</p>
      ) : (
        <ul className="developments" data-testid="developments">
          {developments.map((development) => {
            const { id, name, costMillions, status, turnsLeft } = development;
            const chosen = chosenIds.includes(id);
            return (
              <li key={id} data-testid="development">
                <span>
                  <GameText>
                    {`${name} (${formatMoney(costMillions)}, ${turns(development.turns)})`}
                  </GameText>
                </span>
                {status === "notStarted" ? (
                  <label>
                    <input
                      type="checkbox"
                      checked={chosen}
                      // Paid in full this Turn, so it can't be chosen beside others it can't also afford.
                      disabled={
                        !chosen && chosenMillions + costMillions > moneyMillions
                      }
                      onChange={(event) => {
                        onChosenChange(
                          event.target.checked
                            ? [...chosenIds, id]
                            : chosenIds.filter((other) => other !== id),
                        );
                      }}
                    />
                    <GameText>Start Development</GameText>
                  </label>
                ) : (
                  <strong data-testid="development-progress">
                    <GameText>
                      {status === "inProgress"
                        ? `In Development: ${turns(turnsLeft)} left`
                        : "Developed: can be chosen for a Mission"}
                    </GameText>
                  </strong>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
