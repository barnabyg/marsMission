import { useState } from "react";
import {
  formatMoney,
  type Program,
  type Simulation,
  type TurnPlan,
} from "../simulation/simulation";
import { formatLaunchWindow } from "../ui/format";

interface PlanningModeProps {
  simulation: Simulation;
  program: Program;
  onSubmit: (plan: TurnPlan) => void;
}

export function PlanningMode({
  simulation,
  program,
  onSubmit,
}: PlanningModeProps) {
  const view = simulation.readProgram(program);
  const [launchVehicleId, setLaunchVehicleId] = useState(
    view.launchVehicles[0]?.id ?? "",
  );
  const [assetId, setAssetId] = useState(view.assets[0]?.id ?? "");

  const plan: TurnPlan = {
    mission: { launchVehicleId, assetIds: [assetId] },
  };
  const { costMillions, problems } = simulation.validatePlan(program, plan);

  return (
    <main className="planning">
      <header className="status-bar">
        <h1>Planning Mode</h1>
        <dl>
          <div>
            <dt>Turn</dt>
            <dd data-testid="turn-number">{view.turnNumber}</dd>
          </div>
          <div>
            <dt>Launch Window</dt>
            <dd data-testid="launch-window">{formatLaunchWindow(view.date)}</dd>
          </div>
          <div>
            <dt>Money</dt>
            <dd data-testid="money">{formatMoney(view.moneyMillions)}</dd>
          </div>
          <div>
            <dt>Public Support</dt>
            <dd data-testid="public-support">{view.publicSupport}</dd>
          </div>
          <div>
            <dt>Science</dt>
            <dd data-testid="science">{view.science}</dd>
          </div>
        </dl>
      </header>

      <section className="panel">
        <h2>Mission</h2>
        <label>
          Launch Vehicle
          <select
            value={launchVehicleId}
            onChange={(event) => {
              setLaunchVehicleId(event.target.value);
            }}
          >
            {view.launchVehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.name} ({formatMoney(vehicle.costMillions)})
              </option>
            ))}
          </select>
        </label>
        <label>
          Asset
          <select
            value={assetId}
            onChange={(event) => {
              setAssetId(event.target.value);
            }}
          >
            {view.assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name} ({formatMoney(asset.costMillions)})
              </option>
            ))}
          </select>
        </label>
        <p className="total-cost">
          Total cost:{" "}
          <strong data-testid="mission-cost">
            {formatMoney(costMillions)}
          </strong>
        </p>
        {problems.map((problem) => (
          <p key={problem} className="problem" role="alert">
            {problem}
          </p>
        ))}
        <button
          type="button"
          className="primary"
          disabled={problems.length > 0}
          onClick={() => {
            onSubmit(plan);
          }}
        >
          Launch Mission
        </button>
      </section>

      <section className="panel">
        <h2>Milestones</h2>
        {view.milestones.length === 0 ? (
          <p>None yet.</p>
        ) : (
          <ul data-testid="milestones">
            {view.milestones.map((milestone) => (
              <li key={milestone.id}>{milestone.name}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Operating at Mars</h2>
        {view.operatingAssets.length === 0 ? (
          <p>Nothing yet.</p>
        ) : (
          <ul data-testid="operating-assets">
            {view.operatingAssets.map((asset) => (
              <li key={`${asset.assetId}-${asset.arrivedOn}`}>{asset.name}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
