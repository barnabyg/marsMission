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
import { MissionPanel } from "./MissionPanel";
import { OperatingPanel } from "./OperatingPanel";

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

type PlanningDialog = "save" | "load" | "retire";

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
  const [openDialog, setOpenDialog] = useState<PlanningDialog | null>(null);
  const [savedToSlot, setSavedToSlot] = useState<number | null>(null);

  function open(dialog: PlanningDialog) {
    setSavedToSlot(null);
    setOpenDialog(dialog);
  }

  function close() {
    setOpenDialog(null);
  }

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
            open("save");
          }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            open("load");
          }}
        >
          Load
        </button>
        <button
          type="button"
          onClick={() => {
            open("retire");
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
        <MissionPanel
          simulation={simulation}
          program={program}
          view={view}
          onSubmit={onSubmit}
        />

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

          <OperatingPanel assets={view.operatingAssets} />
        </div>
      </div>

      {openDialog === "retire" && (
        <Dialog
          title="Retire Program"
          cancelLabel="Keep going"
          onClose={close}
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
          onClose={close}
        >
          <SaveSlots
            simulation={simulation}
            saveStore={saveStore}
            action={{
              kind: "save",
              program,
              onSaved: (slot) => {
                setSavedToSlot(slot);
                close();
              },
            }}
          />
        </Dialog>
      )}
      {openDialog === "load" && (
        <Dialog
          title="Load from a Save Slot"
          cancelLabel="Cancel"
          onClose={close}
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
