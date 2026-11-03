import { useState } from "react";
import {
  canFly,
  formatMoney,
  type AssetChoices,
  type PlannedTrajectory,
  type Program,
  type ProgramView,
  type Simulation,
  type TurnPlan,
} from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { MissionAssetChoice } from "./MissionAssetChoice";
import { readinessLabel, ReadinessTag } from "./ReadinessTag";
import {
  isSurveying,
  NothingLeftToSurvey,
  ResearchEarnings,
} from "./ResearchEarnings";

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

/** Everything the player chooses for this Turn's Mission, and the buttons that end the Turn. */
export function MissionPanel({
  simulation,
  program,
  view,
  operatingActivities,
  developmentIds,
  onSubmit,
}: MissionPanelProps) {
  // It starts on the first that can fly, because one that needs Development can't be chosen.
  const [launchVehicleId, setLaunchVehicleId] = useState(
    view.launchVehicles.find(canFly)?.id ?? "",
  );
  // None start ticked, so that one already at Mars never looks as if it has to be launched again.
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [reliability, setReliability] = useState<Record<string, string>>({});
  const [chosenSiteId, setChosenSiteId] = useState(
    view.landingSites[0]?.id ?? "",
  );
  const [assetChoices, setAssetChoices] = useState<
    Record<string, AssetChoices>
  >({});
  const [contingencyIds, setContingencyIds] = useState<string[]>([]);
  const [trajectoryId, setTrajectoryId] = useState<string | undefined>();

  const landsOnMars = view.assets.some(
    (asset) => assetIds.includes(asset.id) && asset.landsAtSite,
  );
  const landingSite = landsOnMars
    ? view.landingSites.find((site) => site.id === chosenSiteId)
    : undefined;
  const mission = {
    launchVehicleId,
    assetIds,
    ...(landingSite && { landingSiteId: landingSite.id }),
    // A choice can outlive a change of Asset that takes it off the list.
    ...(trajectoryId !== undefined &&
      simulation
        .previewTrajectories({ launchVehicleId, assetIds })
        .some(({ id }) => id === trajectoryId) && { trajectoryId }),
  };
  const vehicle = view.launchVehicles.find(({ id }) => id === launchVehicleId);
  const trajectories = simulation.previewTrajectories(mission);
  const trajectory = trajectories.find(({ chosen }) => chosen);
  const plannedEvents = simulation.previewMission(program, {
    ...mission,
    reliability,
    contingencyIds,
  });
  const plannedAssets = simulation.previewAssets(program, {
    ...mission,
    assetChoices,
  });
  const plan: TurnPlan = {
    operatingActivities,
    developmentIds,
    mission: {
      ...mission,
      // Only the Mission Events this Mission goes through, because a choice can outlive a change of Asset.
      reliability: Object.fromEntries(
        plannedEvents.map((event) => [event.eventId, event.reliabilityLevelId]),
      ),
      // Only those for the Mission Events it goes through, for the same reason.
      contingencyIds: plannedEvents.flatMap(({ contingency }) =>
        contingency?.bought ? [contingency.id] : [],
      ),
      // Only the Assets this Mission carries, for the same reason.
      assetChoices: Object.fromEntries(
        plannedAssets.map((asset) => [
          asset.assetId,
          {
            serviceLifeDays: asset.serviceLifeDays,
            reliabilityLevelId: asset.reliabilityLevelId,
            activityId: asset.activityId,
          },
        ]),
      ),
    },
  };
  const {
    costMillions,
    developmentCostMillions,
    massTonnes,
    capacityTonnes,
    problems,
  } = simulation.validatePlan(program, plan);
  const withoutLaunching: TurnPlan = {
    mission: null,
    operatingActivities,
    developmentIds,
  };
  const withoutLaunchingProblems = simulation.validatePlan(
    program,
    withoutLaunching,
  ).problems;
  const canEndWithoutLaunching = withoutLaunchingProblems.length === 0;
  const nothingTicked = assetIds.length === 0;

  return (
    <section className="panel">
      <h2>
        <GameText>New Mission</GameText>
      </h2>
      <div className="mission-launch">
        <label>
          <span>
            <GameText>
              {vehicle ? "Launch Vehicle:" : "Launch Vehicle"}
            </GameText>
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
              setLaunchVehicleId(event.target.value);
            }}
          >
            {view.launchVehicles.map((option) => (
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
              setTrajectoryId(event.target.value);
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
            <GameText>{trajectory.description}</GameText>
          </p>
        )}
      </div>
      <fieldset className="asset-choices">
        <legend>
          <GameText>Assets</GameText>
        </legend>
        {view.assets.map((asset) => (
          <MissionAssetChoice
            key={asset.id}
            asset={asset}
            planned={plannedAssets.find(({ assetId }) => assetId === asset.id)}
            operatingCount={
              view.operatingAssets.filter(
                ({ assetId, daysLeft }) => assetId === asset.id && daysLeft > 0,
              ).length
            }
            carried={assetIds.includes(asset.id)}
            onCarriedChange={(carried) => {
              setAssetIds(
                carried
                  ? [...assetIds, asset.id]
                  : assetIds.filter((id) => id !== asset.id),
              );
            }}
            onChoicesChange={(choices) => {
              setAssetChoices({
                ...assetChoices,
                [asset.id]: { ...assetChoices[asset.id], ...choices },
              });
            }}
          />
        ))}
      </fieldset>
      <ResearchEarnings
        activities={plannedAssets.flatMap(({ activities }) => activities)}
      />
      {!view.somethingLeftToSurvey &&
        plannedAssets.some(({ activityId, activities }) =>
          isSurveying(activityId, activities),
        ) && <NothingLeftToSurvey />}
      {landingSite && (
        <>
          <label>
            <span>
              <GameText>Landing Site</GameText>
            </span>
            <select
              value={landingSite.id}
              onChange={(event) => {
                setChosenSiteId(event.target.value);
              }}
            >
              {view.landingSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} ({site.surveyed ? "surveyed, " : ""}
                  {site.riskBand})
                </option>
              ))}
            </select>
          </label>
          <p data-testid="landing-site-details">
            <GameText>
              {`${landingSite.surveyed ? "Surveyed. " : "Not surveyed. "}${landingSite.description} ${
                landingSite.landed
                  ? "Already landed at, so landing again earns no Science."
                  : `The first landing here earns ${landingSite.science} Science.`
              }`}
            </GameText>
          </p>
        </>
      )}
      <h3>
        <GameText>
          Mission Events, Risk Bands, Reliability and Contingency
        </GameText>
      </h3>
      <ol className="mission-events" data-testid="mission-events">
        {plannedEvents.map((event) => (
          <li key={event.eventId} data-testid="mission-event">
            <span className="mission-event-name">
              <GameText>{event.name}</GameText>
            </span>
            <strong className="risk-band" data-testid="risk-band">
              {event.riskBand}
            </strong>
            <select
              aria-label={`Reliability for ${event.name}`}
              value={event.reliabilityLevelId}
              onChange={(change) => {
                setReliability({
                  ...reliability,
                  [event.eventId]: change.target.value,
                });
              }}
            >
              {event.reliabilityLevels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name} ({formatMoney(level.costMillions)},{" "}
                  {level.riskBand})
                </option>
              ))}
            </select>
            {event.contingency && (
              <label
                className="contingency-choice"
                title={event.contingency.description}
              >
                <input
                  type="checkbox"
                  checked={event.contingency.bought}
                  onChange={(change) => {
                    const { id } = event.contingency ?? {};
                    if (id === undefined) return;
                    setContingencyIds(
                      change.target.checked
                        ? [...contingencyIds, id]
                        : contingencyIds.filter((other) => other !== id),
                    );
                  }}
                />
                <GameText>
                  {`Contingency: ${event.contingency.name} (${formatMoney(event.contingency.costMillions)}, ${event.contingency.massTonnes} t, ${event.contingency.riskBand} if used)`}
                </GameText>
              </label>
            )}
          </li>
        ))}
      </ol>
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

/** What a Trajectory takes and what it costs, for its place in the list. */
function describeTrajectory({
  name,
  transferDays,
  costMillions,
  capacityLossTonnes,
}: PlannedTrajectory): string {
  const costs = [
    `${transferDays} days`,
    ...(costMillions > 0 ? [formatMoney(costMillions)] : []),
    ...(capacityLossTonnes > 0 ? [`${capacityLossTonnes} t less`] : []),
  ];
  return `${name} (${costs.join(", ")})`;
}
