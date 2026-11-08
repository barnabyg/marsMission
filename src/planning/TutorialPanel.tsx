import type { ReactNode } from "react";
import type { TutorialMode } from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { TurnOffTutorial } from "../ui/TurnOffTutorial";

interface TutorialPanelProps {
  tutorial: TutorialMode;
  /** Whether this is the Program's first Turn, the only one on which Tutorial mode can be turned on. */
  firstTurn: boolean;
  onTutorialChange: (on: boolean) => void;
  /** The advice to show while Tutorial mode is on. */
  children?: ReactNode;
}

/**
 * Tutorial mode in Planning Mode: its advice while it is on, with a way to turn it off, and on a Program's first Turn
 * the offer to turn it on. Nothing otherwise.
 */
export function TutorialPanel({
  tutorial,
  firstTurn,
  onTutorialChange,
  children,
}: TutorialPanelProps) {
  if (tutorial.kind === "on") {
    return (
      <section
        className="panel tutorial-panel tutorial-voice"
        aria-labelledby="tutorial-heading"
        data-testid="tutorial-panel"
      >
        {/* The way to turn it off comes first, so that it stays in view however long the advice is. */}
        <div className="tutorial-heading">
          <h2 id="tutorial-heading">
            <GameText heading>Tutorial mode</GameText>
          </h2>
          <TurnOffTutorial
            forGood={!firstTurn}
            onTurnOff={() => {
              onTutorialChange(false);
            }}
          />
        </div>
        {children}
      </section>
    );
  }
  if (tutorial.kind === "off" && firstTurn) {
    return (
      <section
        className="panel tutorial-panel tutorial-offer"
        aria-labelledby="tutorial-heading"
        data-testid="tutorial-offer"
      >
        <h2 id="tutorial-heading">
          <GameText heading>Tutorial mode</GameText>
        </h2>
        <p>
          <GameText>
            New to the game? Tutorial mode suggests what to plan each Turn, and
            why, on a route to landing Crew at a Base. It can be turned off at
            any time, but turned on only on the Program's first Turn.
          </GameText>
        </p>
        <button
          type="button"
          onClick={() => {
            onTutorialChange(true);
          }}
        >
          Turn on Tutorial mode
        </button>
      </section>
    );
  }
  return null;
}
