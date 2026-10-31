import { lazy, Suspense, useEffect } from "react";
import { addDays, type Timeline } from "../simulation/simulation";
import { formatDate } from "../ui/format";
import { GameText } from "../ui/GameText";
import { EventsColumn } from "./EventsColumn";
import { missionViews, viewName } from "./missionViews";
import { speeds } from "./playback";
import { assetsOperatingOn, describeJourney } from "./journey";
import { useMissionView } from "./useMissionView";
import { usePlayback } from "./usePlayback";
import { useSounds } from "./useSounds";

const MissionScene = lazy(() => import("./MissionScene"));

interface MissionModeProps {
  timeline: Timeline;
  /** The speed to start at, so a player's choice carries over between Turns. */
  initialSpeed: number;
  onSpeedChange: (speed: number) => void;
  onFinished: () => void;
}

export function MissionMode({
  timeline,
  initialSpeed,
  onSpeedChange,
  onFinished,
}: MissionModeProps) {
  const { state, setSpeed, pause } = usePlayback(
    timeline,
    initialSpeed,
    onSpeedChange,
  );

  const { muted, setMuted } = useSounds(
    timeline.entries,
    state.entriesHappened,
  );

  const { view, chooseView } = useMissionView(
    timeline.entries,
    state.entriesHappened,
  );

  useEffect(() => {
    if (state.finished) onFinished();
  }, [state.finished, onFinished]);

  const turnProgress = (state.day / timeline.durationDays) * 100;

  const operatingAssets = assetsOperatingOn(timeline, state.day);

  return (
    <main className="mission">
      <Suspense fallback={null}>
        <MissionScene
          timeline={timeline}
          day={state.day}
          view={view}
          operatingAssetCount={operatingAssets.length}
        />
      </Suspense>
      <header className="mission-bar">
        <h1>
          <GameText>Mission Mode</GameText>
        </h1>
        <p data-testid="mission-date">
          {formatDate(addDays(timeline.startDate, Math.floor(state.day)))}
        </p>
        <progress
          aria-label="Progress through the Turn"
          max={100}
          value={turnProgress}
        />
        <button
          type="button"
          aria-pressed={muted}
          onClick={() => {
            setMuted(!muted);
          }}
        >
          Mute sound
        </button>
        <div role="group" aria-label="View" className="speed-controls">
          <span>
            View: <strong data-testid="current-view">{viewName(view)}</strong>
          </span>
          {missionViews.map(({ id, name }) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => {
                chooseView(id);
              }}
            >
              {name}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Speed" className="speed-controls">
          <span>
            Speed:{" "}
            <strong data-testid="current-speed">
              {state.paused ? "Paused" : `${state.speed}x`}
            </strong>
          </span>
          <button type="button" aria-pressed={state.paused} onClick={pause}>
            Pause
          </button>
          {speeds.map((speed) => (
            <button
              key={speed}
              type="button"
              aria-pressed={!state.paused && state.speed === speed}
              onClick={() => {
                setSpeed(speed);
              }}
            >
              {speed}x
            </button>
          ))}
        </div>
      </header>
      <aside className="mission-side">
        <p data-testid="journey-progress">
          <GameText>{describeJourney(timeline.mission, state.day)}</GameText>
        </p>
        <h2>Operating at Mars</h2>
        <ul data-testid="operating-at-mars">
          {operatingAssets.length === 0 && <li>Nothing</li>}
          {operatingAssets.map((asset, index) => (
            <li key={index}>{asset}</li>
          ))}
        </ul>
      </aside>
      <EventsColumn
        timeline={timeline}
        entriesHappened={state.entriesHappened}
      />
    </main>
  );
}
