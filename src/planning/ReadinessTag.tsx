import type { TechnologyReadiness } from "../simulation/simulation";

/** How Planning Mode labels a technology's Technology Readiness. */
export function readinessLabel(readiness: TechnologyReadiness): string {
  const labels: Record<TechnologyReadiness, string> = {
    "flight-proven": "Flight-proven",
    built: "Unproven",
    "not-built": "Needs Development",
  };
  return labels[readiness];
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
