import {
  canFly,
  formatMoney,
  type PlannedTrajectory,
  type ProgramView,
} from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { readinessLabel, ReadinessTag } from "./ReadinessTag";

interface MissionLaunchChoiceProps {
  launchVehicles: ProgramView["launchVehicles"];
  launchVehicleId: string;
  onLaunchVehicleChange: (launchVehicleId: string) => void;
  trajectories: PlannedTrajectory[];
  trajectory: PlannedTrajectory | undefined;
  onTrajectoryChange: (trajectoryId: string) => void;
}

/** The Mission's Launch Vehicle and its Trajectory to Mars. */
export function MissionLaunchChoice({
  launchVehicles,
  launchVehicleId,
  onLaunchVehicleChange,
  trajectories,
  trajectory,
  onTrajectoryChange,
}: MissionLaunchChoiceProps) {
  const vehicle = launchVehicles.find(({ id }) => id === launchVehicleId);
  return (
    <div className="mission-launch">
      <label>
        <span>
          <GameText>{vehicle ? "Launch Vehicle:" : "Launch Vehicle"}</GameText>
          {vehicle && (
            <>
              {" "}
              <ReadinessTag
                readiness={vehicle.technologyReadiness}
                testId="launch-vehicle-readiness"
              />
            </>
          )}
        </span>
        <select
          value={launchVehicleId}
          onChange={(event) => {
            onLaunchVehicleChange(event.target.value);
          }}
        >
          {launchVehicles.map((option) => (
            <option
              key={option.id}
              value={option.id}
              disabled={!canFly(option)}
            >
              {option.name} ({formatMoney(option.costMillions)},{" "}
              {option.capacityTonnes} t
              {option.technologyReadiness === "flight-proven"
                ? ""
                : `, ${readinessLabel(option.technologyReadiness)}`}
              )
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>
          <GameText>Trajectory</GameText>
        </span>
        <select
          value={trajectory?.id}
          onChange={(event) => {
            onTrajectoryChange(event.target.value);
          }}
        >
          {trajectories.map((option) => (
            <option key={option.id} value={option.id}>
              {describeTrajectory(option)}
            </option>
          ))}
        </select>
      </label>
      {trajectory && (
        <p data-testid="trajectory-details">
          <span className="choice-facts" data-testid="trajectory-facts">
            {trajectoryFacts(trajectory)}
          </span>{" "}
          <GameText>{trajectory.description}</GameText>
        </p>
      )}
    </div>
  );
}

/** A Trajectory as its choice names it: its name and, if it costs anything, its cost, as in "Fast ($40M)". */
function describeTrajectory({ name, costMillions }: PlannedTrajectory): string {
  return costMillions > 0 ? `${name} (${formatMoney(costMillions)})` : name;
}

/** What the chosen Trajectory takes, written once beside its choice: "150 days to Mars · 0.5 t less capacity". */
function trajectoryFacts({
  transferDays,
  capacityLossTonnes,
}: PlannedTrajectory): string {
  return [
    `${transferDays} days to Mars`,
    ...(capacityLossTonnes > 0
      ? [`${capacityLossTonnes} t less capacity`]
      : []),
  ].join(" · ");
}
