import { useRef, useState } from "react";
import {
  type Program,
  type ProgramView,
  type Simulation,
  type TurnPlan,
} from "../simulation/simulation";
import { Dialog } from "../ui/Dialog";
import { GameText } from "../ui/GameText";
import { BudgetBar } from "./BudgetBar";
import { LandingSiteChoice } from "./LandingSiteChoice";
import { MissionAssets } from "./MissionAssets";
import { MissionCrew } from "./MissionCrew";
import { MissionEventChoices } from "./MissionEventChoices";
import { MissionLaunchChoice } from "./MissionLaunchChoice";
import { fitOfAdding } from "./missionFit";
import { MissionStepCard } from "./MissionStepCard";
import { ReturnVehicleChoice } from "./ReturnVehicleChoice";
import { ScrollCue } from "./ScrollCue";
import { launchSummary, missionSteps } from "./missionSteps";
import type { MissionPlan } from "./useMissionPlan";

/** The last Turn on which the hint to tick an Asset or Crew shows: a new player's first couple of Turns. */
const lastHintedTurn = 2;

interface MissionPanelProps {
  simulation: Simulation;
  program: Program;
  view: ProgramView;
  /** The choices made for the Mission and the plans they make, which Planning Mode keeps so its status bar can show the spend. */
  choices: MissionPlan;
  onSubmit: (plan: TurnPlan) => void;
}

/**
 * Everything the player chooses for this Turn's Mission, as numbered steps, and the budget bar with the buttons that end
 * the Turn. The steps scroll by themselves when they don't fit, under the budget bar, which stays in view, with a cue
 * over their foot while more steps are below, as the thin scrollbar alone tells a new player nothing. The choices and
 * the plan they make come from `useMissionPlan`, and each part of the panel has its own component.
 */
export function MissionPanel({
  simulation,
  program,
  view,
  choices,
  onSubmit,
}: MissionPanelProps) {
  const { plan, withoutLaunching, withoutLaunchingProblems, landingSite } =
    choices;
  const {
    costMillions,
    developmentCostMillions,
    upkeepMillions,
    massTonnes,
    capacityTonnes,
    problems,
  } = choices.check;
  const { nothingTicked } = choices;
  const fetchable = view.crew.filter(
    ({ withoutWayHome }) => withoutWayHome.length > 0,
  );
  // What is ticked, as one key: the Launch Vehicle step folds once anything is, and opens on Change until the next
  // tick or untick, so the key the player pressed Change for is kept rather than a flag.
  const tickedKey = [
    choices.assetIds.toSorted().join(","),
    choices.plannedCrew?.size ?? 0,
    choices.returnVehicleFor ?? "",
  ].join("|");
  const [changingFor, setChangingFor] = useState<string | null>(null);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [launchStep, assetsStep, landingStep, eventsStep] = missionSteps({
    nothingTicked,
    landsOnMars: choices.landsOnMars,
    launch: {
      summary: launchSummary(
        view.launchVehicles.find(({ id }) => id === choices.launchVehicleId),
        choices.trajectory,
      ),
      changing: changingFor === tickedKey,
    },
  });
  const steps = useRef<HTMLDivElement>(null);

  return (
    <section className="panel mission-panel">
      <h2>
        <GameText heading>New Mission</GameText>
      </h2>
      <div className="mission-steps" data-testid="mission-steps" ref={steps}>
        {launchStep && (
          <MissionStepCard
            step={launchStep}
            onChange={() => {
              setChangingFor(tickedKey);
            }}
          >
            <MissionLaunchChoice
              launchVehicles={view.launchVehicles}
              launchVehicleId={choices.launchVehicleId}
              onLaunchVehicleChange={choices.chooseLaunchVehicle}
              trajectories={choices.trajectories}
              trajectory={choices.trajectory}
              onTrajectoryChange={choices.chooseTrajectory}
            />
          </MissionStepCard>
        )}
        {assetsStep && (
          <MissionStepCard step={assetsStep}>
            <MissionAssets
              view={view}
              assetIds={choices.assetIds}
              plannedAssets={choices.plannedAssets}
              fitOf={(addition) =>
                fitOfAdding(
                  simulation,
                  program,
                  plan,
                  view.moneyMillions,
                  addition,
                )
              }
              onCarriedChange={choices.setCarried}
              onChoicesChange={choices.changeAssetChoices}
              previewOf={choices.previewOf}
            >
              <MissionCrew
                crewedMission={view.crewedMission}
                planned={choices.plannedCrew}
                fit={
                  view.crewedMission.sizes[0]
                    ? fitOfAdding(
                        simulation,
                        program,
                        plan,
                        view.moneyMillions,
                        {
                          crewSize: view.crewedMission.sizes[0].crew,
                        },
                      )
                    : { overCapacity: false, overMoney: false }
                }
                onCrewSizeChange={choices.chooseCrewSize}
                onActivityChange={choices.chooseCrewActivity}
                lands={choices.crewLands}
                onLandsChange={choices.chooseCrewLands}
                onSuppliesChange={choices.chooseCrewSupplies}
                onProtectionChange={choices.chooseCrewProtection}
                roundTrip={choices.crewRoundTrip}
                onRoundTripChange={choices.chooseCrewRoundTrip}
              />
              <ReturnVehicleChoice
                returnVehicle={view.crewedMission.returnVehicle}
                places={fetchable}
                forCrewAt={choices.returnVehicleFor}
                fit={
                  fetchable[0]
                    ? fitOfAdding(
                        simulation,
                        program,
                        plan,
                        view.moneyMillions,
                        {
                          returnVehicleFor: fetchable[0].key,
                        },
                      )
                    : { overCapacity: false, overMoney: false }
                }
                onChange={choices.chooseReturnVehicleFor}
              />
            </MissionAssets>
          </MissionStepCard>
        )}
        {landingStep && (
          <MissionStepCard step={landingStep}>
            {landingSite && (
              <LandingSiteChoice
                landingSites={view.landingSites}
                landingSite={landingSite}
                onLandingSiteChange={choices.chooseLandingSite}
              />
            )}
          </MissionStepCard>
        )}
        {eventsStep && (
          <MissionStepCard step={eventsStep}>
            <MissionEventChoices
              plannedEvents={choices.plannedEvents}
              plannedAssets={choices.plannedAssets}
              onReliabilityChange={choices.chooseReliability}
              onAssetReliabilityChange={(assetId, reliabilityLevelId) => {
                choices.changeAssetChoices(assetId, { reliabilityLevelId });
              }}
              onContingencyChange={choices.setContingencyBought}
            />
          </MissionStepCard>
        )}
      </div>
      <ScrollCue scroller={steps}>More steps below</ScrollCue>
      <BudgetBar
        costMillions={costMillions}
        developmentCostMillions={developmentCostMillions}
        upkeepMillions={upkeepMillions}
        moneyMillions={view.moneyMillions}
        massTonnes={massTonnes}
        capacityTonnes={capacityTonnes}
        launchProblems={problems}
        withoutLaunchingProblems={withoutLaunchingProblems}
        onLaunch={() => {
          onSubmit(plan);
        }}
        onEndWithoutLaunching={() => {
          // A planned Mission would be dropped, which a mis-click shouldn't do unasked.
          if (nothingTicked) onSubmit(withoutLaunching);
          else setConfirmingEnd(true);
        }}
      >
        {/* A hint for a new player, which a Program's later Turns no longer need. */}
        {nothingTicked && view.turnNumber <= lastHintedTurn && (
          <p data-testid="nothing-ticked">
            <GameText>
              Tick an Asset or Crew to plan a Mission, or end the Turn without
              launching.
            </GameText>
          </p>
        )}
        {/* With nothing ticked, only ending without launching is possible, so only its problems matter. */}
        {(nothingTicked ? withoutLaunchingProblems : problems).map(
          (problem) => (
            <p key={problem} className="problem" role="alert">
              <GameText>{problem}</GameText>
            </p>
          ),
        )}
      </BudgetBar>
      {confirmingEnd && (
        <Dialog
          title="End Turn without launching"
          cancelLabel="Keep planning"
          onClose={() => {
            setConfirmingEnd(false);
          }}
          actions={
            <button
              type="button"
              className="primary"
              onClick={() => {
                onSubmit(withoutLaunching);
              }}
            >
              End Turn
            </button>
          }
        >
          <p>
            <GameText>
              End the Turn without launching? The Mission you planned is
              dropped.
            </GameText>
          </p>
        </Dialog>
      )}
    </section>
  );
}
