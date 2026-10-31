import { parseCatalogue, type CatalogueFiles } from "../catalogue/catalogue";
import { createSimulation } from "../simulation/simulation";
import { playProgram, type TurnRecord } from "./playProgram";
import { strategies as allStrategies, type Strategy } from "./strategies";

/** How many Turns each Program plays at most. */
const turnHorizon = 20;
const barWidth = 40;

type Play = TurnRecord[];

const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);
const mean = (values: number[]) =>
  values.length > 0 ? sum(values) / values.length : 0;
const percent = (part: number, whole: number) =>
  whole > 0 ? ((100 * part) / whole).toFixed(1) : "-";
const whole = (value: number) => String(Math.round(value));
const tenth = (value: number) => value.toFixed(1);

/** Lines of a fixed-width table: the first column on the left and the rest on the right. */
function table(headers: string[], rows: string[][]): string[] {
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map((row) => row[column]?.length ?? 0)),
  );
  return [headers, ...rows].map((row) =>
    row
      .map((cell, column) =>
        column === 0
          ? cell.padEnd(widths[column] ?? 0)
          : cell.padStart(widths[column] ?? 0),
      )
      .join("  "),
  );
}

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
    whole(perProgram((turn) => turn.missionCostMillions)),
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
      whole(mean(turns.map((turn) => turn.missionCostMillions))),
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

function cancellations(plays: Play[]): string[] {
  const turnsCancelled = plays.flatMap((play) =>
    play.at(-1)?.cancelled ? [play.length] : [],
  );
  const lines = [
    `Cancelled: ${percent(turnsCancelled.length, plays.length)}% of Programs` +
      (turnsCancelled.length > 0
        ? `, on Turn ${tenth(mean(turnsCancelled))} on average`
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
  return `Science per Program from Ongoing Research: ${parts.join(", ") || "none"}`;
}

function howToRead(programs: number): string[] {
  return [
    `Programs per strategy: ${programs} (seeds 1 to ${programs}). Each plays up to ${turnHorizon} Turns.`,
    "A strategy's Turn table shows means over the Programs that played that Turn, at the end of it, so cancelled Programs",
    "drop out of later rows. Active% is out of all Programs. Thresh% and Grant% are shares of that Turn's income.",
    "Summary columns are means per Program: Turns played, final Science and Money, total income from Funding Thresholds and",
    "Research Grants and the Grant% of it, total Spent on Missions, Missions launched, Failed and Assets Lost in service,",
    "and Assets operating at the end of each Turn played.",
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
  ];
  for (const { strategy, plays } of results) {
    lines.push(
      "",
      `== ${strategy.name} ==`,
      strategy.description,
      "",
      ...turnTable(plays),
      "",
      ...cancellations(plays),
      "",
      ...fundingThresholds(plays, catalogue.fundingThresholds),
      "",
      ...firstMissions(plays),
      "",
      researchScience(plays),
    );
  }
  return `${lines.join("\n")}\n`;
}
