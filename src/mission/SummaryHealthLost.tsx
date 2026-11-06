import { healthLossCauses, type TurnSummary } from "../simulation/simulation";
import { GameText } from "../ui/GameText";

type HealthLost = TurnSummary["healthLost"][number];

/**
 * Such as "Ann Able lost 31 Health: 16 to radiation at Mars, 15 to time at Mars", or "Ann Able lost 52 Health to
 * radiation in flight", followed by what Protection saved, if it saved anything: ". Protection saved 12 more", and
 * then what a habitat saved: ". Living in a Habitat saved 15 more".
 */
function describe({
  name,
  lost,
  savedByProtection,
  savedByHabitat,
}: HealthLost): string {
  const saved = [
    ...(savedByProtection === undefined
      ? []
      : [`. Protection saved ${savedByProtection} more`]),
    ...(savedByHabitat === undefined
      ? []
      : [`. Living in a Habitat saved ${savedByHabitat} more`]),
  ].join("");
  return `${describeLost(name, lost)}${saved}`;
}

function describeLost(name: string, lost: HealthLost["lost"]): string {
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
        <GameText heading>Health lost</GameText>
      </h2>
      <ul>
        {healthLost.map((member) => (
          <li key={member.name}>
            <GameText>{describe(member)}</GameText>
          </li>
        ))}
      </ul>
    </section>
  );
}
