import { lazy, Suspense, useEffect } from "react";
import { addDays, type Timeline } from "../simulation/simulation";
import { formatDate } from "../ui/format";
import { speeds } from "./playback";
import { EntryPresentation } from "./presentation";
import { journeyProgress } from "./solarSystem/orbits";
import { usePlayback } from "./usePlayback";

const SolarSystemView = lazy(() => import("./solarSystem/SolarSystemView"));

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

  const { mission } = timeline;
  const progress = journeyProgress(mission, state.day);
  const operatingAssets =
    progress < 1
      ? timeline.operatingAssetNames
      : [...timeline.operatingAssetNames, ...mission.assetNames];

  return (
    <main className="mission">
      <Suspense fallback={null}>
        <SolarSystemView
          timeline={timeline}
          day={state.day}
          operatingAssetCount={operatingAssets.length}
        />
      </Suspense>
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
      <aside className="mission-side">
        <p data-testid="journey-progress">
          {progress < 1
            ? `${mission.assetNames.join(", ")}: ${Math.round(progress * 100)}% of the way to Mars`
            : `${mission.assetNames.join(", ")}: arrived at Mars`}
        </p>
        <h2>Operating at Mars</h2>
        <ul data-testid="operating-at-mars">
          {operatingAssets.length === 0 && <li>Nothing yet</li>}
          {operatingAssets.map((name, index) => (
            <li key={index}>{name}</li>
          ))}
        </ul>
      </aside>
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
