import { useState } from "react";
import { SummaryMilestones } from "../mission/SummaryMilestones";
import {
  anySlotUsed as anySlotUsedIn,
  LoadFromSlotDialog,
} from "../save/LoadFromSlotDialog";
import type { SaveStore } from "../save/saveStore";
import type {
  Program,
  ProgramSummary,
  Simulation,
} from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { ProgramFigures } from "./ProgramFigures";

interface ProgramSummaryScreenProps {
  summary: ProgramSummary;
  simulation: Simulation;
  saveStore: SaveStore;
  onStartNew: () => void;
  onLoad: (program: Program) => void;
}

/**
 * The story of a Program that has ended: how it ended, what it did over its Turns, its Crew and samples, the Milestones
 * it earned and when, and the seed to play it again. A player with a Save Slot can load it from here.
 */
export function ProgramSummaryScreen({
  summary,
  simulation,
  saveStore,
  onStartNew,
  onLoad,
}: ProgramSummaryScreenProps) {
  const { status, seed, milestones, countedFromTurn } = summary;
  const [anySlotUsed] = useState(() => anySlotUsedIn(saveStore));
  const [loadOpen, setLoadOpen] = useState(false);
  return (
    <main
      className="summary-screen turn-summary program-summary"
      data-testid="program-summary"
    >
      <h1>
        <GameText>Program summary</GameText>
      </h1>
      <section className="program-ending" data-testid="program-ending">
        <h2 className={status.kind === "cancelled" ? "problem" : undefined}>
          <GameText heading>
            {status.kind === "cancelled"
              ? "The Program has been cancelled."
              : "You retired this Program."}
          </GameText>
        </h2>
        {status.kind === "cancelled" && (
          <p>
            <GameText>{status.reason}</GameText>
          </p>
        )}
        <p data-testid="program-seed">
          {`It was played with seed ${String(seed)}. To play it again, add ?seed=${String(seed)} to the game's address.`}
        </p>
      </section>
      <ProgramFigures summary={summary} />
      <SummaryMilestones milestones={milestones} />
      {countedFromTurn > 1 && (
        <p className="program-counted-from" data-testid="program-counted-from">
          <GameText>
            {`This Program was saved by an earlier version of the game, so its Missions, highest Public Support, samples and the Turns of its Milestones count from Turn ${String(countedFromTurn)}.`}
          </GameText>
        </p>
      )}
      <div className="program-summary-actions">
        <button type="button" className="primary" onClick={onStartNew}>
          Start a new Program
        </button>
        {anySlotUsed && (
          <button
            type="button"
            onClick={() => {
              setLoadOpen(true);
            }}
          >
            {/* The ellipsis says it opens a dialog, as on the title screen. */}
            Load…
          </button>
        )}
      </div>
      {loadOpen && (
        <LoadFromSlotDialog
          simulation={simulation}
          saveStore={saveStore}
          // The automatic save was cleared as the Program ended, so loading loses nothing.
          action={{ kind: "load", confirm: false, onLoad }}
          onClose={() => {
            setLoadOpen(false);
          }}
        />
      )}
    </main>
  );
}
