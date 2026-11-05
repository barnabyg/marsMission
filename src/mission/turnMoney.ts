import type { TurnSummary } from "../simulation/simulation";

/** One amount of Money that went out or came in over a Turn. */
export interface MoneyLine {
  name: string;
  millions: number;
}

/** Where the Turn's Money went and where it came from, which together make up its change. */
export interface TurnMoney {
  spent: MoneyLine[];
  received: MoneyLine[];
  /** What was received less what was spent, which is how far Money moved over the Turn. */
  changeMillions: number;
}

function total(lines: MoneyLine[]): number {
  return lines.reduce((sum, { millions }) => sum + millions, 0);
}

function leaveOutNothing(lines: MoneyLine[]): MoneyLine[] {
  return lines.filter(({ millions }) => millions !== 0);
}

/** The Turn's Money as the Turn summary shows it, each source listed only if it moved Money. */
export function turnMoney(
  summary: Pick<
    TurnSummary,
    | "missionCostMillions"
    | "developmentCostMillions"
    | "upkeepMillions"
    | "fundingPayouts"
    | "researchGrantMillions"
    | "failure"
  >,
): TurnMoney {
  const spent = leaveOutNothing([
    { name: "Mission cost", millions: summary.missionCostMillions },
    { name: "Development", millions: summary.developmentCostMillions },
    { name: "Upkeep", millions: summary.upkeepMillions },
  ]);
  const received = leaveOutNothing([
    {
      name: "Funding Thresholds",
      millions: summary.fundingPayouts.reduce(
        (sum, { payoutMillions }) => sum + payoutMillions,
        0,
      ),
    },
    { name: "Research Grants", millions: summary.researchGrantMillions },
    // What came back from Assets a Free-return brought home.
    { name: "Refund", millions: summary.failure?.refundMillions ?? 0 },
  ]);
  return {
    spent,
    received,
    changeMillions: total(received) - total(spent),
  };
}
