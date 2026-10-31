import { formatMoney, type TurnSummary } from "../simulation/simulation";
import { GameText } from "../ui/GameText";

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
            <GameText>Mission failed</GameText>
          </h2>
          <ul>
            <li>
              <GameText>
                {`Mission Event that failed: ${summary.failure.missionEventName}`}
              </GameText>
            </li>
            <li>
              <GameText>
                {`Assets lost: ${summary.failure.assetsLost.join(", ")}`}
              </GameText>
            </li>
            <li>
              <GameText>
                {`Public Support lost: ${summary.failure.publicSupportLost}`}
              </GameText>
            </li>
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
      {summary.firstLanding && (
        <p data-testid="summary-first-landing">
          <GameText>
            {`First landing at ${summary.firstLanding.siteName}: ${summary.firstLanding.science} Science`}
          </GameText>
        </p>
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
      <table>
        <tbody>
          <tr>
            <th scope="row">
              <GameText>Mission cost</GameText>
            </th>
            <td>{formatMoney(summary.missionCostMillions)}</td>
          </tr>
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
              <GameText>Gained from Milestones</GameText>
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
