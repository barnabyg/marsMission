import type { Simulation } from "../simulation/simulation";
import { GameText } from "../ui/GameText";

interface ProgramSummaryScreenProps {
  view: ReturnType<Simulation["readProgram"]>;
  onStartNew: () => void;
}

export function ProgramSummaryScreen({
  view,
  onStartNew,
}: ProgramSummaryScreenProps) {
  const { status, science, milestones } = view;
  return (
    <main className="summary-screen" data-testid="program-summary">
      <h1>
        <GameText>Program summary</GameText>
      </h1>
      {status.kind === "cancelled" ? (
        <p className="problem">
          <GameText>
            {`The Program has been cancelled. ${status.reason}`}
          </GameText>
        </p>
      ) : (
        <p>
          <GameText>You retired this Program.</GameText>
        </p>
      )}
      <table>
        <tbody>
          <tr>
            <th scope="row">
              <GameText>Total Science</GameText>
            </th>
            <td data-testid="total-science">{science}</td>
          </tr>
        </tbody>
      </table>
      <section>
        <h2>
          <GameText>Milestones</GameText>
        </h2>
        {milestones.length === 0 ? (
          <p>None achieved.</p>
        ) : (
          <ul>
            {milestones.map((milestone) => (
              <li key={milestone.id}>
                <GameText>{milestone.name}</GameText>
              </li>
            ))}
          </ul>
        )}
      </section>
      <button type="button" className="primary" onClick={onStartNew}>
        <GameText insideControl>Start a new Program</GameText>
      </button>
    </main>
  );
}
