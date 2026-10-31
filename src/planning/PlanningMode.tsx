import { useState } from "react";
import { SaveSlots } from "../save/SaveSlots";
import type { SaveStore } from "../save/saveStore";
import {
  formatMoney,
  type Program,
  type Simulation,
  type AssetChoices,
  type TurnPlan,
} from "../simulation/simulation";
import { Dialog } from "../ui/Dialog";
import { formatLaunchWindow } from "../ui/format";
import { GameText } from "../ui/GameText";

interface PlanningModeProps {
  simulation: Simulation;
  program: Program;
  /** Whether the automatic save at the start of this Planning Mode worked. */
  saved: boolean;
  saveStore: SaveStore;
  onLoad: (program: Program) => void;
  onSubmit: (plan: TurnPlan) => void;
  onRetire: () => void;
}

type PlanningDialog = "save" | "load" | "retire";

export function PlanningMode({
  simulation,
  program,
  saved,
  saveStore,
  onLoad,
  onSubmit,
  onRetire,
}: PlanningModeProps) {
  const view = simulation.readProgram(program);
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
  const [openDialog, setOpenDialog] = useState<PlanningDialog | null>(null);
  const [savedToSlot, setSavedToSlot] = useState<number | null>(null);

  function open(dialog: PlanningDialog) {
    setSavedToSlot(null);
    setOpenDialog(dialog);
  }

  function close() {
    setOpenDialog(null);
  }

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
  const plannedAssets = simulation.previewAssets(program, {
    ...mission,
    assetChoices,
  });
  const plan: TurnPlan = {
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
          { serviceLifeDays: asset.serviceLifeDays },
        ]),
      ),
    },
  };
  const { costMillions, massTonnes, capacityTonnes, problems } =
    simulation.validatePlan(program, plan);

  return (
    <main className="planning">
      <header className="status-bar">
        <h1>
          <GameText>Planning Mode</GameText>
        </h1>
        <dl>
          <div>
            <dt>
              <GameText>Turn</GameText>
            </dt>
            <dd data-testid="turn-number">{view.turnNumber}</dd>
          </div>
          <div>
            <dt>
              <GameText>Launch Window</GameText>
            </dt>
            <dd data-testid="launch-window">{formatLaunchWindow(view.date)}</dd>
          </div>
          <div>
            <dt>Money</dt>
            <dd data-testid="money">{formatMoney(view.moneyMillions)}</dd>
          </div>
          <div>
            <dt>
              <GameText>Public Support</GameText>
            </dt>
            <dd data-testid="public-support">{view.publicSupport}</dd>
          </div>
          <div>
            <dt>
              <GameText>Next Funding Threshold</GameText>
            </dt>
            <dd data-testid="next-funding-threshold">
              {view.nextFundingThreshold
                ? `${formatMoney(view.nextFundingThreshold.payoutMillions)} at ${view.nextFundingThreshold.publicSupport} (${view.nextFundingThreshold.pointsAway} away)`
                : "None left"}
            </dd>
          </div>
          <div>
            <dt>
              <GameText>Cancellation Level</GameText>
            </dt>
            <dd>{view.cancellationLevel}</dd>
          </div>
          <div>
            <dt>
              <GameText>Science</GameText>
            </dt>
            <dd data-testid="science">{view.science}</dd>
          </div>
        </dl>
      </header>

      <div className="program-actions">
        <button
          type="button"
          onClick={() => {
            open("save");
          }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            open("load");
          }}
        >
          Load
        </button>
        <button
          type="button"
          onClick={() => {
            open("retire");
          }}
        >
          Retire Program
        </button>
        {savedToSlot !== null && (
          <p role="status">
            <GameText>{`Saved to Save Slot ${savedToSlot}.`}</GameText>
          </p>
        )}
      </div>

      {!saved && (
        <p className="problem" role="alert">
          <GameText>
            The browser wouldn't store the automatic save, so this Program may
            be lost if you close the game.
          </GameText>
        </p>
      )}

      <div className="planning-columns">
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
            {view.assets.map((asset) => {
              const planned = plannedAssets.find(
                ({ assetId }) => assetId === asset.id,
              );
              return (
                <div key={asset.id} className="asset-choice">
                  <label>
                    <input
                      type="checkbox"
                      checked={assetIds.includes(asset.id)}
                      onChange={(event) => {
                        setAssetIds(
                          event.target.checked
                            ? [...assetIds, asset.id]
                            : assetIds.filter((id) => id !== asset.id),
                        );
                      }}
                    />
                    {asset.name} ({formatMoney(asset.costMillions)},{" "}
                    {asset.massTonnes} t)
                  </label>
                  {planned && (
                    <>
                      <span>
                        <GameText>Service Life</GameText>
                      </span>
                      <select
                        aria-label={`Service Life for ${asset.name}`}
                        value={planned.serviceLifeDays}
                        onChange={(event) => {
                          setAssetChoices({
                            ...assetChoices,
                            [asset.id]: {
                              ...assetChoices[asset.id],
                              serviceLifeDays: Number(event.target.value),
                            },
                          });
                        }}
                      >
                        {planned.serviceLifeOptions.map((option) => (
                          <option key={option.days} value={option.days}>
                            {option.days} days (
                            {formatMoney(option.costMillions)})
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              );
            })}
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
            <strong data-testid="mission-cost">
              {formatMoney(costMillions)}
            </strong>
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
              onSubmit({ mission: null });
            }}
          >
            End Turn without launching
          </button>
        </section>

        <div className="planning-side">
          <section className="panel">
            <h2>
              <GameText>Milestones</GameText>
            </h2>
            {view.milestones.length === 0 ? (
              <p>None yet.</p>
            ) : (
              <ul data-testid="milestones">
                {view.milestones.map((milestone) => (
                  <li key={milestone.id}>
                    <GameText>{milestone.name}</GameText>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <h2>Operating at Mars</h2>
            {view.operatingAssets.length === 0 ? (
              <p>Nothing yet.</p>
            ) : (
              <ul data-testid="operating-assets">
                {view.operatingAssets.map((asset) => (
                  <li key={`${asset.assetId}-${asset.arrivedOn}`}>
                    <GameText>
                      {`${
                        asset.landingSiteName
                          ? `${asset.name} at ${asset.landingSiteName}`
                          : asset.name
                      }: ${
                        asset.daysLeft > 0
                          ? `${asset.daysLeft} days of Service Life left`
                          : "Service Life ends as this Turn starts"
                      }`}
                    </GameText>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {openDialog === "retire" && (
        <Dialog
          title="Retire Program"
          cancelLabel="Keep going"
          onClose={close}
          actions={
            <button type="button" className="primary" onClick={onRetire}>
              Yes, retire the Program
            </button>
          }
        >
          <p>
            <GameText>Retire this Program? This ends it for good.</GameText>
          </p>
        </Dialog>
      )}
      {openDialog === "save" && (
        <Dialog
          title="Save to a Save Slot"
          cancelLabel="Cancel"
          onClose={close}
        >
          <SaveSlots
            simulation={simulation}
            saveStore={saveStore}
            action={{
              kind: "save",
              program,
              onSaved: (slot) => {
                setSavedToSlot(slot);
                close();
              },
            }}
          />
        </Dialog>
      )}
      {openDialog === "load" && (
        <Dialog
          title="Load from a Save Slot"
          cancelLabel="Cancel"
          onClose={close}
        >
          <SaveSlots
            simulation={simulation}
            saveStore={saveStore}
            action={{ kind: "load", confirm: true, onLoad }}
          />
        </Dialog>
      )}
    </main>
  );
}
