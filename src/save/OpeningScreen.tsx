import { useState } from "react";
import type { Program, Simulation } from "../simulation/simulation";
import { Dialog } from "../ui/Dialog";
import { GameText } from "../ui/GameText";
import { SaveSlots } from "./SaveSlots";
import { manualSlots, type LoadedSave, type SaveStore } from "./saveStore";

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
  const [anySlotUsed] = useState(() =>
    manualSlots.some((slot) => saveStore.load(slot).kind !== "empty"),
  );
  const [loadOpen, setLoadOpen] = useState(false);
  const loadAction = {
    kind: "load",
    // Loading replaces the automatic save, so it asks first when there's one to lose.
    confirm: automaticSave.kind === "program",
    onLoad,
  } as const;

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
              className="primary"
              onClick={() => {
                onContinue(automaticSave.program);
              }}
            >
              Continue this Program
            </button>
          )}
          <button type="button" onClick={onStartNew}>
            Start a new Program
          </button>
          {anySlotUsed && (
            <button
              type="button"
              onClick={() => {
                setLoadOpen(true);
              }}
            >
              {/* The ellipsis says it opens a dialog, and tells it apart from each slot's own Load. */}
              Load…
            </button>
          )}
        </div>
        {anySlotUsed && !loadOpen && (
          <section
            className="title-screen-slots"
            aria-labelledby="title-screen-slots"
          >
            <h2 id="title-screen-slots">
              <GameText heading>Save Slots</GameText>
            </h2>
            <SaveSlots
              simulation={simulation}
              saveStore={saveStore}
              action={loadAction}
              compact
            />
          </section>
        )}
      </div>
      {loadOpen && (
        <Dialog
          title="Load from a Save Slot"
          cancelLabel="Cancel"
          onClose={() => {
            setLoadOpen(false);
          }}
        >
          <SaveSlots
            simulation={simulation}
            saveStore={saveStore}
            action={loadAction}
          />
        </Dialog>
      )}
    </main>
  );
}
