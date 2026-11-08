import type { ReactNode } from "react";
import type { TutorialMode } from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { TurnOffTutorial } from "../ui/TurnOffTutorial";

interface TutorialPanelProps {
  tutorial: TutorialMode;
  /** Whether this is the Program's first Planning session since it started, the only one that offers Tutorial mode. */
  firstSession: boolean;
  onTutorialChange: (on: boolean) => void;
  /** The advice to show while Tutorial mode is on. */
  children?: ReactNode;
}

/**
 * Tutorial mode in Planning Mode: its advice while it is on, with a way to turn it off, and on a new Program's first
 * Planning session the offer to turn it on. Nothing otherwise.
 */
export function TutorialPanel({
  tutorial,
  firstSession,
  onTutorialChange,
  children,
}: TutorialPanelProps) {
  if (tutorial.kind === "on") {
    return (
      <section
        className="panel tutorial-panel"
        aria-labelledby="tutorial-heading"
        data-testid="tutorial-panel"
      >
        {/* The way to turn it off comes first, so that it stays in view however long the advice is. */}
        <div className="tutorial-heading">
          <h2 id="tutorial-heading">
            <GameText heading>Tutorial mode</GameText>
          </h2>
          <TurnOffTutorial
            forGood={!firstSession}
            onTurnOff={() => {
              onTutorialChange(false);
            }}
          />
        </div>
        {children}
      </section>
    );
  }
  if (tutorial.kind === "off" && firstSession) {
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
            any time, but turned on only now, as the Program starts.
          </GameText>
        </p>
        <button
          type="button"
          onClick={() => {
            onTutorialChange(true);
          }}
        >
          Turn on tutorial mode
        </button>
      </section>
    );
  }
  return null;
}
