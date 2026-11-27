import { formatMoney } from "../simulation/simulation";

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

interface ContingencyOffer {
  name: string;
  costMillions: number;
  massTonnes: number;
  /** The Risk Band of the second try failing too, if the Mission Event fails and the Contingency is used. */
  riskBand: string;
}

/** A Contingency's label: "Kick stage · $60M · 0.3 t · ~20% chance it fails too". */
export function contingencyLabel({
  name,
  costMillions,
  massTonnes,
  riskBand,
}: ContingencyOffer): string {
  return [
    name,
    formatMoney(costMillions),
    `${String(massTonnes)} t`,
    `${riskBand} chance it fails too`,
  ].join(" · ");
}
