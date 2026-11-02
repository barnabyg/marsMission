import type { ProgramView } from "../simulation/simulation";

type TechnologyReadiness = ProgramView["assets"][number]["technologyReadiness"];

/** How Planning Mode labels a technology's Technology Readiness. */
export function readinessLabel(readiness: TechnologyReadiness): string {
  return readiness === "flight-proven" ? "Flight-proven" : "Unproven";
}

/** A technology's Technology Readiness, short enough for a crowded row, with that term's tooltip. */
export function ReadinessTag({
  readiness,
  testId,
}: {
  readiness: TechnologyReadiness;
  testId: string;
}) {
  return (
    <span
      className={
        readiness === "flight-proven"
          ? "term technology-readiness"
          : "term technology-readiness unproven"
      }
      data-term="Technology Readiness"
      data-testid={testId}
      tabIndex={0}
    >
      {readinessLabel(readiness)}
    </span>
  );
}
