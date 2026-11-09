import type { TurnSummary } from "../simulation/simulation";
import { formatDate } from "../ui/format";
import { GameText } from "../ui/GameText";
import { SummaryPart, type SummaryCardContent } from "./SummaryCard";
import { SummaryHealthLost } from "./SummaryHealthLost";

/**
 * The card of the Program's Crew this Turn: who came home, a return vehicle waiting for them, Supplies running out,
 * who was lost, who is at Mars and the Health each lost.
 */
export function crewCards(summary: TurnSummary): SummaryCardContent[] {
  const { crew, crewHome, returnVehicle, suppliesRanOut, crewLost } = summary;
  if (
    crew.length === 0 &&
    crewHome.length === 0 &&
    !returnVehicle &&
    suppliesRanOut.length === 0 &&
    crewLost.length === 0 &&
    summary.healthLost.length === 0
  ) {
    return [];
  }
  return [
    {
      key: "crew",
      heading: "Crew",
      content: (
        <>
          {crewHome.length > 0 && (
            <p data-testid="summary-crew-home">
              <GameText>
                {`Crew home safe, who won't fly again: ${crewHome.join(", ")}. Public Support earned: ${summary.publicSupportForCrewHome}`}
              </GameText>
            </p>
          )}
          {returnVehicle && (
            <p data-testid="summary-return-vehicle">
              <GameText>
                {returnVehicle.crew.length > 0
                  ? `Return vehicle ${returnVehicle.name} in Mars orbit, waiting to bring home on a later Turn: ${returnVehicle.crew.join(", ")}`
                  : `Return vehicle ${returnVehicle.name} in Mars orbit, but none of the Crew it was sent for are left at Mars`}
              </GameText>
            </p>
          )}
          {suppliesRanOut.length > 0 && (
            <p className="problem" data-testid="summary-supplies-out">
              <GameText>
                {`Supplies ran out: ${suppliesRanOut
                  .map(({ crew, on }) => `${crew} on ${formatDate(on)}`)
                  .join(", ")}`}
              </GameText>
            </p>
          )}
          {crewLost.length > 0 && (
            <SummaryPart heading="Crew lost" problem testId="summary-crew-lost">
              <ul>
                {crewLost.map(({ description, publicSupportLost }) => (
                  <li key={description} className="problem">
                    <GameText>
                      {`${description} Public Support lost: ${publicSupportLost}`}
                    </GameText>
                  </li>
                ))}
              </ul>
            </SummaryPart>
          )}
          {crew.length > 0 && (
            <SummaryPart heading="Crew at Mars" testId="summary-crew">
              <ul>
                {crew.map(
                  ({ name, locationName, health, maxHealth, arrived }) => (
                    <li key={name}>
                      <GameText>
                        {`${name}, in ${locationName}${arrived ? " from this Turn" : ""}: Health ${health} of ${maxHealth}`}
                      </GameText>
                    </li>
                  ),
                )}
              </ul>
            </SummaryPart>
          )}
          <SummaryHealthLost healthLost={summary.healthLost} />
        </>
      ),
    },
  ];
}
