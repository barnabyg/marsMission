import { useState } from "react";
import { Dialog } from "./Dialog";
import { GameText } from "./GameText";

interface TurnOffTutorialProps {
  /** Whether the Program can't turn it on again, which it can only on its first Turn. */
  forGood: boolean;
  onTurnOff: () => void;
}

/** Turns Tutorial mode off, asking first when that is for good. */
export function TurnOffTutorial({ forGood, onTurnOff }: TurnOffTutorialProps) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <button
        type="button"
        className="small"
        onClick={() => {
          if (forGood) setAsking(true);
          else onTurnOff();
        }}
      >
        Turn off Tutorial mode
      </button>
      {asking && (
        <Dialog
          title="Turn off Tutorial mode"
          cancelLabel="Keep it on"
          onClose={() => {
            setAsking(false);
          }}
          actions={
            <button
              type="button"
              className="primary"
              onClick={() => {
                setAsking(false);
                onTurnOff();
              }}
            >
              Yes, turn it off
            </button>
          }
        >
          <p>
            <GameText>
              Turn off Tutorial mode? The Program carries on without advice, and
              Tutorial mode can't be turned on again in this Program.
            </GameText>
          </p>
        </Dialog>
      )}
    </>
  );
}
