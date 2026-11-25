import { lazy, Suspense, useEffect, useMemo, useState } from "react";
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
import { UnavailableButton } from "../ui/UnavailableButton";
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
  msSinceJourneyLoss,
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
import { departureNow } from "./spacecraft/transEarthInjection";
import { earthEntryNow } from "./spacecraft/splashdown";
import { useMissionView } from "./useMissionView";
import { usePlayback } from "./usePlayback";
import { usePlaybackShortcuts } from "./usePlaybackShortcuts";
import { muteKeyName, pauseKeyName, speedKey } from "./playbackShortcuts";
import { useSounds } from "./useSounds";
import { useSteadyCamera } from "./useSteadyCamera";
import { transferBurnNow } from "./spacecraft/transferBurn";
import { marsCaptureNow } from "./marsOrbit/capture";
import { launchNow } from "./launch/launch";

const MissionScene = lazy(() => import("./MissionScene"));

/** The icon beside each speed: faster ones with more arrows, and a lightning bolt for the fastest. */
const speedIcons: Record<(typeof speeds)[number], IconName> = {
  1: "play",
  5: "fast-forward",
  10: "chevrons-right",
  20: "zap",
};

/** Why the controls that move the Turn on can't be used while it is held at a Decision Point. */
const answerFirst = "Play is held at the Decision Point until you answer it.";

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
  const [sceneReady, setSceneReady] = useState(false);
  const [steadyCamera, toggleSteadyCamera] = useSteadyCamera();
  const playbackReady =
    sceneReady || (timeline.mission === null && !timeline.journeyHome);
  const { state, setSpeed, pause, resume, skipToDecision, dismissScene } =
    usePlayback(timeline, initialSpeed, onSpeedChange, playbackReady);

  const deciding = decisionPoint !== null && atDecisionPoint(state, timeline);
  const { muted, setMuted } = useSounds(timeline.entries, state, deciding);

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
  const departure = departureNow(homeward, inSpace);
  const earthEntry = earthEntryNow(homeward, inSpace);
  const burn = transferBurnNow(timeline.entries, state, deciding);
  const spacecraftAvailable =
    burn !== null ||
    spacecraftHasSomethingToShow(timeline, state) ||
    inSpace !== null;
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
    (entryIndex) => {
      const entry = timeline.entries[entryIndex];
      return (
        (refuelling?.tankerLaunch.entryIndex === entryIndex &&
          state.activeScene !== entryIndex) ||
        ((entry?.kind === "missionEvent" || entry?.kind === "decisionPoint") &&
          entry.eventId === "mars-transfer-burn" &&
          state.activeScene !== entryIndex &&
          !deciding) ||
        (entry?.kind === "missionEvent" &&
          entry.returningToEarth === true &&
          state.activeScene !== entryIndex) ||
        rendezvousHasPlayed(refuelling, state, entryIndex) ||
        homewardQuiet(homeward, state, entryIndex)
      );
    },
    homeward?.siteName ?? null,
  );
  /** Why each view's button can't be used, while its view has nothing to show. */
  const unavailable: Partial<Record<MissionViewId, string>> = {
    ...(site === null ? { surface: surfaceUnavailableReason } : {}),
    ...(spacecraftAvailable ? {} : { spacecraft: spacecraftUnavailableReason }),
  };

  useEffect(() => {
    if (state.finished) onFinished();
  }, [state.finished, onFinished]);

  const launch =
    !deciding && view === "solarSystem" ? launchNow(timeline, state) : null;
  usePlaybackShortcuts({
    paused: state.paused,
    deciding,
    pause,
    resume,
    setSpeed,
    toggleMute: () => {
      setMuted(!muted);
    },
  });
  const turnProgress = (state.day / timeline.durationDays) * 100;

  const operatingAssets = assetsOperatingOn(timeline, state.day);
  // The surface view lists its Landing Site's Assets, so the rest of the box leaves them out, to name each once.
  const shownSite = view === "surface" ? site : null;
  const elsewhere = assetsOperatingOn(timeline, state.day, shownSite);
  const journey = describeJourney(timeline, state.day, shownSite);

  return (
    <main className="mission">
      <Suspense fallback={null}>
        <MissionScene
          onFirstFrame={
            playbackReady
              ? null
              : () => {
                  setSceneReady(true);
                }
          }
          launch={launch}
          steadyCamera={steadyCamera}
          timeline={timeline}
          day={state.day}
          view={view}
          site={site}
          sequence={sequence}
          capture={marsCaptureNow(timeline, state, view)}
          ascent={ascent}
          particles={particles}
          playedSeconds={state.playedMs / 1000}
          lossSeconds={(msSinceJourneyLoss(timeline, state) ?? 0) / 1000}
          burn={burn}
          earthOrbit={earthOrbit}
          marsRendezvous={marsRendezvous}
          departure={departure}
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
              <UnavailableButton
                key={id}
                aria-pressed={view === id}
                unavailable={unavailable[id]}
                onClick={() => {
                  chooseView(id);
                  if (launch) dismissScene();
                  setSceneReady(true);
                }}
              >
                {name}
              </UnavailableButton>
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
              aria-keyshortcuts={pauseKeyName}
              title={`Pause. Shortcut: ${pauseKeyName}, which also plays on`}
              onClick={pause}
            >
              <Icon name="pause" />
              <span className="visually-hidden">Pause</span>
            </button>
            {/* Held at a Decision Point, a speed can't move play on, so each says so rather than seeming to work. */}
            {speeds.map((speed) => (
              <UnavailableButton
                key={speed}
                aria-pressed={
                  !state.paused && !deciding && state.speed === speed
                }
                aria-keyshortcuts={speedKey(speed)}
                title={`Play at ${speed}x. Shortcut: ${speedKey(speed)}`}
                unavailable={deciding ? answerFirst : undefined}
                onClick={() => {
                  setSpeed(speed);
                }}
              >
                <Icon name={speedIcons[speed]} />
                {speed}x
              </UnavailableButton>
            ))}
          </div>
          <button
            type="button"
            className="mute"
            aria-pressed={muted}
            aria-keyshortcuts={muteKeyName}
            title={`Mute sound. Shortcut: ${muteKeyName}`}
            onClick={() => {
              setMuted(!muted);
            }}
          >
            <Icon name={muted ? "volume-x" : "volume-2"} />
            <span className="visually-hidden">Mute sound</span>
          </button>
        </div>
        {/* A secondary button named for where it goes, as watching the Turn play is the primary action. */}
        <UnavailableButton
          className="skip-turn"
          title={
            decisionPoint
              ? "Skip to the next Decision Point, which you must answer."
              : "Skip to the Turn summary. The rest of the Turn still happens, and the summary lists its Mission Events."
          }
          unavailable={deciding ? answerFirst : undefined}
          onClick={decisionPoint ? skipToDecision : onFinished}
        >
          {decisionPoint ? "Skip to Decision Point" : "Skip to Turn summary"}
        </UnavailableButton>
        <progress
          aria-label="Progress through the Turn"
          max={100}
          value={turnProgress}
        />
      </header>
      <aside className="mission-side" data-testid="mission-info">
        {state.activeScene !== null && (
          <button
            type="button"
            onClick={() => {
              dismissScene();
              setSceneReady(true);
            }}
          >
            {launch ? "Skip launch scene" : "Skip scene"}
          </button>
        )}
        <button
          type="button"
          aria-pressed={steadyCamera}
          onClick={toggleSteadyCamera}
        >
          Steady camera
        </button>
        {journey !== null && (
          <p data-testid="journey-progress">
            <GameText>{journey}</GameText>
          </p>
        )}
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
          burn={burn}
          earthOrbit={earthOrbit}
          marsRendezvous={marsRendezvous}
          departure={departure}
          earthEntry={earthEntry}
        />
        {/* Shown only while it has something to list, rather than an empty heading. */}
        {elsewhere.length > 0 && (
          <>
            <h2 className="subheading">
              {shownSite === null ? "Operating at Mars" : "Elsewhere at Mars"}
            </h2>
            <ul data-testid="operating-at-mars">
              {elsewhere.map((asset, index) => (
                <li key={index}>
                  <GameText>{asset}</GameText>
                </li>
              ))}
            </ul>
          </>
        )}
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
        activeScene={state.activeScene}
        deciding={deciding}
      />
    </main>
  );
}
