import {
  formatMoney,
  formatPropellant,
  type TurnSummary,
} from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { SummaryPart, type SummaryCardContent } from "./SummaryCard";
import { SummarySamplesHome } from "./SummarySamples";

/** The card of the Science the Turn earned beyond its Milestones: a first landing, Ongoing Research and samples home. */
function scienceCards(summary: TurnSummary): SummaryCardContent[] {
  const { firstLanding, ongoingResearch, samplesHome } = summary;
  if (!firstLanding && ongoingResearch.length === 0 && samplesHome.length === 0)
    return [];
  return [
    {
      key: "science",
      heading: "Science earned",
      testId: "summary-science-earned",
      content: (
        <>
          {firstLanding && (
            <p data-testid="summary-first-landing">
              <GameText>
                {`First landing at ${firstLanding.siteName}: ${firstLanding.science} Science`}
              </GameText>
            </p>
          )}
          {ongoingResearch.length > 0 && (
            <SummaryPart
              heading="Ongoing Research"
              testId="summary-ongoing-research"
            >
              <ul>
                {ongoingResearch.map(
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
            </SummaryPart>
          )}
          <SummarySamplesHome samplesHome={samplesHome} />
        </>
      ),
    },
  ];
}

/** The card of where the Money received came from, beyond base funding: Funding Thresholds and Research Grants. */
function moneyCards(summary: TurnSummary): SummaryCardContent[] {
  const { fundingPayouts, researchGrants } = summary;
  if (fundingPayouts.length === 0 && researchGrants.length === 0) return [];
  return [
    {
      key: "money",
      heading: "Money earned",
      testId: "summary-money-earned",
      content: (
        <>
          {fundingPayouts.length > 0 && (
            <SummaryPart
              heading="Funding Thresholds reached"
              testId="summary-funding-payouts"
            >
              <ul>
                {fundingPayouts.map(({ publicSupport, payoutMillions }) => (
                  <li key={publicSupport}>
                    <GameText>
                      {`${publicSupport} Public Support: ${formatMoney(payoutMillions)}`}
                    </GameText>
                  </li>
                ))}
              </ul>
            </SummaryPart>
          )}
          {researchGrants.length > 0 && (
            <SummaryPart
              heading={`Research Grants for this Turn: ${formatMoney(summary.researchGrantMillions)}`}
              testId="summary-research-grants"
            >
              <ul>
                {researchGrants.map(({ name, millions, benefit }, index) => (
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
                ))}
              </ul>
            </SummaryPart>
          )}
        </>
      ),
    },
  ];
}

/** The cards of what the Turn earned beyond its Milestones: Science, then Money. */
export function earningCards(summary: TurnSummary): SummaryCardContent[] {
  return [...scienceCards(summary), ...moneyCards(summary)];
}

/** The card of the Program's technology: what became Flight-proven, and Development started and finished. */
export function technologyCards({
  technologiesProven,
  developmentsStarted,
  developmentsFinished,
}: TurnSummary): SummaryCardContent[] {
  if (
    technologiesProven.length === 0 &&
    developmentsStarted.length === 0 &&
    developmentsFinished.length === 0
  ) {
    return [];
  }
  return [
    {
      key: "technology",
      heading: "Technology",
      content: (
        <>
          {technologiesProven.length > 0 && (
            <p data-testid="summary-flight-proven">
              <GameText>
                {`Now Flight-proven: ${technologiesProven.join(", ")}`}
              </GameText>
            </p>
          )}
          {developmentsStarted.length > 0 && (
            <p data-testid="summary-development-started">
              <GameText>
                {`Development started: ${developmentsStarted.join(", ")}`}
              </GameText>
            </p>
          )}
          {developmentsFinished.length > 0 && (
            <p data-testid="summary-development-finished">
              <GameText>
                {`Development finished, so it can be chosen for a Mission from the next Turn: ${developmentsFinished.join(", ")}`}
              </GameText>
            </p>
          )}
        </>
      ),
    },
  ];
}

/** The card of the Assets at Mars and their Landing Sites: Assets that stopped, the Survey and ascent propellant. */
export function marsCards(summary: TurnSummary): SummaryCardContent[] {
  const { assetsFailed, assetsEnded, survey } = summary;
  const propellant = propellantBySite(summary);
  if (
    assetsFailed.length === 0 &&
    assetsEnded.length === 0 &&
    !survey &&
    propellant.length === 0
  ) {
    return [];
  }
  return [
    {
      key: "mars",
      heading: "Assets and Landing Sites",
      content: (
        <>
          {assetsFailed.length > 0 && (
            <p className="problem" data-testid="summary-assets-failed">
              <GameText>
                {`Failed in service: ${assetsFailed.join(", ")}`}
              </GameText>
            </p>
          )}
          {assetsEnded.length > 0 && (
            <p data-testid="summary-assets-ended">
              <GameText>
                {`Service Life ended: ${assetsEnded.join(", ")}`}
              </GameText>
            </p>
          )}
          {survey && (
            <SummaryPart heading="Survey" testId="summary-survey">
              <ul>
                {survey.siteNamesSurveyed.length > 0 && (
                  <li>
                    <GameText>
                      {`Lower landing risk: ${survey.siteNamesSurveyed.join(", ")}`}
                    </GameText>
                  </li>
                )}
                {survey.siteNameRevealed && (
                  <li>
                    <GameText>
                      {`New Landing Site: ${survey.siteNameRevealed}`}
                    </GameText>
                  </li>
                )}
              </ul>
            </SummaryPart>
          )}
          {propellant.length > 0 && (
            <SummaryPart
              heading="Ascent propellant"
              testId="summary-ascent-propellant"
            >
              <ul>
                {propellant.map((line) => (
                  <li key={line}>
                    <GameText>{line}</GameText>
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
