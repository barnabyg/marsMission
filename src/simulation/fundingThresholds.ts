import type { Catalogue } from "../catalogue/catalogue";
import { formatMoney } from "./rules";
import { dayReached, type TurnCurve } from "./scienceMilestones";
import type { FundingThresholdEntry } from "./timeline";
import type { Program } from "./types";

/* How Public Support pays and fades as a Turn ends: Funding Thresholds reached, and the fading of Public Support. */

type FundingThreshold = Catalogue["fundingThresholds"][number];

interface FundingOutcome {
  payouts: FundingThreshold[];
  entries: FundingThresholdEntry[];
}

/**
 * Pays each Funding Threshold that Public Support is at or above once the Turn's gains and losses are all in, for the
 * first time. It pays on the day Public Support reached that level for the last time in the Turn, so never before the
 * award that took it there, and a level lost again to a failed Mission doesn't count until it's regained.
 */
export function payFundingThresholds(
  catalogue: Catalogue,
  program: Program,
  publicSupport: TurnCurve,
): FundingOutcome {
  const reached = catalogue.fundingThresholds.flatMap((threshold) => {
    const day = program.fundingThresholdsPaid.includes(threshold.publicSupport)
      ? null
      : dayReached(
          publicSupport,
          threshold.publicSupport,
          catalogue.program.launchWindowIntervalDays,
        );
    return day === null ? [] : [{ threshold, day }];
  });
  return {
    payouts: reached.map(({ threshold }) => threshold),
    entries: reached.map(({ threshold, day }): FundingThresholdEntry => ({
      kind: "fundingThreshold",
      day,
      title: `Funding Threshold reached: ${threshold.publicSupport} Public Support`,
      description: `The Program's backers pay out ${formatMoney(threshold.payoutMillions)}.`,
    })),
  };
}

/** Public Support at the end of the Turn, and why that cancels the Program if it does. */
export function fadePublicSupport(catalogue: Catalogue, publicSupport: number) {
  const { publicSupportDrainPercent, cancellationLevel } = catalogue.program;
  // Public Support is whole points. Rounding down means it always falls, where rounding to the nearest point could stick at a low value.
  const end = Math.floor(
    (publicSupport * (100 - publicSupportDrainPercent)) / 100,
  );
  return {
    end,
    cancellationReason:
      end < cancellationLevel
        ? `Public Support fell to ${end}, below the Cancellation Level of ${cancellationLevel}.`
        : null,
  };
}
