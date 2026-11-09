import type { TurnSummary } from "../simulation/simulation";
import { GameText } from "../ui/GameText";
import { SummaryPart, type SummaryCardContent } from "./SummaryCard";

/** What brought samples home, to finish a sentence: "the Crew", or the Earth return orbiter by name. */
const broughtByText = (broughtBy: string) =>
  broughtBy === "Crew" ? "the Crew" : `the ${broughtBy}`;

/** The samples that reached Earth and the Science they earned, for the Turn summary's card of Science earned. */
export function SummarySamplesHome({
  samplesHome,
}: Pick<TurnSummary, "samplesHome">) {
  if (samplesHome.length === 0) return null;
  return (
    <SummaryPart heading="Samples home" testId="summary-samples-home">
      <ul>
        {samplesHome.map(({ from, samples, science, broughtBy }) => (
          <li key={`${from}:${broughtBy}`}>
            <GameText>
              {`${String(samples)} samples from ${from}, brought home by ${broughtByText(broughtBy)}: ${String(science)} Science`}
            </GameText>
          </li>
        ))}
      </ul>
    </SummaryPart>
  );
}

/**
 * The card of what happened to samples still at Mars or on their way: a journey home of samples that failed or
 * couldn't leave, and what each Landing Site cached.
 */
export function sampleCards({
  sampleJourney,
  samplesCached,
}: TurnSummary): SummaryCardContent[] {
  if (
    !sampleJourney?.failure &&
    !sampleJourney?.stayed &&
    samplesCached.length === 0
  ) {
    return [];
  }
  return [
    {
      key: "samples",
      heading: "Samples",
      content: (
        <>
          {sampleJourney?.stayed && (
            <p className="problem" data-testid="summary-samples-stayed">
              <GameText>
                {`The samples at ${sampleJourney.siteName} stayed there, because what was to fly them home stopped operating first`}
              </GameText>
            </p>
          )}
          {sampleJourney?.failure && (
            <SummaryPart
              heading="Samples lost on the way home"
              problem
              testId="summary-samples-lost"
            >
              <ul>
                <li>
                  <GameText>
                    {`Mission Event that failed: ${sampleJourney.failure.missionEventName}`}
                  </GameText>
                </li>
                <li>
                  <GameText>
                    {`Samples lost: ${String(sampleJourney.samples)} from ${sampleJourney.siteName}`}
                  </GameText>
                </li>
                <li>
                  <GameText>
                    {`Public Support lost: ${String(sampleJourney.failure.publicSupportLost)}`}
                  </GameText>
                </li>
              </ul>
            </SummaryPart>
          )}
          {samplesCached.length > 0 && (
            <SummaryPart
              heading="Samples cached"
              testId="summary-samples-cached"
            >
              <ul>
                {samplesCached.map(
                  ({ siteName, cachedBy, samples, totalSamples }) => (
                    <li key={siteName}>
                      <GameText>
                        {`${siteName}: ${cachedBy.join(" and ")} cached ${String(samples)}, so it holds ${String(totalSamples)}`}
                      </GameText>
                    </li>
                  ),
                )}
              </ul>
            </SummaryPart>
          )}
        </>
      ),
    },
  ];
}
