import { useEffect } from "react";
import { addDays, type Timeline } from "../simulation/simulation";
import { formatDate } from "../ui/format";
import { speeds } from "./playback";
import { EntryPresentation } from "./presentation";
import { usePlayback } from "./usePlayback";

interface MissionModeProps {
  timeline: Timeline;
  onFinished: () => void;
}

export function MissionMode({ timeline, onFinished }: MissionModeProps) {
  const { state, setSpeed, dismiss } = usePlayback(timeline);

  useEffect(() => {
    if (state.finished) onFinished();
  }, [state.finished, onFinished]);

  const entry =
    state.activeEntry === null
      ? undefined
      : timeline.entries[state.activeEntry];
  const turnProgress = (state.day / timeline.durationDays) * 100;

  return (
    <main className="mission">
      <header className="mission-bar">
        <h1>Mission Mode</h1>
        <p data-testid="mission-date">
          {formatDate(addDays(timeline.startDate, Math.floor(state.day)))}
        </p>
        <progress
          aria-label="Progress through the Turn"
          max={100}
          value={turnProgress}
        />
        <div role="group" aria-label="Speed" className="speed-controls">
          <span>
            Speed: <strong data-testid="current-speed">{state.speed}x</strong>
          </span>
          {speeds.map((speed) => (
            <button
              key={speed}
              type="button"
              aria-pressed={state.speed === speed}
              onClick={() => {
                setSpeed(speed);
              }}
            >
              {speed}x
            </button>
          ))}
        </div>
      </header>
      {entry && (
        <EntryPresentation
          key={state.activeEntry}
          entry={entry}
          onDismiss={dismiss}
        />
      )}
    </main>
  );
}
