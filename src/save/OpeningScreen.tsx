import { useState } from "react";
import type { Program, Simulation } from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import {
  anySlotUsed as anySlotUsedIn,
  SaveSlotsDialog,
  UsedSaveSlots,
} from "./SaveSlots";
import type { LoadedSave, SaveStore } from "./saveStore";
import type { ManualSlot } from "./slotChoice";

interface OpeningScreenProps {
  simulation: Simulation;
  saveStore: SaveStore;
  automaticSave: LoadedSave;
  onContinue: (program: Program) => void;
  onStartNew: () => void;
  onLoad: (program: Program) => void;
}

/** The title screen: the game's name over Mars, a way back into a Program, and the Save Slots in use. */
export function OpeningScreen({
  simulation,
  saveStore,
  automaticSave,
  onContinue,
  onStartNew,
  onLoad,
}: OpeningScreenProps) {
  const [anySlotUsed] = useState(() => anySlotUsedIn(saveStore));
  // The slot whose Load asked first, because loading it replaces the automatic save.
  const [confirmingSlot, setConfirmingSlot] = useState<ManualSlot | null>(null);

  return (
    <main className="title-screen" data-testid="opening-screen">
      <div className="title-screen-content">
        {/* Plain text: the "Mission" in the game's name isn't the game term. */}
        <h1 data-game-name>Mars Mission</h1>
        {automaticSave.kind === "problem" && (
          <p className="problem" role="alert">
            <GameText>{`The automatic save can't be used. ${automaticSave.message}`}</GameText>
          </p>
        )}
        <div className="title-screen-actions">
          {automaticSave.kind === "program" && (
            <button
              type="button"
              className="primary large"
              onClick={() => {
                onContinue(automaticSave.program);
              }}
            >
              Continue this Program
            </button>
          )}
          <button type="button" className="large" onClick={onStartNew}>
            Start a new Program
          </button>
        </div>
        {/* Hidden while the dialog asks, which lists the same slots. */}
        {anySlotUsed && confirmingSlot === null && (
          <section
            className="title-screen-slots"
            aria-labelledby="title-screen-slots"
          >
            <h2 id="title-screen-slots" className="subheading">
              <GameText heading>Save Slots</GameText>
            </h2>
            <UsedSaveSlots
              simulation={simulation}
              saveStore={saveStore}
              onChoose={(slot, program) => {
                // Loading replaces the automatic save, so it asks first when there's one to lose.
                if (automaticSave.kind === "program") setConfirmingSlot(slot);
                else onLoad(program);
              }}
            />
          </section>
        )}
      </div>
      {confirmingSlot !== null && (
        <SaveSlotsDialog
          simulation={simulation}
          saveStore={saveStore}
          action={{ kind: "load", replacesProgram: true, onLoad }}
          initialSlot={confirmingSlot}
          onClose={() => {
            setConfirmingSlot(null);
          }}
        />
      )}
    </main>
  );
}
