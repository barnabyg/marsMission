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
import { TutorialPanel } from "./TutorialPanel";
import { useMissionPlan } from "./useMissionPlan";

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
  /** Ends this Program and starts a new one straight away. */
  onRestart: () => void;
  /** Whether this is the Program's first Planning session since it started, which offers Tutorial mode. */
  firstSession: boolean;
  onTutorialChange: (on: boolean) => void;
}

type PlanningDialog = "save" | "load" | "restart";

export function PlanningMode({
  simulation,
  program,
  lastTurn,
  saved,
  saveStore,
  onLoad,
  onSubmit,
  onRestart,
  firstSession,
  onTutorialChange,
}: PlanningModeProps) {
  const view = simulation.readProgram(program);
  const [openDialog, setOpenDialog] = useState<PlanningDialog | null>(null);
  const [savedToSlot, setSavedToSlot] = useState<number | null>(null);
  // This state lasts one visit, because App gives each visit its own key, so a choice can't reach a later Turn or a Load.
  const [operatingActivities, setOperatingActivities] = useState<
    Record<string, string>
  >({});
  const [developmentIds, setDevelopmentIds] = useState<string[]>([]);
  const [endedAssetKeys, setEndedAssetKeys] = useState<string[]>([]);
  const [crewActivities, setCrewActivities] = useState<Record<string, string>>(
    {},
  );
  // At most one journey home flies each Turn, of Crew or of samples, so choosing one replaces any other.
  const [bringHome, setBringHome] = useState<string | null>(null);
  const choices = useMissionPlan(
    simulation,
    program,
    view,
    operatingActivities,
    developmentIds,
    crewActivities,
    endedAssetKeys,
    bringHome,
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
        spendMillions={choices.spendMillions}
        actions={
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
                open("restart");
              }}
            >
              Restart Program
            </button>
            {savedToSlot !== null && (
              <p role="status">
                <GameText>{`Saved to Save Slot ${savedToSlot}.`}</GameText>
              </p>
            )}
          </div>
        }
      />

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
          choices={choices}
          onSubmit={onSubmit}
        />

        <div className="planning-side">
          <TutorialPanel
            tutorial={view.tutorial}
            firstSession={firstSession}
            onTutorialChange={onTutorialChange}
          />
          <OperatingPanel
            assets={view.operatingAssets}
            crew={view.crew}
            landingSites={view.landingSites}
            sampleReturns={view.sampleReturns}
            chosenCrewActivities={crewActivities}
            onCrewActivityChange={(key, activityId) => {
              setCrewActivities({ ...crewActivities, [key]: activityId });
            }}
            bringHome={bringHome}
            onBringHomeChange={(key, home) => {
              setBringHome(home ? key : null);
            }}
            somethingLeftToSurvey={view.somethingLeftToSurvey}
            chosenActivities={operatingActivities}
            endedKeys={endedAssetKeys}
            onEndedChange={(key, ended) => {
              setEndedAssetKeys(
                ended
                  ? [...endedAssetKeys, key]
                  : endedAssetKeys.filter((other) => other !== key),
              );
            }}
            onActivityChange={(key, activityId) => {
              setOperatingActivities({
                ...operatingActivities,
                [key]: activityId,
              });
            }}
          />

          <section
            className={view.milestones.length === 0 ? "panel empty" : "panel"}
            data-testid="milestones-panel"
          >
            <h2>
              <GameText heading>Milestones</GameText>
            </h2>
            {view.milestones.length === 0 ? (
              <p className="empty-note">
                <GameText>
                  No Milestones yet. Your first arrival at Mars will earn one.
                </GameText>
              </p>
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

      {openDialog === "restart" && (
        <Dialog
          title="Restart Program"
          cancelLabel="Keep going"
          onClose={close}
          actions={
            <button type="button" className="primary" onClick={onRestart}>
              Yes, start a new Program
            </button>
          }
        >
          <p>
            <GameText>
              Restart with a new Program? This one ends for good, unless you
              saved it to a Save Slot.
            </GameText>
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
