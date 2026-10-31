import type { ProgramView } from "../simulation/simulation";
import { GameText } from "../ui/GameText";

interface OperatingPanelProps {
  assets: ProgramView["operatingAssets"];
}

/** The Assets already at Mars, each with what is left of its Service Life. */
export function OperatingPanel({ assets }: OperatingPanelProps) {
  return (
    <section className="panel">
      <h2>Operating at Mars</h2>
      {assets.length === 0 ? (
        <p>Nothing.</p>
      ) : (
        <ul data-testid="operating-assets">
          {assets.map((asset) => (
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
  );
}
