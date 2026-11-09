import { lazy, Suspense, useEffect, useMemo } from "react";
import {
  addDays,
  type DecisionAnswer,
  type DecisionPoint,
  type Timeline,
} from "../simulation/simulation";
import { formatDate } from "../ui/format";
import { GameText } from "../ui/GameText";
import { Icon, type IconName } from "../ui/Icon";
import type { DecisionAdvice } from "../tutorial/tutorial";
import { TurnOffTutorial } from "../ui/TurnOffTutorial";
import { DecisionPointAdvice, DecisionPointPanel } from "./DecisionPointPanel";
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
  surfaceUnavailableReason,
} from "./surface/SurfaceControls";
import {
  solarParticleEventShowing,
  spacecraftFallback,
  spacecraftHasSomethingToShow,
} from "./spacecraft/spacecraft";
import {
  earthOrbitNow,
  refuellingOf,
  rendezvousHasPlayed,
} from "./spacecraft/refuelling";
import {
  SpacecraftControls,
  spacecraftUnavailableReason,
} from "./spacecraft/SpacecraftControls";
import {
  ascentNow,
  ascentSequenceOf,
  sitesDuringAscent,
} from "./surface/ascent";
import { homewardInSpace, homewardOf, homewardQuiet } from "./homeward";
import { marsRendezvousNow } from "./spacecraft/marsRendezvous";
import { earthEntryNow } from "./spacecraft/splashdown";
import { useMissionView } from "./useMissionView";
import { usePlayback } from "./usePlayback";
import { useSounds } from "./useSounds";

const MissionScene = lazy(() => import("./MissionScene"));

/** The icon beside each speed: faster ones with more arrows, and a lightning bolt for the fastest. */
const speedIcons: Record<(typeof speeds)[number], IconName> = {
  1: "play",
  5: "fast-forward",
  10: "chevrons-right",
  20: "zap",
};

interface MissionModeProps {
  timeline: Timeline;
  /** The Decision Point the Timeline stops at, if it does. */
  decisionPoint: DecisionPoint | null;
  onAnswer: (decisionId: string, answer: DecisionAnswer) => void;
  /** The speed to start at, so a player's choice carries over between Turns. */
  initialSpeed: number;
  onSpeedChange: (speed: number) => void;
  onFinished: () => void;
  /** Tutorial mode's suggested answer to the Decision Point, while it is on. */
  decisionAdvice: DecisionAdvice | null;
  /** Whether Tutorial mode is on, which Mission Mode can turn off. */
  tutorialOn: boolean;
  onTutorialOff: () => void;
}

export function MissionMode({
  timeline,
  decisionPoint,
  onAnswer,
  initialSpeed,
  onSpeedChange,
  onFinished,
  decisionAdvice,
  tutorialOn,
  onTutorialOff,
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
  const homeward = useMemo(() => homewardOf(timeline), [timeline]);
  const ascentSequence = useMemo(
    () => ascentSequenceOf(timeline, homeward),
    [timeline, homeward],
  );
  const ascent = ascentNow(ascentSequence, homeward, state);
  const sites = sitesDuringAscent(
    sitesDuring(sitesToShow(timeline, state.day), sequence),
    ascent,
  );
  const inSpace = homewardInSpace(homeward, state);
  const marsRendezvous = marsRendezvousNow(homeward, inSpace);
  const earthEntry = earthEntryNow(homeward, inSpace);
  const spacecraftAvailable =
    spacecraftHasSomethingToShow(timeline, state) || inSpace !== null;
  const particles = solarParticleEventShowing(timeline.entries, state);
  const refuelling = useMemo(() => refuellingOf(timeline.entries), [timeline]);
  const earthOrbit = earthOrbitNow(refuelling, state);
  const { view, chooseView, site, pickSite } = useMissionView(
    timeline.entries,
    state.entriesHappened,
    sites,
    spacecraftAvailable
      ? null
      : spacecraftFallback(timeline.mission, state.day),
    (entryIndex) =>
      rendezvousHasPlayed(refuelling, state, entryIndex) ||
      homewardQuiet(homeward, state, entryIndex),
    homeward?.siteName ?? null,
  );
  /** Why each view's button is disabled, while its view has nothing to show. */
  const unavailable: Partial<Record<MissionViewId, string>> = {
    ...(site === null ? { surface: surfaceUnavailableReason } : {}),
    ...(spacecraftAvailable ? {} : { spacecraft: spacecraftUnavailableReason }),
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
          ascent={ascent}
          particles={particles}
          earthOrbit={earthOrbit}
          marsRendezvous={marsRendezvous}
          earthEntry={earthEntry}
          operatingAssetCount={operatingAssets.length}
        />
      </Suspense>
      <header className="mission-bar">
        <div className="mission-bar-start">
          <h1>
            <GameText>Mission Mode</GameText>
          </h1>
          <p data-testid="mission-date">
            {formatDate(addDays(timeline.startDate, Math.floor(state.day)))}
          </p>
          <div role="group" aria-label="View" className="mission-tabs">
            {/* The pressed tab shows the view, so this is for a screen reader. */}
            <span className="visually-hidden">
              View: <strong data-testid="current-view">{viewName(view)}</strong>
            </span>
            {missionViews.map(({ id, name }) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                disabled={unavailable[id] !== undefined}
                title={unavailable[id]}
                onClick={() => {
                  chooseView(id);
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
        <div className="mission-playback" data-testid="mission-playback">
          <div role="group" aria-label="Speed" className="speed-controls">
            {/* The pressed button shows the speed, so this is for a screen reader. */}
            <span className="visually-hidden">
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
              <Icon name="pause" />
              <span className="visually-hidden">Pause</span>
            </button>
            {speeds.map((speed) => (
              <button
                key={speed}
                type="button"
                aria-pressed={
                  !state.paused && !deciding && state.speed === speed
                }
                onClick={() => {
                  setSpeed(speed);
                }}
              >
                <Icon name={speedIcons[speed]} />
                {speed}x
              </button>
            ))}
          </div>
          <button
            type="button"
            className="mute"
            aria-pressed={muted}
            onClick={() => {
              setMuted(!muted);
            }}
          >
            <Icon name={muted ? "volume-x" : "volume-2"} />
            <span className="visually-hidden">Mute sound</span>
          </button>
        </div>
        <button
          type="button"
          className="primary end-turn"
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
        <progress
          aria-label="Progress through the Turn"
          max={100}
          value={turnProgress}
        />
      </header>
      <aside className="mission-side" data-testid="mission-info">
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
          ascent={ascent}
          onPickSite={pickSite}
        />
        <SpacecraftControls
          timeline={timeline}
          day={state.day}
          view={view}
          available={spacecraftAvailable}
          particles={particles}
          earthOrbit={earthOrbit}
          marsRendezvous={marsRendezvous}
          earthEntry={earthEntry}
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
        {deciding && (
          <DecisionPointAdvice
            decisionPoint={decisionPoint}
            advice={decisionAdvice}
          />
        )}
        {tutorialOn && (
          <div
            className="mission-tutorial tutorial-voice"
            data-testid="mission-tutorial"
          >
            <p>
              <GameText>Tutorial mode is on.</GameText>
            </p>
            <TurnOffTutorial forGood onTurnOff={onTutorialOff} />
          </div>
        )}
      </aside>
      {deciding && (
        <DecisionPointPanel
          decisionPoint={decisionPoint}
          advice={decisionAdvice}
          onAnswer={(answer) => {
            onAnswer(decisionPoint.id, answer);
          }}
        />
      )}
      <EventsColumn
        timeline={timeline}
        entriesHappened={state.entriesHappened}
        deciding={deciding}
      />
    </main>
  );
}
