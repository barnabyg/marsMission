import { lazy, Suspense, useEffect, useMemo } from "react";
import { addDays, type Timeline } from "../simulation/simulation";
import { formatDate } from "../ui/format";
import { GameText } from "../ui/GameText";
import { EventsColumn } from "./EventsColumn";
import { missionViews, viewName } from "./missionViews";
import { speeds } from "./playback";
import { assetsOperatingOn, describeJourney } from "./journey";
import {
  landingSequenceOf,
  sequenceNow,
  sitesDuring,
} from "./surface/sequence";
import { sitesToShow } from "./surface/surface";
import {
  SurfaceControls,
  surfaceUnavailableId,
} from "./surface/SurfaceControls";
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

  const landingSequence = useMemo(
    () => landingSequenceOf(timeline),
    [timeline],
  );
  const sequence = sequenceNow(landingSequence, state);
  const sites = sitesDuring(sitesToShow(timeline, state.day), sequence);
  const { view, chooseView, site, pickSite } = useMissionView(
    timeline.entries,
    state.entriesHappened,
    sites,
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
          site={site}
          sequence={sequence}
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
          {missionViews.map(({ id, name }) => {
            const unavailable = id === "surface" && site === null;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                disabled={unavailable}
                aria-describedby={
                  unavailable ? surfaceUnavailableId : undefined
                }
                onClick={() => {
                  chooseView(id);
                }}
              >
                {name}
              </button>
            );
          })}
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
        <button
          type="button"
          title="Skip to the Turn summary. The rest of the Turn still happens."
          onClick={onFinished}
        >
          End Turn
        </button>
      </header>
      <aside className="mission-side">
        <p data-testid="journey-progress">
          <GameText>{describeJourney(timeline.mission, state.day)}</GameText>
        </p>
        <SurfaceControls
          timeline={timeline}
          day={state.day}
          view={view}
          sites={sites}
          site={site}
          sequence={sequence}
          onPickSite={pickSite}
        />
        <h2>Operating at Mars</h2>
        <ul data-testid="operating-at-mars">
          {operatingAssets.length === 0 && <li>Nothing</li>}
          {operatingAssets.map((asset, index) => (
            <li key={index}>
              <GameText>{asset}</GameText>
            </li>
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
