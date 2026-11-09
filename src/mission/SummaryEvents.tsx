import { formatMoney, type TurnSummary } from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { SummaryPart, type SummaryCardContent } from "./SummaryCard";

function describeSolarParticleEvent({
  outcome,
  assets,
  serviceLifeLossPercent,
  crew,
  crewHealthLoss,
}: NonNullable<TurnSummary["solarParticleEvent"]>): string {
  const names = [...assets, ...crew].join(", ");
  // What it cost those on board, such as "15% of each Asset's Service Life and 5 Health for each Crew member".
  const cost = [
    ...(assets.length > 0
      ? [`${serviceLifeLossPercent}% of each Asset's Service Life`]
      : []),
    ...(crew.length > 0
      ? [`${crewHealthLoss} Health for each Crew member`]
      : []),
  ].join(" and ");
  switch (outcome) {
    case "protected":
      return `Safe mode protected ${names}, at a cost of ${cost}`;
    case "unharmed":
      return `Carried on, and ${names} came through unharmed`;
    case "damaged":
      return `Carried on, and the radiation hit ${names}, which cost ${cost}`;
    case "lost":
      return `Carried on, and the radiation lost ${names}`;
  }
}

/** A card for each failure of the Turn: the Mission's, and a journey home's. */
export function failureCards({
  failure,
  journeyHome,
}: TurnSummary): SummaryCardContent[] {
  return [
    ...(failure
      ? [
          {
            key: "failure",
            heading: failure.returnedToEarth
              ? "Mission came back to Earth"
              : "Mission failed",
            problem: true,
            testId: "summary-failure",
            content: (
              <ul>
                <li>
                  <GameText>
                    {`${failure.hazard ? "Lost to" : "Mission Event that failed"}: ${failure.missionEventName}`}
                  </GameText>
                </li>
                <li>
                  <GameText>
                    {`${failure.returnedToEarth ? "Assets back on Earth" : "Assets lost"}: ${failure.assetsLost.join(", ")}`}
                  </GameText>
                </li>
                <li>
                  <GameText>
                    {`Public Support lost: ${failure.publicSupportLost}`}
                  </GameText>
                </li>
                {failure.returnedToEarth && (
                  <li>{`Refund: ${formatMoney(failure.refundMillions)}`}</li>
                )}
              </ul>
            ),
          },
        ]
      : []),
    ...(journeyHome?.failure
      ? [
          {
            key: "journey-home-failure",
            heading: "Journey home failed",
            problem: true,
            testId: "summary-journey-home-failure",
            content: (
              <ul>
                <li>
                  <GameText>
                    {`Mission Event that failed: ${journeyHome.failure.missionEventName}`}
                  </GameText>
                </li>
                <li>
                  <GameText>{`Crew aboard: ${journeyHome.crew.join(", ")}`}</GameText>
                </li>
                {journeyHome.samples > 0 && (
                  <li>
                    <GameText>
                      {`Samples lost with them: ${String(journeyHome.samples)}`}
                    </GameText>
                  </li>
                )}
                <li>
                  <GameText>
                    {`Public Support lost: ${journeyHome.failure.publicSupportLost}`}
                  </GameText>
                </li>
              </ul>
            ),
          },
        ]
      : []),
  ];
}

/** What a Contingency did for its Mission Event, such as "Mars orbit insertion: Backup thruster not used". */
function describeContingency({
  missionEventName,
  contingencyName,
  answer,
  rescued,
  assets,
}: TurnSummary["contingencies"][number]): string {
  if (answer === "decline") {
    return `${missionEventName}: ${contingencyName} not used`;
  }
  if (rescued && assets.length === 0) {
    return `${missionEventName}: saved by ${contingencyName}, but the Mission was lost later`;
  }
  if (rescued) {
    const serviceLives = assets
      .map(
        ({ name, serviceLifeDays }) =>
          `${name} now has a Service Life of ${serviceLifeDays} days`,
      )
      .join(", ");
    return `${missionEventName}: saved by ${contingencyName}. ${serviceLives}`;
  }
  return `${missionEventName}: ${contingencyName} used, but it couldn't save the Mission`;
}

/** What a dust storm did at its Landing Site, sheltered from or carried on through. */
function describeDustStorm({
  siteName,
  days,
  answer,
  assets,
  assetsFailed,
  crewHurt,
}: TurnSummary["dustStorms"][number]): string {
  const harm = [
    ...(assetsFailed.length > 0 ? [`lost ${assetsFailed.join(", ")}`] : []),
    ...(crewHurt.length > 0 ? [`${crewHurt.join(", ")} lost Health`] : []),
  ];
  return `Dust storm over ${siteName}: ${
    answer === "shelter"
      ? `${assets.join(", ")} sheltered for ${days} days, with no Ongoing Research`
      : harm.length > 0
        ? `carried on through ${days} days, and ${harm.join(", and ")}`
        : `${assets.join(", ")} carried on through ${days} days, and came through`
  }`;
}

/** The card of what was decided during the Turn and the Hazards met: Decision Points, a go/no-go check and Hazards. */
export function decisionCards(summary: TurnSummary): SummaryCardContent[] {
  const { contingencies, goNoGo, solarParticleEvent, dustStorms } = summary;
  if (
    contingencies.length === 0 &&
    !goNoGo &&
    !solarParticleEvent &&
    dustStorms.length === 0
  ) {
    return [];
  }
  return [
    {
      key: "decisions",
      heading: "Decision Points and Hazards",
      content: (
        <>
          {contingencies.length > 0 && (
            <SummaryPart
              heading="Decision Points"
              testId="summary-contingencies"
            >
              <ul>
                {contingencies.map((contingency) => (
                  <li key={contingency.missionEventName}>
                    <GameText>{describeContingency(contingency)}</GameText>
                  </li>
                ))}
              </ul>
            </SummaryPart>
          )}
          {goNoGo && (
            <SummaryPart heading="Go/no-go check" testId="summary-go-no-go">
              <p>
                <GameText>
                  {goNoGo.answer === "holdOff"
                    ? `Held off the landing at ${goNoGo.siteName} for ${goNoGo.daysHeld} days, until the dust storm had passed. Each Asset landed lost ${goNoGo.serviceLifeDaysLost} days of Service Life.`
                    : `Landed at ${goNoGo.siteName} in a dust storm, at a higher risk.`}
                </GameText>
              </p>
            </SummaryPart>
          )}
          {solarParticleEvent && (
            <SummaryPart
              heading="Solar particle event"
              testId="summary-solar-particle-event"
            >
              <p>
                <GameText>
                  {describeSolarParticleEvent(solarParticleEvent)}
                </GameText>
              </p>
            </SummaryPart>
          )}
          {dustStorms.length > 0 && (
            <SummaryPart heading="Hazards" testId="summary-dust-storms">
              <ul>
                {dustStorms.map((storm) => (
                  <li key={storm.siteName}>
                    <GameText>{describeDustStorm(storm)}</GameText>
                  </li>
                ))}
              </ul>
            </SummaryPart>
          )}
        </>
      ),
    },
  ];
}
