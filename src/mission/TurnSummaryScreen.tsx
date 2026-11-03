import { formatMoney, type TurnSummary } from "../simulation/simulation";
import { GameText } from "../ui/GameText";

function describeSolarParticleEvent({
  outcome,
  assets,
  serviceLifeLossPercent,
}: NonNullable<TurnSummary["solarParticleEvent"]>): string {
  const names = assets.join(", ");
  switch (outcome) {
    case "protected":
      return `Safe mode protected ${names}, at a cost of ${serviceLifeLossPercent}% of each Asset's Service Life`;
    case "unharmed":
      return `Carried on, and ${names} came through unharmed`;
    case "damaged":
      return `Carried on, and the radiation damaged ${names}, which cost each Asset ${serviceLifeLossPercent}% of its Service Life`;
    case "lost":
      return `Carried on, and the radiation lost ${names}`;
  }
}

interface TurnSummaryScreenProps {
  summary: TurnSummary;
  onContinue: () => void;
}

export function TurnSummaryScreen({
  summary,
  onContinue,
}: TurnSummaryScreenProps) {
  return (
    <main className="summary-screen" data-testid="turn-summary">
      <h1>
        <GameText>Turn summary</GameText>
      </h1>
      {summary.cancellationReason && (
        <p className="problem" role="alert">
          <GameText>
            {`The Program has been cancelled. ${summary.cancellationReason}`}
          </GameText>
        </p>
      )}
      {summary.failure && (
        <section data-testid="summary-failure">
          <h2 className="problem">
            <GameText>
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
            <GameText>Crew lost</GameText>
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
            <GameText>Decision Points</GameText>
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
            <GameText>Go/no-go check</GameText>
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
            <GameText>Solar particle event</GameText>
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
            <GameText>Hazards</GameText>
          </h2>
          <ul>
            {summary.dustStorms.map(
              ({ siteName, days, answer, assets, assetsFailed }) => (
                <li key={siteName}>
                  <GameText>
                    {`Dust storm over ${siteName}: ${
                      answer === "shelter"
                        ? `${assets.join(", ")} sheltered for ${days} days, with no Ongoing Research`
                        : assetsFailed.length > 0
                          ? `carried on through ${days} days, and lost ${assetsFailed.join(", ")}`
                          : `${assets.join(", ")} carried on through ${days} days, and came through`
                    }`}
                  </GameText>
                </li>
              ),
            )}
          </ul>
        </section>
      )}
      {summary.milestones.length > 0 && (
        <section>
          <h2>
            <GameText>Milestones</GameText>
          </h2>
          <ul>
            {summary.milestones.map((milestone) => (
              <li key={milestone.name}>
                <GameText>
                  {`${milestone.name}: ${milestone.science} Science and ${milestone.publicSupport} Public Support`}
                </GameText>
              </li>
            ))}
          </ul>
        </section>
      )}
      {summary.crew.length > 0 && (
        <section data-testid="summary-crew">
          <h2>
            <GameText>Crew at Mars</GameText>
          </h2>
          <ul>
            {summary.crew.map(
              ({ name, locationName, health, maxHealth, arrived }) => (
                <li key={name}>
                  <GameText>
                    {`${name}, in ${locationName}${arrived ? " from this Turn" : ""}: Health ${health} of ${maxHealth}`}
                  </GameText>
                </li>
              ),
            )}
          </ul>
        </section>
      )}
      {summary.firstLanding && (
        <p data-testid="summary-first-landing">
          <GameText>
            {`First landing at ${summary.firstLanding.siteName}: ${summary.firstLanding.science} Science`}
          </GameText>
        </p>
      )}
      {summary.technologiesProven.length > 0 && (
        <p data-testid="summary-flight-proven">
          <GameText>
            {`Now Flight-proven: ${summary.technologiesProven.join(", ")}`}
          </GameText>
        </p>
      )}
      {summary.developmentsStarted.length > 0 && (
        <p data-testid="summary-development-started">
          <GameText>
            {`Development started: ${summary.developmentsStarted.join(", ")}`}
          </GameText>
        </p>
      )}
      {summary.developmentsFinished.length > 0 && (
        <p data-testid="summary-development-finished">
          <GameText>
            {`Development finished, so it can be chosen for a Mission from the next Turn: ${summary.developmentsFinished.join(", ")}`}
          </GameText>
        </p>
      )}
      {summary.ongoingResearch.length > 0 && (
        <section data-testid="summary-ongoing-research">
          <h2>
            <GameText>Ongoing Research</GameText>
          </h2>
          <ul>
            {summary.ongoingResearch.map(
              (
                {
                  assetName,
                  activityName,
                  science,
                  publicSupport,
                  days,
                  benefit,
                },
                index,
              ) => (
                // Two copies of an Asset can each earn the same amount, so the position tells them apart.
                <li key={`${assetName}-${index}`}>
                  <GameText>
                    {`${assetName}, ${activityName}: ${science} Science and ${publicSupport} Public Support over ${days} ${days === 1 ? "day" : "days"}${
                      benefit
                        ? `, raised on ${benefit.days} of them by the Benefit from ${benefit.givenBy.join(" and ")}, which added ${benefit.science} Science and ${benefit.publicSupport} Public Support`
                        : ""
                    }`}
                  </GameText>
                </li>
              ),
            )}
          </ul>
        </section>
      )}
      {summary.assetsFailed.length > 0 && (
        <p className="problem" data-testid="summary-assets-failed">
          <GameText>
            {`Failed in service: ${summary.assetsFailed.join(", ")}`}
          </GameText>
        </p>
      )}
      {summary.assetsEnded.length > 0 && (
        <p data-testid="summary-assets-ended">
          <GameText>
            {`Service Life ended: ${summary.assetsEnded.join(", ")}`}
          </GameText>
        </p>
      )}
      {summary.survey && (
        <section data-testid="summary-survey">
          <h2>
            <GameText>Survey</GameText>
          </h2>
          <ul>
            {summary.survey.siteNamesSurveyed.length > 0 && (
              <li>
                <GameText>
                  {`Lower landing risk: ${summary.survey.siteNamesSurveyed.join(", ")}`}
                </GameText>
              </li>
            )}
            {summary.survey.siteNameRevealed && (
              <li>
                <GameText>
                  {`New Landing Site: ${summary.survey.siteNameRevealed}`}
                </GameText>
              </li>
            )}
          </ul>
        </section>
      )}
      {summary.fundingPayouts.length > 0 && (
        <section data-testid="summary-funding-payouts">
          <h2>
            <GameText>Funding Thresholds reached</GameText>
          </h2>
          <ul>
            {summary.fundingPayouts.map(({ publicSupport, payoutMillions }) => (
              <li key={publicSupport}>
                <GameText>
                  {`${publicSupport} Public Support: ${formatMoney(payoutMillions)}`}
                </GameText>
              </li>
            ))}
          </ul>
        </section>
      )}
      {summary.researchGrants.length > 0 && (
        <section data-testid="summary-research-grants">
          <h2>
            <GameText>
              {`Research Grants for this Turn: ${formatMoney(summary.researchGrantMillions)}`}
            </GameText>
          </h2>
          <ul>
            {summary.researchGrants.map(({ name, millions }, index) => (
              // Two copies of an Asset can each be paid the same amount, so the position tells them apart.
              <li key={`${name}-${index}`}>
                <GameText>{`${name}: ${formatMoney(millions)}`}</GameText>
              </li>
            ))}
          </ul>
        </section>
      )}
      <table>
        <tbody>
          <tr>
            <th scope="row">
              <GameText>Mission cost</GameText>
            </th>
            <td>{formatMoney(summary.missionCostMillions)}</td>
          </tr>
          {summary.developmentCostMillions > 0 && (
            <tr>
              <th scope="row">
                <GameText>Development cost</GameText>
              </th>
              <td data-testid="summary-development-cost">
                {formatMoney(summary.developmentCostMillions)}
              </td>
            </tr>
          )}
          <tr>
            <th scope="row">Money</th>
            <td>
              {formatMoney(summary.moneyStartMillions)} to{" "}
              {formatMoney(summary.moneyEndMillions)}
            </td>
          </tr>
          <tr>
            <th scope="row">
              <GameText>Science gained</GameText>
            </th>
            <td>{summary.scienceGained}</td>
          </tr>
          <tr>
            <th scope="row">
              <GameText>Public Support</GameText>
            </th>
            <td data-testid="summary-public-support">
              {summary.publicSupportStart} to {summary.publicSupportEnd}
            </td>
          </tr>
          <tr>
            <th scope="row">
              <GameText>Gained from Milestones and Ongoing Research</GameText>
            </th>
            <td>{summary.publicSupportGained}</td>
          </tr>
          <tr>
            <th scope="row">
              <GameText>Faded over the Turn</GameText>
            </th>
            <td>{summary.publicSupportDrained}</td>
          </tr>
        </tbody>
      </table>
      <button type="button" className="primary" onClick={onContinue}>
        Continue
      </button>
    </main>
  );
}
