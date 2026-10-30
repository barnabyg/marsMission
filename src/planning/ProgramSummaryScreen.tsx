import type { Simulation } from "../simulation/simulation";

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
      <h1>Program summary</h1>
      {status.kind === "cancelled" ? (
        <p className="problem">
          The Program has been cancelled. {status.reason}
        </p>
      ) : (
        <p>You retired this Program.</p>
      )}
      <table>
        <tbody>
          <tr>
            <th scope="row">Total Science</th>
            <td data-testid="total-science">{science}</td>
          </tr>
        </tbody>
      </table>
      <section>
        <h2>Milestones</h2>
        {milestones.length === 0 ? (
          <p>None achieved.</p>
        ) : (
          <ul>
            {milestones.map((milestone) => (
              <li key={milestone.id}>{milestone.name}</li>
            ))}
          </ul>
        )}
      </section>
      <button type="button" className="primary" onClick={onStartNew}>
        Start a new Program
      </button>
    </main>
  );
}
