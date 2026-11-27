/**
 * The words step 4 of New Mission puts round its risks: what each Reliability level would leave, for the tooltip on
 * its select, and what a Contingency's own Risk Band means.
 */

interface LevelBand {
  name: string;
  riskBand: string;
}

/**
 * The tooltip detail on a Reliability select: the Risk Band each level would leave, as "Launch with each level: None
 * ~5% · Tested ~2% · Redundant ~1%." The options themselves give only name and cost, as the chosen band is beside them.
 */
export function reliabilityDetail(
  subject: string,
  levels: readonly LevelBand[],
): string {
  const bands = levels.map(({ name, riskBand }) => `${name} ${riskBand}`);
  const sharesABand = levels.some(
    ({ riskBand }, index) =>
      index > 0 && levels[index - 1]?.riskBand === riskBand,
  );
  return [
    `${subject} with each level: ${bands.join(" · ")}.`,
    // Every level multiplies the chance by less than the one before, so one that leaves the band still pays.
    ...(sharesABand
      ? [
          "Risk Bands are rough, so a level in the same band as a cheaper one still lowers the chance within it.",
        ]
      : []),
  ].join(" ");
}
