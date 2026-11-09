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

/**
 * A technology's Technology Readiness, short enough for a crowded row, with that term's tooltip. As a pill, it is a
 * status tag, as on an Asset's card; otherwise it is a plain word.
 */
export function ReadinessTag({
  readiness,
  testId,
  pill = false,
}: {
  readiness: TechnologyReadiness;
  testId: string;
  pill?: boolean;
}) {
  const classes = {
    "flight-proven": "term technology-readiness flight-proven",
    built: "term technology-readiness unproven",
    "not-built": "term technology-readiness unproven needs-development",
  }[readiness];
  return (
    <span
      className={pill ? `${classes} tag-pill` : classes}
      data-term="Technology Readiness"
      data-testid={testId}
    >
      {readinessLabel(readiness)}
    </span>
  );
}
