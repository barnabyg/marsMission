import { formatMoney, type TurnSummary } from "../simulation/simulation";
import { GameText } from "../ui/GameText";

function describeSolarParticleEvent({
  outcome,
  assets,
  serviceLifeLossPercent,
  crew,
  crewHealthLoss,
}: NonNullable<TurnSummary["solarParticleEvent"]>): string {
  const names = [...assets, ...crew].join(", ");
  // What it cost those on board, such as "15% of each Asset's Service Life and 5 Health for each Crew member".
  const cost = [
    ...(assets.length > 0
      ? [`${serviceLifeLossPercent}% of each Asset's Service Life`]
      : []),
    ...(crew.length > 0
      ? [`${crewHealthLoss} Health for each Crew member`]
      : []),
  ].join(" and ");
  switch (outcome) {
    case "protected":
      return `Safe mode protected ${names}, at a cost of ${cost}`;
    case "unharmed":
      return `Carried on, and ${names} came through unharmed`;
    case "damaged":
      return `Carried on, and the radiation hit ${names}, which cost ${cost}`;
    case "lost":
      return `Carried on, and the radiation lost ${names}`;
  }
}

/** What went wrong or was decided during the Turn: failures, lost Crew, Decision Points and Hazards. */
export function SummaryEvents({ summary }: { summary: TurnSummary }) {
  return (
    <>
      {summary.failure && (
        <section data-testid="summary-failure">
          <h2 className="problem">
            <GameText heading>
              {summary.failure.returnedToEarth
                ? "Mission came back to Earth"
                : "Mission failed"}
            </GameText>
          </h2>
          <ul>
            <li>
              <GameText>
                {`${summary.failure.hazard ? "Lost to" : "Mission Event that failed"}: ${summary.failure.missionEventName}`}
              </GameText>
            </li>
            <li>
              <GameText>
                {`${summary.failure.returnedToEarth ? "Assets back on Earth" : "Assets lost"}: ${summary.failure.assetsLost.join(", ")}`}
              </GameText>
            </li>
            <li>
              <GameText>
                {`Public Support lost: ${summary.failure.publicSupportLost}`}
              </GameText>
            </li>
            {summary.failure.returnedToEarth && (
              <li>{`Refund: ${formatMoney(summary.failure.refundMillions)}`}</li>
            )}
          </ul>
        </section>
      )}
      {summary.crewLost.length > 0 && (
        <section data-testid="summary-crew-lost">
          <h2 className="problem">
            <GameText heading>Crew lost</GameText>
          </h2>
          <ul>
            {summary.crewLost.map(({ description, publicSupportLost }) => (
              <li key={description} className="problem">
                <GameText>
                  {`${description} Public Support lost: ${publicSupportLost}`}
                </GameText>
              </li>
            ))}
          </ul>
        </section>
      )}
      {summary.crewHome.length > 0 && (
        <p data-testid="summary-crew-home">
          <GameText>
            {`Crew home safe, who won't fly again: ${summary.crewHome.join(", ")}`}
          </GameText>
        </p>
      )}
      {summary.contingencies.length > 0 && (
        <section data-testid="summary-contingencies">
          <h2>
            <GameText heading>Decision Points</GameText>
          </h2>
          <ul>
            {summary.contingencies.map(
              ({
                missionEventName,
                contingencyName,
                answer,
                rescued,
                assets,
              }) => (
                <li key={missionEventName}>
                  <GameText>
                    {`${missionEventName}: ${
                      answer === "decline"
                        ? `${contingencyName} not used`
                        : rescued && assets.length === 0
                          ? `saved by ${contingencyName}, but the Mission was lost later`
                          : rescued
                            ? `saved by ${contingencyName}. ${assets
                                .map(
                                  ({ name, serviceLifeDays }) =>
                                    `${name} now has a Service Life of ${serviceLifeDays} days`,
                                )
                                .join(", ")}`
                            : `${contingencyName} used, but it couldn't save the Mission`
                    }`}
                  </GameText>
                </li>
              ),
            )}
          </ul>
        </section>
      )}
      {summary.goNoGo && (
        <section data-testid="summary-go-no-go">
          <h2>
            <GameText heading>Go/no-go check</GameText>
          </h2>
          <p>
            <GameText>
              {summary.goNoGo.answer === "holdOff"
                ? `Held off the landing at ${summary.goNoGo.siteName} for ${summary.goNoGo.daysHeld} days, until the dust storm had passed. Each Asset landed lost ${summary.goNoGo.serviceLifeDaysLost} days of Service Life.`
                : `Landed at ${summary.goNoGo.siteName} in a dust storm, at a higher risk.`}
            </GameText>
          </p>
        </section>
      )}
      {summary.solarParticleEvent && (
        <section data-testid="summary-solar-particle-event">
          <h2>
            <GameText heading>Solar particle event</GameText>
          </h2>
          <p>
            <GameText>
              {describeSolarParticleEvent(summary.solarParticleEvent)}
            </GameText>
          </p>
        </section>
      )}
      {summary.dustStorms.length > 0 && (
        <section data-testid="summary-dust-storms">
          <h2>
            <GameText heading>Hazards</GameText>
          </h2>
          <ul>
            {summary.dustStorms.map(
              ({ siteName, days, answer, assets, assetsFailed, crewHurt }) => {
                const harm = [
                  ...(assetsFailed.length > 0
                    ? [`lost ${assetsFailed.join(", ")}`]
                    : []),
                  ...(crewHurt.length > 0
                    ? [`${crewHurt.join(", ")} lost Health`]
                    : []),
                ];
                return (
                  <li key={siteName}>
                    <GameText>
                      {`Dust storm over ${siteName}: ${
                        answer === "shelter"
                          ? `${assets.join(", ")} sheltered for ${days} days, with no Ongoing Research`
                          : harm.length > 0
                            ? `carried on through ${days} days, and ${harm.join(", and ")}`
                            : `${assets.join(", ")} carried on through ${days} days, and came through`
                      }`}
                    </GameText>
                  </li>
                );
              },
            )}
          </ul>
        </section>
      )}
    </>
  );
}
