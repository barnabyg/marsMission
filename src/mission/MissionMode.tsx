import { lazy, Suspense, useEffect, useMemo } from "react";
import {
  addDays,
  type DecisionAnswer,
  type DecisionPoint,
  type Timeline,
} from "../simulation/simulation";
import { formatDate } from "../ui/format";
import { GameText } from "../ui/GameText";
import { DecisionPointPanel } from "./DecisionPointPanel";
import { EventsColumn } from "./EventsColumn";
import { missionViews, viewName, type MissionViewId } from "./missionViews";
import { atDecisionPoint, speeds } from "./playback";
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
import {
  solarParticleEventShowing,
  spacecraftFallback,
  spacecraftHasSomethingToShow,
} from "./spacecraft/spacecraft";
import {
  SpacecraftControls,
  spacecraftUnavailableId,
} from "./spacecraft/SpacecraftControls";
import { useMissionView } from "./useMissionView";
import { usePlayback } from "./usePlayback";
import { useSounds } from "./useSounds";

const MissionScene = lazy(() => import("./MissionScene"));

interface MissionModeProps {
  timeline: Timeline;
  /** The Decision Point the Timeline stops at, if it does. */
  decisionPoint: DecisionPoint | null;
  onAnswer: (decisionId: string, answer: DecisionAnswer) => void;
  /** The speed to start at, so a player's choice carries over between Turns. */
  initialSpeed: number;
  onSpeedChange: (speed: number) => void;
  onFinished: () => void;
}

export function MissionMode({
  timeline,
  decisionPoint,
  onAnswer,
  initialSpeed,
  onSpeedChange,
  onFinished,
}: MissionModeProps) {
  const { state, setSpeed, pause, skipToDecision } = usePlayback(
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
  const spacecraftAvailable = spacecraftHasSomethingToShow(timeline, state);
  const particles = solarParticleEventShowing(timeline.entries, state);
  const { view, chooseView, site, pickSite } = useMissionView(
    timeline.entries,
    state.entriesHappened,
    sites,
    spacecraftAvailable
      ? null
      : spacecraftFallback(timeline.mission, state.day),
  );
  /** The explanation tied to each view's button while it has nothing to show. */
  const unavailable: Partial<Record<MissionViewId, string>> = {
    ...(site === null ? { surface: surfaceUnavailableId } : {}),
    ...(spacecraftAvailable ? {} : { spacecraft: spacecraftUnavailableId }),
  };

  useEffect(() => {
    if (state.finished) onFinished();
  }, [state.finished, onFinished]);

  const deciding = decisionPoint !== null && atDecisionPoint(state, timeline);
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
          particles={particles}
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
              disabled={unavailable[id] !== undefined}
              aria-describedby={unavailable[id]}
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
              {state.paused || deciding ? "Paused" : `${state.speed}x`}
            </strong>
          </span>
          <button
            type="button"
            aria-pressed={state.paused || deciding}
            onClick={pause}
          >
            Pause
          </button>
          {speeds.map((speed) => (
            <button
              key={speed}
              type="button"
              aria-pressed={!state.paused && !deciding && state.speed === speed}
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
          title={
            decisionPoint
              ? "Skip to the next Decision Point, which you must answer."
              : "Skip to the Turn summary. The rest of the Turn still happens."
          }
          disabled={deciding}
          onClick={decisionPoint ? skipToDecision : onFinished}
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
        <SpacecraftControls
          timeline={timeline}
          day={state.day}
          view={view}
          available={spacecraftAvailable}
          particles={particles}
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
      {deciding && (
        <DecisionPointPanel
          decisionPoint={decisionPoint}
          onAnswer={(answer) => {
            onAnswer(decisionPoint.id, answer);
          }}
        />
      )}
      <EventsColumn
        timeline={timeline}
        entriesHappened={state.entriesHappened}
      />
    </main>
  );
}
