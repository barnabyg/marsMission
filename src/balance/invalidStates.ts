import type { ProgramView, TurnSummary } from "../simulation/simulation";

const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);

/** Anything impossible about one Turn, read from the Program before it, its summary and the Program after it. */
export function invalidStates(
  before: ProgramView,
  summary: TurnSummary,
  after: ProgramView,
): string[] {
  const thresholdMillions = sum(
    summary.fundingPayouts.map(({ payoutMillions }) => payoutMillions),
  );
  const belowCancellationLevel = after.publicSupport < after.cancellationLevel;
  const milestoneIds = after.milestones.map(({ id }) => id);
  const siteIds = after.landingSites.map(({ id }) => id);
  const checks: [impossible: boolean, problem: string][] = [
    [
      before.status.kind !== "active",
      `A ${before.status.kind} Program played another Turn.`,
    ],
    [
      after.turnNumber !== before.turnNumber + 1,
      "The Turn number didn't go up by one.",
    ],
    [after.moneyMillions < 0, `Money fell to ${after.moneyMillions}.`],
    [
      summary.moneyStartMillions !== before.moneyMillions,
      "moneyStartMillions doesn't match the Program's money before the Turn.",
    ],
    [
      summary.moneyEndMillions !== after.moneyMillions,
      "moneyEndMillions doesn't match the next Program's money.",
    ],
    [
      summary.moneyStartMillions -
        summary.missionCostMillions +
        thresholdMillions +
        summary.researchGrantMillions !==
        summary.moneyEndMillions,
      "The Turn's money doesn't add up.",
    ],
    [
      sum(summary.researchGrants.map(({ millions }) => millions)) !==
        summary.researchGrantMillions,
      "researchGrantMillions isn't the total of researchGrants.",
    ],
    [
      after.science < before.science,
      `Science fell from ${before.science} to ${after.science}.`,
    ],
    [
      before.science + summary.scienceGained !== after.science,
      "scienceGained doesn't match the next Program's Science.",
    ],
    [
      !Number.isInteger(after.publicSupport) || after.publicSupport < 0,
      `Public Support is out of range at ${after.publicSupport}.`,
    ],
    [
      summary.publicSupportStart !== before.publicSupport ||
        summary.publicSupportEnd !== after.publicSupport,
      "The summary's Public Support doesn't match the Programs either side of it.",
    ],
    [
      summary.publicSupportStart +
        summary.publicSupportGained -
        (summary.failure?.publicSupportLost ?? 0) -
        summary.publicSupportDrained !==
        summary.publicSupportEnd,
      "The Turn's Public Support doesn't add up.",
    ],
    [
      belowCancellationLevel !== (after.status.kind === "cancelled"),
      `A Program at ${after.publicSupport} Public Support has the status ${after.status.kind}.`,
    ],
    [
      (summary.cancellationReason !== null) !==
        (after.status.kind === "cancelled"),
      "The summary's cancellation doesn't match the Program's status.",
    ],
    [
      new Set(milestoneIds).size < milestoneIds.length ||
        before.milestones.some(({ id }) => !milestoneIds.includes(id)),
      "A Milestone was awarded twice or lost.",
    ],
    [
      before.landingSites.some(({ id }) => !siteIds.includes(id)),
      "A known Landing Site was forgotten.",
    ],
  ];
  return checks.flatMap(([impossible, problem]) =>
    impossible ? [problem] : [],
  );
}
