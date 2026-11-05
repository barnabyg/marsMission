import type { TurnRecord } from "./playProgram";
import type { Strategy } from "./strategy";
import { ending, mean, percent, table, tenth } from "./reportFormat";
import { sum } from "./sum";

type Play = TurnRecord[];
type Results = { strategy: Strategy; plays: Play[] }[];

const startedIn = (play: Play) =>
  sum(play.map((turn) => turn.developmentsStarted.length));

/** Each strategy that started a Development, with how its Programs ended according to whether they started one. */
function developments(results: Results): string[] {
  const rows = results.flatMap(({ strategy, plays }) => {
    if (!plays.some((play) => startedIn(play) > 0)) return [];
    return [true, false].flatMap((developed) => {
      const group = plays.filter((play) => startedIn(play) > 0 === developed);
      if (group.length === 0) return [];
      return [
        [
          strategy.name,
          developed ? "yes" : "no",
          percent(group.length, plays.length),
          tenth(mean(group.map(startedIn))),
          tenth(
            mean(
              group.map((play) =>
                sum(play.map((turn) => turn.developmentsFinished.length)),
              ),
            ),
          ),
          ...ending(group),
        ],
      ];
    });
  });
  if (rows.length === 0) return ["Developments: none"];
  return table(
    [
      "Strategy",
      "Developed",
      "Programs%",
      "Started",
      "Finished",
      "Science",
      "Money",
      "Cancel%",
    ],
    rows,
  );
}

/** Whether a Program's first flight of this technology before it was Flight-proven failed, or undefined if it had none. */
const firstFlightFailed = (play: Play, name: string) =>
  play
    .flatMap((turn) => turn.unprovenFlights)
    .find((flight) => flight.name === name)?.failed;

/** The technologies a strategy flew before they were Flight-proven, in the order it first flew them. */
const unprovenFlown = (plays: Play[]) => [
  ...new Set(
    plays.flatMap((play) =>
      play.flatMap((turn) => turn.unprovenFlights.map(({ name }) => name)),
    ),
  ),
];

/** How often each technology flew before it was Flight-proven, and how often its first such flight failed. */
function unprovenFlights(results: Results): string[] {
  const rows = results.flatMap(({ strategy, plays }) =>
    unprovenFlown(plays).map((name) => {
      const flew = plays.filter(
        (play) => firstFlightFailed(play, name) !== undefined,
      );
      return [
        strategy.name,
        name,
        percent(flew.length, plays.length),
        percent(
          flew.filter((play) => firstFlightFailed(play, name)).length,
          flew.length,
        ),
        tenth(
          mean(
            flew.map(
              (play) =>
                play
                  .flatMap((turn) => turn.unprovenFlights)
                  .filter((flight) => flight.name === name).length,
            ),
          ),
        ),
      ];
    }),
  );
  if (rows.length === 0) return ["First flights of unproven technology: none"];
  return table(
    ["Strategy", "Technology", "Flown%", "Failed%", "Flights"],
    rows,
  );
}

/** How Programs ended according to whether their first flight of each unproven technology worked. */
function afterFirstFlights(results: Results): string[] {
  const rows = results.flatMap(({ strategy, plays }) =>
    unprovenFlown(plays).flatMap((name) =>
      [false, true].flatMap((failed) => {
        const group = plays.filter(
          (play) => firstFlightFailed(play, name) === failed,
        );
        if (group.length === 0) return [];
        return [
          [
            strategy.name,
            name,
            failed ? "failed" : "worked",
            percent(group.length, plays.length),
            ...ending(group),
          ],
        ];
      }),
    ),
  );
  if (rows.length === 0) return [];
  return [
    "",
    ...table(
      [
        "Strategy",
        "Technology",
        "First flight",
        "Programs%",
        "Science",
        "Money",
        "Cancel%",
      ],
      rows,
    ),
  ];
}

/**
 * The report's technology section: Developments started and finished, first flights of unproven technology and how
 * often they failed, and how Programs ended up according to both, for every strategy that did either.
 */
export function technology(results: Results): string[] {
  return [
    "Developments started and finished per Program, and how Programs ended according to whether they started one.",
    "",
    ...developments(results),
    "",
    "Technology flown before it was Flight-proven: Flown% of Programs flew it, Failed% of their first flights of it failed,",
    "and Flights is how often each of those Programs flew it before it was Flight-proven, retries included. Then how",
    "Programs ended according to whether that first flight worked.",
    "",
    ...unprovenFlights(results),
    ...afterFirstFlights(results),
  ];
}
