import { useState } from "react";
import { SaveSlotsDialog } from "../save/SaveSlots";
import type { SaveStore } from "../save/saveStore";
import type { TutorialEnd } from "../tutorial/tutorial";
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
import { SideColumn } from "./SideColumn";
import { StatusBar } from "./StatusBar";
import { TutorialAdvice } from "./TutorialAdvice";
import { TutorialEnding } from "./TutorialEnding";
import { TutorialPanel } from "./TutorialPanel";
import { useTutorialAdvice } from "./useTutorialAdvice";
import { useMissionPlan } from "./useMissionPlan";

interface PlanningModeProps {
  simulation: Simulation;
  program: Program;
  /** The Program at the start of the last Turn, or null on the first Turn or after a Load. */
  lastTurn: Program | null;
  /** The plan played on the last Turn, or null whenever lastTurn is. */
  lastPlan: TurnPlan | null;
  /** How the tutorial ended as this session started, shown until the player closes it, or null. */
  tutorialEnding: TutorialEnd | null;
  /** Whether the automatic save at the start of this Planning Mode worked. */
  saved: boolean;
  saveStore: SaveStore;
  onLoad: (program: Program) => void;
  onSubmit: (plan: TurnPlan) => void;
  /** Ends this Program and starts a new one straight away. */
  onRestart: () => void;
  onTutorialChange: (on: boolean) => void;
}

type PlanningDialog = "save" | "load" | "restart";

export function PlanningMode({
  simulation,
  program,
  lastTurn,
  lastPlan,
  tutorialEnding,
  saved,
  saveStore,
  onLoad,
  onSubmit,
  onRestart,
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
  const [endingShown, setEndingShown] = useState(tutorialEnding !== null);
  const advice = useTutorialAdvice(simulation, program, lastTurn, lastPlan);
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

        <SideColumn>
          <TutorialPanel
            tutorial={view.tutorial}
            firstTurn={view.turnNumber === 1}
            onTutorialChange={onTutorialChange}
          >
            {advice && <TutorialAdvice advice={advice} />}
          </TutorialPanel>
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
        </SideColumn>
      </div>

      {tutorialEnding && endingShown && (
        <TutorialEnding
          ending={tutorialEnding}
          onClose={() => {
            setEndingShown(false);
          }}
        />
      )}
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
        <SaveSlotsDialog
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
          onClose={close}
        />
      )}
      {openDialog === "load" && (
        <SaveSlotsDialog
          simulation={simulation}
          saveStore={saveStore}
          action={{ kind: "load", replacesProgram: true, onLoad }}
          onClose={close}
        />
      )}
    </main>
  );
}
