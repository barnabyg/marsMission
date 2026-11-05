import { useState } from "react";
import { SaveSlots } from "../save/SaveSlots";
import type { SaveStore } from "../save/saveStore";
import {
  type Program,
  type Simulation,
  type TurnPlan,
} from "../simulation/simulation";
import { Dialog } from "../ui/Dialog";
import { GameText } from "../ui/GameText";
import { DevelopmentPanel } from "./DevelopmentPanel";
import { MissionPanel } from "./MissionPanel";
import { OperatingPanel } from "./OperatingPanel";
import { StatusBar } from "./StatusBar";

interface PlanningModeProps {
  simulation: Simulation;
  program: Program;
  /** The Program at the start of the last Turn, or null on the first Turn or after a Load. */
  lastTurn: Program | null;
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
  lastTurn,
  saved,
  saveStore,
  onLoad,
  onSubmit,
  onRetire,
}: PlanningModeProps) {
  const view = simulation.readProgram(program);
  const [openDialog, setOpenDialog] = useState<PlanningDialog | null>(null);
  const [savedToSlot, setSavedToSlot] = useState<number | null>(null);
  // This state lasts one visit, because App gives each visit its own key, so a choice can't reach a later Turn or a Load.
  const [operatingActivities, setOperatingActivities] = useState<
    Record<string, string>
  >({});
  const [developmentIds, setDevelopmentIds] = useState<string[]>([]);
  const [crewActivities, setCrewActivities] = useState<Record<string, string>>(
    {},
  );

  function open(dialog: PlanningDialog) {
    setSavedToSlot(null);
    setOpenDialog(dialog);
  }

  function close() {
    setOpenDialog(null);
  }

  return (
    <main className="planning">
      <StatusBar
        view={view}
        lastTurn={lastTurn ? simulation.readProgram(lastTurn) : null}
      />

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
          operatingActivities={operatingActivities}
          developmentIds={developmentIds}
          crewActivities={crewActivities}
          onSubmit={onSubmit}
        />

        <div className="planning-side">
          <OperatingPanel
            assets={view.operatingAssets}
            crew={view.crew}
            chosenCrewActivities={crewActivities}
            onCrewActivityChange={(key, activityId) => {
              setCrewActivities({ ...crewActivities, [key]: activityId });
            }}
            somethingLeftToSurvey={view.somethingLeftToSurvey}
            chosenActivities={operatingActivities}
            onActivityChange={(key, activityId) => {
              setOperatingActivities({
                ...operatingActivities,
                [key]: activityId,
              });
            }}
          />

          <section className="panel">
            <h2>
              <GameText heading>Milestones</GameText>
            </h2>
            {view.milestones.length === 0 ? (
              <p>None yet.</p>
            ) : (
              <ul className="milestone-list" data-testid="milestones">
                {view.milestones.map((milestone) => (
                  <li key={milestone.id}>
                    <GameText>{milestone.name}</GameText>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <DevelopmentPanel
            developments={view.developments}
            moneyMillions={view.moneyMillions}
            chosenIds={developmentIds}
            onChosenChange={setDevelopmentIds}
          />
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
