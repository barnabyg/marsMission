import {
  formatMoney,
  type Program,
  type ProgramView,
  type Simulation,
  type TurnPlan,
} from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { LandingSiteChoice } from "./LandingSiteChoice";
import { MissionAssets } from "./MissionAssets";
import { MissionEventChoices } from "./MissionEventChoices";
import { MissionLaunchChoice } from "./MissionLaunchChoice";
import { useMissionPlan } from "./useMissionPlan";

interface MissionPanelProps {
  simulation: Simulation;
  program: Program;
  view: ProgramView;
  /** The new Activities chosen for Assets already operating, which either button sends. */
  operatingActivities: Record<string, string>;
  /** The Developments chosen to start this Turn, which either button sends. */
  developmentIds: string[];
  onSubmit: (plan: TurnPlan) => void;
}

/**
 * Everything the player chooses for this Turn's Mission, and the buttons that end the Turn. The choices and the plan
 * they make are in `useMissionPlan`, and each part of the panel has its own component.
 */
export function MissionPanel({
  simulation,
  program,
  view,
  operatingActivities,
  developmentIds,
  onSubmit,
}: MissionPanelProps) {
  const choices = useMissionPlan(
    simulation,
    program,
    view,
    operatingActivities,
    developmentIds,
  );
  const { plan, withoutLaunching, withoutLaunchingProblems, landingSite } =
    choices;
  const {
    costMillions,
    developmentCostMillions,
    massTonnes,
    capacityTonnes,
    problems,
  } = choices.check;
  const canEndWithoutLaunching = withoutLaunchingProblems.length === 0;
  const nothingTicked = choices.assetIds.length === 0;

  return (
    <section className="panel">
      <h2>
        <GameText>New Mission</GameText>
      </h2>
      <MissionLaunchChoice
        launchVehicles={view.launchVehicles}
        launchVehicleId={choices.launchVehicleId}
        onLaunchVehicleChange={choices.chooseLaunchVehicle}
        trajectories={choices.trajectories}
        trajectory={choices.trajectory}
        onTrajectoryChange={choices.chooseTrajectory}
      />
      <MissionAssets
        view={view}
        assetIds={choices.assetIds}
        plannedAssets={choices.plannedAssets}
        onCarriedChange={choices.setCarried}
        onChoicesChange={choices.changeAssetChoices}
      />
      {landingSite && (
        <LandingSiteChoice
          landingSites={view.landingSites}
          landingSite={landingSite}
          onLandingSiteChange={choices.chooseLandingSite}
        />
      )}
      <MissionEventChoices
        plannedEvents={choices.plannedEvents}
        onReliabilityChange={choices.chooseReliability}
        onContingencyChange={choices.setContingencyBought}
      />
      <p className="total-cost">
        <GameText>Mission cost</GameText>:{" "}
        <strong data-testid="mission-cost">{formatMoney(costMillions)}</strong>
        {" · "}Mass:{" "}
        <strong data-testid="mission-mass">
          {massTonnes} of {capacityTonnes} tonnes
        </strong>
        {developmentCostMillions > 0 && (
          <>
            {" · "}
            <GameText>Development</GameText>:{" "}
            <strong data-testid="development-cost">
              {formatMoney(developmentCostMillions)}
            </strong>
          </>
        )}
      </p>
      {nothingTicked && (
        <p data-testid="nothing-ticked">
          <GameText>
            Tick an Asset to plan a Mission, or end the Turn without launching.
          </GameText>
        </p>
      )}
      {/* With nothing ticked, only ending without launching is possible, so only its problems matter. */}
      {(nothingTicked ? withoutLaunchingProblems : problems).map((problem) => (
        <p key={problem} className="problem" role="alert">
          <GameText>{problem}</GameText>
        </p>
      ))}
      <div className="mission-buttons">
        <button
          type="button"
          className="primary"
          disabled={problems.length > 0}
          onClick={() => {
            onSubmit(plan);
          }}
        >
          Launch Mission
        </button>
        <button
          type="button"
          disabled={!canEndWithoutLaunching}
          onClick={() => {
            onSubmit(withoutLaunching);
          }}
        >
          End Turn without launching
        </button>
      </div>
    </section>
  );
}
