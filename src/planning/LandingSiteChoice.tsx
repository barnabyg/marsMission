import { formatPropellant, type ProgramView } from "../simulation/simulation";
import { GameText } from "../ui/GameText";

interface LandingSiteChoiceProps {
  landingSites: ProgramView["landingSites"];
  landingSite: ProgramView["landingSites"][number];
  onLandingSiteChange: (siteId: string) => void;
}

/** Where a Mission carrying an Asset that lands comes down, and what that site is like. */
export function LandingSiteChoice({
  landingSites,
  landingSite,
  onLandingSiteChange,
}: LandingSiteChoiceProps) {
  return (
    <>
      <label>
        <span>
          <GameText>Landing Site</GameText>
        </span>
        <select
          value={landingSite.id}
          onChange={(event) => {
            onLandingSiteChange(event.target.value);
          }}
        >
          {landingSites.map((site) => (
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
          }${
            landingSite.ascentPropellantKg > 0
              ? ` Ascent propellant here: ${formatPropellant(landingSite.ascentPropellantKg)}.`
              : ""
          }`}
        </GameText>
      </p>
    </>
  );
}
