import type { Program } from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import type { LoadedSave } from "./saveStore";

interface OpeningScreenProps {
  automaticSave: LoadedSave;
  onContinue: (program: Program) => void;
  onStartNew: () => void;
}

export function OpeningScreen({
  automaticSave,
  onContinue,
  onStartNew,
}: OpeningScreenProps) {
  return (
    <main className="summary-screen" data-testid="opening-screen">
      <h1>Mars Mission</h1>
      {automaticSave.kind === "problem" && (
        <p className="problem" role="alert">
          <GameText>{`The automatic save can't be used. ${automaticSave.message}`}</GameText>
        </p>
      )}
      {automaticSave.kind === "program" && (
        <button
          type="button"
          className="primary"
          onClick={() => {
            onContinue(automaticSave.program);
          }}
        >
          <GameText insideControl>Continue this Program</GameText>
        </button>
      )}
      <button type="button" onClick={onStartNew}>
        <GameText insideControl>Start a new Program</GameText>
      </button>
    </main>
  );
}
