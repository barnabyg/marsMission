import { useState } from "react";
import { SaveSlots } from "../save/SaveSlots";
import type { SaveStore } from "../save/saveStore";
import {
  formatMoney,
  type Program,
  type Simulation,
  type TurnPlan,
} from "../simulation/simulation";
import { Dialog } from "../ui/Dialog";
import { formatLaunchWindow } from "../ui/format";
import { GameText } from "../ui/GameText";

interface PlanningModeProps {
  simulation: Simulation;
  program: Program;
  /** Whether the automatic save at the start of this Planning Mode worked. */
  saved: boolean;
  saveStore: SaveStore;
  onLoad: (program: Program) => void;
  onSubmit: (plan: TurnPlan) => void;
  onRetire: () => void;
}

export function PlanningMode({
  simulation,
  program,
  saved,
  saveStore,
  onLoad,
  onSubmit,
  onRetire,
}: PlanningModeProps) {
  const view = simulation.readProgram(program);
  const [launchVehicleId, setLaunchVehicleId] = useState(
    view.launchVehicles[0]?.id ?? "",
  );
  const [assetId, setAssetId] = useState(view.assets[0]?.id ?? "");
  const [reliability, setReliability] = useState<Record<string, string>>({});
  const [openDialog, setOpenDialog] = useState<
    "save" | "load" | "retire" | null
  >(null);
  const [savedToSlot, setSavedToSlot] = useState<number | null>(null);

  const plannedEvents = simulation.previewMission({
    launchVehicleId,
    assetIds: [assetId],
    reliability,
  });
  const plan: TurnPlan = {
    mission: {
      launchVehicleId,
      assetIds: [assetId],
      // Only the Mission Events this Mission goes through, because a choice can outlive a change of Asset.
      reliability: Object.fromEntries(
        plannedEvents.map((event) => [event.eventId, event.reliabilityLevelId]),
      ),
    },
  };
  const { costMillions, problems } = simulation.validatePlan(program, plan);

  return (
    <main className="planning">
      <header className="status-bar">
        <h1>
          <GameText>Planning Mode</GameText>
        </h1>
        <dl>
          <div>
            <dt>
              <GameText>Turn</GameText>
            </dt>
            <dd data-testid="turn-number">{view.turnNumber}</dd>
          </div>
          <div>
            <dt>
              <GameText>Launch Window</GameText>
            </dt>
            <dd data-testid="launch-window">{formatLaunchWindow(view.date)}</dd>
          </div>
          <div>
            <dt>Money</dt>
            <dd data-testid="money">{formatMoney(view.moneyMillions)}</dd>
          </div>
          <div>
            <dt>
              <GameText>Public Support</GameText>
            </dt>
            <dd data-testid="public-support">{view.publicSupport}</dd>
          </div>
          <div>
            <dt>
              <GameText>Next Funding Threshold</GameText>
            </dt>
            <dd data-testid="next-funding-threshold">
              {view.nextFundingThreshold
                ? `${formatMoney(view.nextFundingThreshold.payoutMillions)} at ${view.nextFundingThreshold.publicSupport} (${view.nextFundingThreshold.pointsAway} away)`
                : "None left"}
            </dd>
          </div>
          <div>
            <dt>
              <GameText>Cancellation Level</GameText>
            </dt>
            <dd>{view.cancellationLevel}</dd>
          </div>
          <div>
            <dt>
              <GameText>Science</GameText>
            </dt>
            <dd data-testid="science">{view.science}</dd>
          </div>
        </dl>
      </header>

      <div className="program-actions">
        <button
          type="button"
          onClick={() => {
            setSavedToSlot(null);
            setOpenDialog("save");
          }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setSavedToSlot(null);
            setOpenDialog("load");
          }}
        >
          Load
        </button>
        <button
          type="button"
          onClick={() => {
            setSavedToSlot(null);
            setOpenDialog("retire");
          }}
        >
          Retire Program
        </button>
        {savedToSlot !== null && (
          <p role="status">
            <GameText>{`Saved to Save Slot ${savedToSlot}.`}</GameText>
          </p>
        )}
      </div>

      {!saved && (
        <p className="problem" role="alert">
          <GameText>
            The browser wouldn't store the automatic save, so this Program may
            be lost if you close the game.
          </GameText>
        </p>
      )}

      <div className="planning-columns">
        <section className="panel">
          <h2>
            <GameText>Mission</GameText>
          </h2>
          <label>
            <span>
              <GameText>Launch Vehicle</GameText>
            </span>
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
            <span>
              <GameText>Asset</GameText>
            </span>
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
          <h3>
            <GameText>Mission Events, Risk Bands and Reliability</GameText>
          </h3>
          <ol className="mission-events" data-testid="mission-events">
            {plannedEvents.map((event) => (
              <li key={event.eventId} data-testid="mission-event">
                <span className="mission-event-name">{event.name}</span>
                <strong className="risk-band" data-testid="risk-band">
                  {event.riskBand}
                </strong>
                <select
                  aria-label={`Reliability for ${event.name}`}
                  value={event.reliabilityLevelId}
                  onChange={(change) => {
                    setReliability({
                      ...reliability,
                      [event.eventId]: change.target.value,
                    });
                  }}
                >
                  {event.reliabilityLevels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name} ({formatMoney(level.costMillions)},{" "}
                      {level.riskBand})
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ol>
          <p className="total-cost">
            Total cost:{" "}
            <strong data-testid="mission-cost">
              {formatMoney(costMillions)}
            </strong>
          </p>
          {problems.map((problem) => (
            <p key={problem} className="problem" role="alert">
              <GameText>{problem}</GameText>
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
          <button
            type="button"
            onClick={() => {
              onSubmit({ mission: null });
            }}
          >
            End Turn without launching
          </button>
        </section>

        <div className="planning-side">
          <section className="panel">
            <h2>
              <GameText>Milestones</GameText>
            </h2>
            {view.milestones.length === 0 ? (
              <p>None yet.</p>
            ) : (
              <ul data-testid="milestones">
                {view.milestones.map((milestone) => (
                  <li key={milestone.id}>
                    <GameText>{milestone.name}</GameText>
                  </li>
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
                  <li key={`${asset.assetId}-${asset.arrivedOn}`}>
                    {asset.name}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {openDialog === "retire" && (
        <Dialog
          title="Retire Program"
          cancelLabel="Keep going"
          onClose={() => {
            setOpenDialog(null);
          }}
          actions={
            <button type="button" className="primary" onClick={onRetire}>
              Yes, retire the Program
            </button>
          }
        >
          <p>
            <GameText>Retire this Program? This ends it for good.</GameText>
          </p>
        </Dialog>
      )}
      {openDialog === "save" && (
        <Dialog
          title="Save to a Save Slot"
          cancelLabel="Cancel"
          onClose={() => {
            setOpenDialog(null);
          }}
        >
          <SaveSlots
            simulation={simulation}
            saveStore={saveStore}
            action={{
              kind: "save",
              program,
              onSaved: (slot) => {
                setSavedToSlot(slot);
                setOpenDialog(null);
              },
            }}
          />
        </Dialog>
      )}
      {openDialog === "load" && (
        <Dialog
          title="Load from a Save Slot"
          cancelLabel="Cancel"
          onClose={() => {
            setOpenDialog(null);
          }}
        >
          <SaveSlots
            simulation={simulation}
            saveStore={saveStore}
            action={{ kind: "load", confirm: true, onLoad }}
          />
        </Dialog>
      )}
    </main>
  );
}
