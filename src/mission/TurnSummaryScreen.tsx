import { formatMoney, type TurnSummary } from "../simulation/simulation";

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
      <h1>Turn summary</h1>
      {summary.cancellationReason && (
        <p className="problem" role="alert">
          The Program has been cancelled. {summary.cancellationReason}
        </p>
      )}
      {summary.milestones.length > 0 && (
        <section>
          <h2>Milestones</h2>
          <ul>
            {summary.milestones.map((milestone) => (
              <li key={milestone.name}>
                {milestone.name}: {milestone.science} Science and{" "}
                {milestone.publicSupport} Public Support
              </li>
            ))}
          </ul>
        </section>
      )}
      <table>
        <tbody>
          <tr>
            <th scope="row">Mission cost</th>
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
            <th scope="row">Science gained</th>
            <td>{summary.scienceGained}</td>
          </tr>
          <tr>
            <th scope="row">Public Support</th>
            <td data-testid="summary-public-support">
              {summary.publicSupportStart} to {summary.publicSupportEnd}
            </td>
          </tr>
          <tr>
            <th scope="row">Gained from Milestones</th>
            <td>{summary.publicSupportGained}</td>
          </tr>
          <tr>
            <th scope="row">Faded over the Turn</th>
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
