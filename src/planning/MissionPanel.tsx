import {
  type Program,
  type ProgramView,
  type Simulation,
  type TurnPlan,
} from "../simulation/simulation";
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
import { missionSteps } from "./missionSteps";
import type { MissionPlan } from "./useMissionPlan";

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
 * the Turn. The steps scroll by themselves when they don't fit, under the budget bar, which stays in view. The choices and the plan they make
 * come from `useMissionPlan`, and each part of the panel has its own component.
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
  const [launchStep, assetsStep, landingStep, eventsStep] = missionSteps({
    nothingTicked,
    landsOnMars: choices.landsOnMars,
  });

  return (
    <section className="panel mission-panel">
      <h2>
        <GameText heading>New Mission</GameText>
      </h2>
      <div className="mission-steps" data-testid="mission-steps">
        {launchStep && (
          <MissionStepCard step={launchStep}>
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
              crewActivities={choices.plannedCrew?.activities ?? []}
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
          onSubmit(withoutLaunching);
        }}
      >
        {nothingTicked && (
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
    </section>
  );
}
