import { healthLossCauses, type TurnSummary } from "../simulation/simulation";
import { GameText } from "../ui/GameText";

type HealthLost = TurnSummary["healthLost"][number]["lost"];

/** Such as "Ann Able lost 31 Health: 16 to radiation at Mars, 15 to time at Mars", or "Ann Able lost 52 Health to radiation in flight". */
function describe(name: string, lost: HealthLost): string {
  const causes = lost.map(
    ({ cause, health }) => `${health} to ${healthLossCauses[cause]}`,
  );
  const [only] = lost;
  if (lost.length === 1 && only) {
    return `${name} lost ${only.health} Health to ${healthLossCauses[only.cause]}`;
  }
  const total = lost.reduce((sum, { health }) => sum + health, 0);
  return `${name} lost ${total} Health: ${causes.join(", ")}`;
}

/** What each Crew member lost in Health this Turn and why, whether they are still at Mars, were lost or came home. */
export function SummaryHealthLost({
  healthLost,
}: Pick<TurnSummary, "healthLost">) {
  if (healthLost.length === 0) return null;
  return (
    <section data-testid="summary-health-lost">
      <h2>
        <GameText>Health lost</GameText>
      </h2>
      <ul>
        {healthLost.map(({ name, lost }) => (
          <li key={name}>
            <GameText>{describe(name, lost)}</GameText>
          </li>
        ))}
      </ul>
    </section>
  );
}
