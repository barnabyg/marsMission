import {
  formatMoney,
  formatPropellant,
  type TurnSummary,
} from "../simulation/simulation";
import { formatDate } from "../ui/format";
import { GameText } from "../ui/GameText";
import { SummaryHealthLost } from "./SummaryHealthLost";

/**
 * Where the Program stands after the Turn: its Crew, technology, research, ascent propellant, Assets, Survey and the
 * Money it earned.
 */
export function SummaryOutcomes({ summary }: { summary: TurnSummary }) {
  return (
    <>
      {summary.crew.length > 0 && (
        <section data-testid="summary-crew">
          <h2>
            <GameText heading>Crew at Mars</GameText>
          </h2>
          <ul>
            {summary.crew.map(
              ({ name, locationName, health, maxHealth, arrived }) => (
                <li key={name}>
                  <GameText>
                    {`${name}, in ${locationName}${arrived ? " from this Turn" : ""}: Health ${health} of ${maxHealth}`}
                  </GameText>
                </li>
              ),
            )}
          </ul>
        </section>
      )}
      {summary.suppliesRanOut.length > 0 && (
        <p className="problem" data-testid="summary-supplies-out">
          <GameText>
            {`Supplies ran out: ${summary.suppliesRanOut
              .map(({ crew, on }) => `${crew} on ${formatDate(on)}`)
              .join(", ")}`}
          </GameText>
        </p>
      )}
      <SummaryHealthLost healthLost={summary.healthLost} />
      {summary.firstLanding && (
        <p data-testid="summary-first-landing">
          <GameText>
            {`First landing at ${summary.firstLanding.siteName}: ${summary.firstLanding.science} Science`}
          </GameText>
        </p>
      )}
      {summary.technologiesProven.length > 0 && (
        <p data-testid="summary-flight-proven">
          <GameText>
            {`Now Flight-proven: ${summary.technologiesProven.join(", ")}`}
          </GameText>
        </p>
      )}
      {summary.developmentsStarted.length > 0 && (
        <p data-testid="summary-development-started">
          <GameText>
            {`Development started: ${summary.developmentsStarted.join(", ")}`}
          </GameText>
        </p>
      )}
      {summary.developmentsFinished.length > 0 && (
        <p data-testid="summary-development-finished">
          <GameText>
            {`Development finished, so it can be chosen for a Mission from the next Turn: ${summary.developmentsFinished.join(", ")}`}
          </GameText>
        </p>
      )}
      {summary.ongoingResearch.length > 0 && (
        <section data-testid="summary-ongoing-research">
          <h2>
            <GameText heading>Ongoing Research</GameText>
          </h2>
          <ul>
            {summary.ongoingResearch.map(
              (
                {
                  assetName,
                  activityName,
                  science,
                  publicSupport,
                  days,
                  benefit,
                },
                index,
              ) => (
                // Two copies of an Asset can each earn the same amount, so the position tells them apart.
                <li key={`${assetName}-${index}`}>
                  <GameText>
                    {`${assetName}, ${activityName}: ${science} Science and ${publicSupport} Public Support over ${days} ${days === 1 ? "day" : "days"}${
                      benefit
                        ? `, raised on ${benefit.days} of them by the Benefit from ${benefit.givenBy.join(" and ")}, which added ${benefit.science} Science and ${benefit.publicSupport} Public Support`
                        : ""
                    }`}
                  </GameText>
                </li>
              ),
            )}
          </ul>
        </section>
      )}
      {(summary.ascentPropellant.length > 0 ||
        summary.ascentPropellantUsed.length > 0) && (
        <section data-testid="summary-ascent-propellant">
          <h2>
            <GameText heading>Ascent propellant</GameText>
          </h2>
          <ul>
            {propellantBySite(summary).map((line) => (
              <li key={line}>
                <GameText>{line}</GameText>
              </li>
            ))}
          </ul>
        </section>
      )}
      {summary.assetsFailed.length > 0 && (
        <p className="problem" data-testid="summary-assets-failed">
          <GameText>
            {`Failed in service: ${summary.assetsFailed.join(", ")}`}
          </GameText>
        </p>
      )}
      {summary.assetsEnded.length > 0 && (
        <p data-testid="summary-assets-ended">
          <GameText>
            {`Service Life ended: ${summary.assetsEnded.join(", ")}`}
          </GameText>
        </p>
      )}
      {summary.survey && (
        <section data-testid="summary-survey">
          <h2>
            <GameText heading>Survey</GameText>
          </h2>
          <ul>
            {summary.survey.siteNamesSurveyed.length > 0 && (
              <li>
                <GameText>
                  {`Lower landing risk: ${summary.survey.siteNamesSurveyed.join(", ")}`}
                </GameText>
              </li>
            )}
            {summary.survey.siteNameRevealed && (
              <li>
                <GameText>
                  {`New Landing Site: ${summary.survey.siteNameRevealed}`}
                </GameText>
              </li>
            )}
          </ul>
        </section>
      )}
      {summary.fundingPayouts.length > 0 && (
        <section data-testid="summary-funding-payouts">
          <h2>
            <GameText heading>Funding Thresholds reached</GameText>
          </h2>
          <ul>
            {summary.fundingPayouts.map(({ publicSupport, payoutMillions }) => (
              <li key={publicSupport}>
                <GameText>
                  {`${publicSupport} Public Support: ${formatMoney(payoutMillions)}`}
                </GameText>
              </li>
            ))}
          </ul>
        </section>
      )}
      {summary.researchGrants.length > 0 && (
        <section data-testid="summary-research-grants">
          <h2>
            <GameText heading>
              {`Research Grants for this Turn: ${formatMoney(summary.researchGrantMillions)}`}
            </GameText>
          </h2>
          <ul>
            {summary.researchGrants.map(
              ({ name, millions, benefit }, index) => (
                // Two copies of an Asset can each be paid the same amount, so the position tells them apart.
                <li key={`${name}-${index}`}>
                  <GameText>
                    {`${name}: ${formatMoney(millions)}${
                      benefit
                        ? `, raised on ${benefit.days} ${benefit.days === 1 ? "day" : "days"} by the Benefit from ${benefit.givenBy.join(" and ")}, which added ${formatMoney(benefit.millions)}`
                        : ""
                    }`}
                  </GameText>
                </li>
              ),
            )}
          </ul>
        </section>
      )}
    </>
  );
}

/**
 * What each Landing Site's ascent propellant did this Turn, one line a site: what its fuel plants made, what Mars ascent
 * used, and what it has now.
 */
function propellantBySite({
  ascentPropellant,
  ascentPropellantUsed,
}: TurnSummary): string[] {
  const sites = [
    ...new Set(
      [...ascentPropellant, ...ascentPropellantUsed].map(
        ({ siteName }) => siteName,
      ),
    ),
  ];
  return sites.map((siteName) => {
    const made = ascentPropellant.find((each) => each.siteName === siteName);
    const used = ascentPropellantUsed.find(
      (each) => each.siteName === siteName,
    );
    const parts = [
      ...(made
        ? [`${made.madeBy.join(" and ")} made ${formatPropellant(made.madeKg)}`]
        : []),
      ...(used ? [`Mars ascent used ${formatPropellant(used.usedKg)}`] : []),
    ];
    const totalKg = used?.totalKg ?? made?.totalKg ?? 0;
    return `${siteName}: ${parts.join(" and ")}, so it has ${formatPropellant(totalKg)}`;
  });
}
