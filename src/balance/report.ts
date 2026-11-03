import { parseCatalogue, type CatalogueFiles } from "../catalogue/catalogue";
import { createSimulation } from "../simulation/simulation";
import { playProgram, type TurnRecord } from "./playProgram";
import type { Strategy } from "./playStyle";
import { strategies as allStrategies } from "./strategies";
import { sum } from "./sum";
import { mean, percent, table, tenth, whole } from "./reportFormat";
import { technology } from "./technologyReport";

/** How many Turns each Program plays at most. */
const turnHorizon = 20;
const barWidth = 40;

type Play = TurnRecord[];

const totalOf = (play: Play, read: (turn: TurnRecord) => number) =>
  sum(play.map(read));

function summaryRow(name: string, plays: Play[]): string[] {
  const cancelled = plays.filter((play) => play.at(-1)?.cancelled);
  const thresholds = mean(
    plays.map((play) => totalOf(play, (turn) => turn.thresholdMillions)),
  );
  const grants = mean(
    plays.map((play) => totalOf(play, (turn) => turn.researchGrantMillions)),
  );
  const perProgram = (read: (turn: TurnRecord) => number) =>
    mean(plays.map((play) => totalOf(play, read)));
  return [
    name,
    percent(cancelled.length, plays.length),
    tenth(mean(plays.map((play) => play.length))),
    whole(mean(plays.map((play) => play.at(-1)?.science ?? 0))),
    whole(mean(plays.map((play) => play.at(-1)?.moneyMillions ?? 0))),
    whole(thresholds),
    whole(grants),
    percent(grants, thresholds + grants),
    whole(perProgram((turn) => turn.spentMillions)),
    tenth(perProgram((turn) => Number(turn.launched))),
    tenth(perProgram((turn) => Number(turn.missionFailed))),
    tenth(perProgram((turn) => turn.assetsFailed)),
    tenth(
      mean(plays.flatMap((play) => play.map((turn) => turn.assetsOperating))),
    ),
  ];
}

const summaryHeaders = [
  "Strategy",
  "Cancel%",
  "Turns",
  "Science",
  "Money",
  "Thresh$M",
  "Grants$M",
  "Grant%",
  "Spent$M",
  "Missions",
  "Failed",
  "AssetsLost",
  "Assets",
];

function turnTable(plays: Play[]): string[] {
  const rows: string[][] = [];
  for (let index = 0; index < turnHorizon; index++) {
    const turns = plays.flatMap((play) => play[index] ?? []);
    if (turns.length === 0) break;
    const thresholds = mean(turns.map((turn) => turn.thresholdMillions));
    const grants = mean(turns.map((turn) => turn.researchGrantMillions));
    rows.push([
      String(index + 1),
      percent(turns.filter((turn) => !turn.cancelled).length, plays.length),
      whole(mean(turns.map((turn) => turn.moneyMillions))),
      whole(mean(turns.map((turn) => turn.science))),
      whole(mean(turns.map((turn) => turn.publicSupport))),
      tenth(mean(turns.map((turn) => turn.assetsOperating))),
      whole(mean(turns.map((turn) => turn.spentMillions))),
      whole(thresholds),
      whole(grants),
      percent(thresholds, thresholds + grants),
      percent(grants, thresholds + grants),
    ]);
  }
  return table(
    [
      "Turn",
      "Active%",
      "Money",
      "Science",
      "Support",
      "Assets",
      "Spent$M",
      "Thresh$M",
      "Grants$M",
      "Thresh%",
      "Grant%",
    ],
    rows,
  );
}

/** When Research Grants take over from Funding Thresholds as a strategy's main income, going by its Turn table's means. */
function mainIncome(plays: Play[]): string {
  const perTurn: { thresholds: number; grants: number }[] = [];
  for (let index = 0; index < turnHorizon; index++) {
    const turns = plays.flatMap((play) => play[index] ?? []);
    if (turns.length === 0) break;
    perTurn.push({
      thresholds: mean(turns.map((turn) => turn.thresholdMillions)),
      grants: mean(turns.map((turn) => turn.researchGrantMillions)),
    });
  }
  const fromIndex =
    perTurn.findLastIndex(
      ({ thresholds, grants }) => thresholds > 0 && thresholds >= grants,
    ) + 1;
  const anyGrants = perTurn.some(({ grants }) => grants > 0);
  let thresholdsSoFar = 0;
  let grantsSoFar = 0;
  const inTotalIndex = perTurn.findIndex(({ thresholds, grants }) => {
    thresholdsSoFar += thresholds;
    grantsSoFar += grants;
    return grantsSoFar > thresholdsSoFar;
  });
  const each =
    anyGrants && fromIndex < perTurn.length
      ? `from Turn ${fromIndex + 1} on`
      : "never";
  const total = inTotalIndex < 0 ? "never" : `by Turn ${inTotalIndex + 1}`;
  return `Research Grants pass Funding Thresholds: each Turn ${each}, in total ${total}`;
}

function cancellations(plays: Play[]): string[] {
  const turnsCancelled = plays.flatMap((play) =>
    play.at(-1)?.cancelled ? [play.length] : [],
  );
  const withAssets = plays.filter((play) => {
    const last = play.at(-1);
    return last?.cancelled === true && last.assetsOperating > 0;
  });
  const lines = [
    `Cancelled: ${percent(turnsCancelled.length, plays.length)}% of Programs` +
      (turnsCancelled.length > 0
        ? `, on Turn ${tenth(mean(turnsCancelled))} on average, ` +
          `${percent(withAssets.length, plays.length)}% with an Asset still operating`
        : ""),
  ];
  for (let turn = 1; turn <= turnHorizon; turn++) {
    const count = turnsCancelled.filter((when) => when === turn).length;
    if (count === 0) continue;
    const bar = "#".repeat(Math.ceil((barWidth * count) / plays.length));
    lines.push(
      `  Turn ${String(turn).padStart(2)} ${percent(count, plays.length).padStart(5)}% ${bar}`,
    );
  }
  return lines;
}

function fundingThresholds(
  plays: Play[],
  levels: CatalogueFiles["fundingThresholds"],
): string[] {
  return table(
    ["Funding Threshold", "Payout$M", "Reached%", "MeanTurn"],
    levels.map(({ publicSupport, payoutMillions }) => {
      const reachedOn = plays.flatMap((play) => {
        const index = play.findIndex((turn) =>
          turn.thresholdsReached.includes(publicSupport),
        );
        return index < 0 ? [] : [index + 1];
      });
      return [
        String(publicSupport),
        String(payoutMillions),
        percent(reachedOn.length, plays.length),
        reachedOn.length > 0 ? tenth(mean(reachedOn)) : "-",
      ];
    }),
  );
}

/** The story of the first two Missions, which shows whether a retry is affordable and what two failures do. */
function firstMissions(plays: Play[]): string[] {
  const failedFirst = plays.flatMap((play) => {
    const first = play.findIndex((turn) => turn.launched);
    return play[first]?.missionFailed ? [{ play, first }] : [];
  });
  if (failedFirst.length === 0) return ["First Mission failed: never"];
  const retried = failedFirst.filter(
    ({ play, first }) => play[first + 1]?.launched,
  );
  const failedTwice = failedFirst.flatMap(({ play, first }) => {
    const second = play.find((turn, index) => index > first && turn.launched);
    return second?.missionFailed ? [second] : [];
  });
  const cancelled = failedTwice.filter((turn) => turn.cancelled);
  return [
    `First Mission failed: ${percent(failedFirst.length, plays.length)}% of Programs`,
    `  Launched again on the next Turn: ${percent(retried.length, failedFirst.length)}% of those`,
    `  Second Mission failed too: ${percent(failedTwice.length, failedFirst.length)}% of those`,
    ...(failedTwice.length > 0
      ? [
          `  Cancelled on that Turn: ${percent(cancelled.length, failedTwice.length)}% of those`,
        ]
      : []),
  ];
}

/** How Programs end up after their first Mission worked or failed, which shows what a gamble on that Mission pays. */
function afterFirstMission(plays: Play[]): string[] {
  const outcome = (label: string, failed: boolean) => {
    const group = plays.filter(
      (play) => play.find((turn) => turn.launched)?.missionFailed === failed,
    );
    if (group.length === 0) return [];
    const last = group.flatMap((play) => play.at(-1) ?? []);
    const cancelled = last.filter((turn) => turn.cancelled);
    return [
      `  First Mission ${label} (${percent(group.length, plays.length)}%): ends with ` +
        `$${whole(mean(last.map((turn) => turn.moneyMillions)))}M and ${whole(mean(last.map((turn) => turn.science)))} Science, ` +
        `${percent(cancelled.length, group.length)}% cancelled`,
    ];
  };
  return [...outcome("worked", false), ...outcome("failed", true)];
}

const kindNames: Record<TurnRecord["decisions"][number]["kind"], string> = {
  contingency: "Contingency",
  dustStorm: "dust storm",
  solarParticleEvent: "solar particle event",
  goNoGo: "go/no-go check",
};

/** How often each kind of Decision Point came up, and what Contingencies did. */
function decisionPoints(plays: Play[]): string[] {
  const turns = plays.flat();
  const met = sum(turns.map((turn) => turn.decisionPoints));
  if (met === 0) return ["Decision Points: none"];
  const contingencies = turns
    .flatMap(({ decisions }) => decisions)
    .filter(({ kind }) => kind === "contingency").length;
  const rescues = sum(turns.map((turn) => turn.rescues));
  const perKind = Object.entries(kindNames).flatMap(([kind, name]) => {
    const count = turns
      .flatMap(({ decisions }) => decisions)
      .filter((decision) => decision.kind === kind).length;
    return count > 0 ? [`${name} ${tenth(count / plays.length)}`] : [];
  });
  return [
    `Decision Points: ${tenth(met / plays.length)} per Program (${perKind.join(", ")}), in ${percent(turns.filter((turn) => turn.decisionPoints > 0).length, turns.length)}% of Turns` +
      (contingencies > 0
        ? `, ${percent(rescues, contingencies)}% of Contingencies saved the Assets`
        : ""),
  ];
}

/**
 * How Programs end up according to each answer to each kind of Decision Point, over the Programs that gave it at least
 * once, for every strategy that did. Compare strategies that differ only in that answer, such as two "steady:" ones.
 */
function decisionOutcomes(
  results: { strategy: Strategy; plays: Play[] }[],
): string[] {
  const rows = Object.entries(kindNames).flatMap(([kind, name]) =>
    results.flatMap(({ strategy, plays }) => {
      const answers = [
        ...new Set(
          plays
            .flat()
            .flatMap(({ decisions }) => decisions)
            .filter((decision) => decision.kind === kind)
            .map(({ answer }) => answer),
        ),
      ].toSorted();
      return answers.map((answer) => {
        const gave = plays.filter((play) =>
          play.some(({ decisions }) =>
            decisions.some(
              (decision) =>
                decision.kind === kind && decision.answer === answer,
            ),
          ),
        );
        const last = gave.flatMap((play) => play.at(-1) ?? []);
        return [
          name,
          answer,
          strategy.name,
          percent(gave.length, plays.length),
          whole(mean(last.map((turn) => turn.science))),
          whole(mean(last.map((turn) => turn.moneyMillions))),
          percent(last.filter((turn) => turn.cancelled).length, last.length),
        ];
      });
    }),
  );
  return table(
    [
      "Decision Point",
      "Answer",
      "Strategy",
      "Gave%",
      "Science",
      "Money",
      "Cancel%",
    ],
    rows,
  );
}

function researchScience(plays: Play[]): string {
  const totals = new Map<string, number>();
  for (const { activityName, science } of plays
    .flat()
    .flatMap((turn) => turn.researchScience)) {
    totals.set(activityName, (totals.get(activityName) ?? 0) + science);
  }
  const parts = [...totals]
    .toSorted(([first], [second]) => (first < second ? -1 : 1))
    .map(
      ([activityName, total]) =>
        `${activityName} ${whole(total / plays.length)}`,
    );
  const fromBenefits = plays
    .flat()
    .reduce((total, { benefitScience }) => total + benefitScience, 0);
  // Left out with none, so that strategies that never use a Benefit report as they did before Benefits.
  const benefits =
    fromBenefits > 0
      ? `, of which Benefits added ${whole(fromBenefits / plays.length)}`
      : "";
  return `Science per Program from Ongoing Research: ${parts.join(", ") || "none"}${benefits}`;
}

function howToRead(programs: number): string[] {
  return [
    `Programs per strategy: ${programs} (seeds 1 to ${programs}). Each plays up to ${turnHorizon} Turns.`,
    "A strategy's Turn table shows means over the Programs that played that Turn, at the end of it, so cancelled Programs",
    "drop out of later rows. Active% is out of all Programs. Thresh% and Grant% are shares of that Turn's income.",
    "Summary columns are means per Program: Turns played, final Science and Money, total income from Funding Thresholds and",
    "Research Grants and the Grant% of it, total Spent on Missions and Development, Missions launched, Failed and Assets",
    "Lost in service, and Assets operating at the end of each Turn played.",
  ];
}

/** The whole report as text. It depends only on these arguments, so the same ones always give the same bytes. */
export function balanceReport(
  files: CatalogueFiles,
  programs: number,
  strategies: Strategy[] = allStrategies,
): string {
  const catalogue = parseCatalogue(files);
  const simulation = createSimulation(catalogue);
  const results = strategies.map((strategy) => ({
    strategy,
    plays: Array.from(
      { length: programs },
      (_, index) =>
        playProgram(simulation, strategy, index + 1, turnHorizon).turns,
    ),
  }));

  const lines = [
    "MARS MISSION BALANCE REPORT",
    "",
    ...howToRead(programs),
    "",
    "== Summary ==",
    "",
    ...table(
      summaryHeaders,
      results.map(({ strategy, plays }) => summaryRow(strategy.name, plays)),
    ),
    "",
    "== Decision Points by answer ==",
    "",
    "Programs that gave each answer at least once, and how they ended: Gave% of the strategy's Programs, then their means.",
    "",
    ...decisionOutcomes(results),
    "",
    "== Technology ==",
    "",
    ...technology(results),
  ];
  for (const { strategy, plays } of results) {
    lines.push(
      "",
      `== ${strategy.name} ==`,
      strategy.description,
      "",
      ...turnTable(plays),
      "",
      mainIncome(plays),
      "",
      ...cancellations(plays),
      "",
      ...fundingThresholds(plays, catalogue.fundingThresholds),
      "",
      ...firstMissions(plays),
      ...afterFirstMission(plays),
      ...decisionPoints(plays),
      "",
      researchScience(plays),
    );
  }
  return `${lines.join("\n")}\n`;
}
