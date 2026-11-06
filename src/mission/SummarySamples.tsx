import type { TurnSummary } from "../simulation/simulation";
import { GameText } from "../ui/GameText";

/** What brought samples home, to finish a sentence: "the Crew", or the Earth return orbiter by name. */
const broughtByText = (broughtBy: string) =>
  broughtBy === "Crew" ? "the Crew" : `the ${broughtBy}`;

/**
 * What happened to samples during the Turn: those that reached Earth and the Science they earned, a journey home of
 * samples that failed or couldn't leave, and what each Landing Site cached.
 */
export function SummarySamples({ summary }: { summary: TurnSummary }) {
  const { samplesHome, sampleJourney, samplesCached } = summary;
  return (
    <>
      {samplesHome.length > 0 && (
        <section data-testid="summary-samples-home">
          <h2>
            <GameText heading>Samples home</GameText>
          </h2>
          <ul>
            {samplesHome.map(({ from, samples, science, broughtBy }) => (
              <li key={`${from}:${broughtBy}`}>
                <GameText>
                  {`${String(samples)} samples from ${from}, brought home by ${broughtByText(broughtBy)}: ${String(science)} Science`}
                </GameText>
              </li>
            ))}
          </ul>
        </section>
      )}
      {sampleJourney?.failure && (
        <section data-testid="summary-samples-lost">
          <h2 className="problem">
            <GameText heading>Samples lost on the way home</GameText>
          </h2>
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
        </section>
      )}
      {sampleJourney?.stayed && (
        <p className="problem" data-testid="summary-samples-stayed">
          <GameText>
            {`The samples at ${sampleJourney.siteName} stayed there, because what was to fly them home stopped operating first`}
          </GameText>
        </p>
      )}
      {samplesCached.length > 0 && (
        <section data-testid="summary-samples-cached">
          <h2>
            <GameText heading>Samples cached</GameText>
          </h2>
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
        </section>
      )}
    </>
  );
}
