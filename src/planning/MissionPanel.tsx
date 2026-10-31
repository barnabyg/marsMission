import { useState } from "react";
import {
  formatMoney,
  type AssetChoices,
  type PlannedAsset,
  type Program,
  type ProgramView,
  type Simulation,
  type TurnPlan,
} from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { ActivitySelect } from "./ActivitySelect";

interface MissionPanelProps {
  simulation: Simulation;
  program: Program;
  view: ProgramView;
  /** The new Activities chosen for Assets already operating, which either button sends. */
  operatingActivities: Record<string, string>;
  onSubmit: (plan: TurnPlan) => void;
}

/** Everything the player chooses for this Turn's Mission, and the buttons that end the Turn. */
export function MissionPanel({
  simulation,
  program,
  view,
  operatingActivities,
  onSubmit,
}: MissionPanelProps) {
  const [launchVehicleId, setLaunchVehicleId] = useState(
    view.launchVehicles[0]?.id ?? "",
  );
  const [assetIds, setAssetIds] = useState(
    view.assets.slice(0, 1).map((asset) => asset.id),
  );
  const [reliability, setReliability] = useState<Record<string, string>>({});
  const [chosenSiteId, setChosenSiteId] = useState(
    view.landingSites[0]?.id ?? "",
  );
  const [assetChoices, setAssetChoices] = useState<
    Record<string, AssetChoices>
  >({});

  const carriesLander = view.assets.some(
    (asset) => assetIds.includes(asset.id) && asset.landsAtSite,
  );
  const landingSite = carriesLander
    ? view.landingSites.find((site) => site.id === chosenSiteId)
    : undefined;
  const mission = {
    launchVehicleId,
    assetIds,
    ...(landingSite && { landingSiteId: landingSite.id }),
  };
  const plannedEvents = simulation.previewMission(program, {
    ...mission,
    reliability,
  });
  const plannedAssets = simulation.previewAssets({
    ...mission,
    assetChoices,
  });
  const plan: TurnPlan = {
    operatingActivities,
    mission: {
      ...mission,
      // Only the Mission Events this Mission goes through, because a choice can outlive a change of Asset.
      reliability: Object.fromEntries(
        plannedEvents.map((event) => [event.eventId, event.reliabilityLevelId]),
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
  const { costMillions, massTonnes, capacityTonnes, problems } =
    simulation.validatePlan(program, plan);

  return (
    <section className="panel">
      <h2>
        <GameText>Mission</GameText>
      </h2>
      <label>
        <span>
          <GameText>Launch Vehicle</GameText>
        </span>
        <select
          value={launchVehicleId}
          onChange={(event) => {
            setLaunchVehicleId(event.target.value);
          }}
        >
          {view.launchVehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.name} ({formatMoney(vehicle.costMillions)},{" "}
              {vehicle.capacityTonnes} t)
            </option>
          ))}
        </select>
      </label>
      <fieldset className="asset-choices">
        <legend>
          <GameText>Assets</GameText>
        </legend>
        {view.assets.map((asset) => (
          <MissionAssetChoice
            key={asset.id}
            asset={asset}
            planned={plannedAssets.find(({ assetId }) => assetId === asset.id)}
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
        <GameText>Mission Events, Risk Bands and Reliability</GameText>
      </h3>
      <ol className="mission-events" data-testid="mission-events">
        {plannedEvents.map((event) => (
          <li key={event.eventId} data-testid="mission-event">
            <span className="mission-event-name">{event.name}</span>
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
          </li>
        ))}
      </ol>
      <p className="total-cost">
        Total cost:{" "}
        <strong data-testid="mission-cost">{formatMoney(costMillions)}</strong>
        {" · "}Mass:{" "}
        <strong data-testid="mission-mass">
          {massTonnes} of {capacityTonnes} tonnes
        </strong>
      </p>
      {problems.map((problem) => (
        <p key={problem} className="problem" role="alert">
          <GameText>{problem}</GameText>
        </p>
      ))}
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
        onClick={() => {
          onSubmit({ mission: null, operatingActivities });
        }}
      >
        End Turn without launching
      </button>
    </section>
  );
}

interface MissionAssetChoiceProps {
  asset: ProgramView["assets"][number];
  /** The choices for this Asset, which only an Asset on the Mission has. */
  planned: PlannedAsset | undefined;
  carried: boolean;
  onCarriedChange: (carried: boolean) => void;
  onChoicesChange: (choices: AssetChoices) => void;
}

/** One Asset the Mission can carry and, if it does, the choices for that Asset. */
function MissionAssetChoice({
  asset,
  planned,
  carried,
  onCarriedChange,
  onChoicesChange,
}: MissionAssetChoiceProps) {
  return (
    <div className="asset-choice">
      <label>
        <input
          type="checkbox"
          checked={carried}
          onChange={(event) => {
            onCarriedChange(event.target.checked);
          }}
        />
        {asset.name} ({formatMoney(asset.costMillions)}, {asset.massTonnes} t)
      </label>
      {planned && (
        <>
          <span>
            <GameText>Activity</GameText>
          </span>
          <ActivitySelect
            assetName={asset.name}
            activityId={planned.activityId}
            activities={planned.activities}
            onChange={(activityId) => {
              onChoicesChange({ activityId });
            }}
          />
          <span>
            <GameText>Service Life</GameText>
          </span>
          <select
            aria-label={`Service Life for ${asset.name}`}
            value={planned.serviceLifeDays}
            onChange={(event) => {
              onChoicesChange({ serviceLifeDays: Number(event.target.value) });
            }}
          >
            {planned.serviceLifeOptions.map((option) => (
              <option key={option.days} value={option.days}>
                {option.days} days ({formatMoney(option.costMillions)})
              </option>
            ))}
          </select>
          <span>
            <GameText>Reliability</GameText>
          </span>
          <select
            aria-label={`Reliability for ${asset.name} in service`}
            value={planned.reliabilityLevelId}
            onChange={(event) => {
              onChoicesChange({ reliabilityLevelId: event.target.value });
            }}
          >
            {planned.reliabilityLevels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name} ({formatMoney(level.costMillions)},{" "}
                {level.riskBand})
              </option>
            ))}
          </select>
          <strong data-testid="asset-risk-band">
            <GameText>{`${planned.riskBand} per Turn`}</GameText>
          </strong>
        </>
      )}
    </div>
  );
}
