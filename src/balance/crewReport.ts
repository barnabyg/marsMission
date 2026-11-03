import type { CrewLossCause } from "../simulation/simulation";
import type { TurnRecord } from "./playProgram";
import type { Strategy } from "./playStyle";
import { ending, mean, percent, table, tenth } from "./reportFormat";
import { sum } from "./sum";

type Play = TurnRecord[];
type Results = { strategy: Strategy; plays: Play[] }[];

/** The report's columns for Crew lost, in the order it gives them, by why they were lost. */
const lossColumns: [CrewLossCause, string][] = [
  ["missionEvent", "Event"],
  ["health", "Health"],
  ["supplies", "Supplies"],
  ["solarParticleEvent", "SPE"],
];

const crewedMissionsIn = (play: Play) =>
  play.filter(({ crewFlown }) => crewFlown > 0).length;
const flewCrew = (play: Play) => crewedMissionsIn(play) > 0;

/** Each strategy that flew Crew, with what became of its Crew, over the Programs that flew them. */
function crewFlown(results: Results): string[] {
  const rows = results.flatMap(({ strategy, plays }) => {
    const flew = plays.filter(flewCrew);
    if (flew.length === 0) return [];
    const perProgram = (read: (turn: TurnRecord) => number) =>
      tenth(mean(flew.map((play) => sum(play.map(read)))));
    return [
      [
        strategy.name,
        percent(flew.length, plays.length),
        tenth(mean(flew.map(crewedMissionsIn))),
        perProgram(({ crewFlown: flown }) => flown),
        ...lossColumns.map(([cause]) =>
          perProgram(({ crewLost }) => crewLost[cause]),
        ),
        perProgram(({ crewHome }) => crewHome),
        tenth(mean(flew.map((play) => play.at(-1)?.crewAtMars ?? 0))),
      ],
    ];
  });
  if (rows.length === 0) return ["Crewed Missions: none"];
  return table(
    [
      "Strategy",
      "Flew%",
      "Missions",
      "Crew",
      ...lossColumns.map(([, column]) => column),
      "Home",
      "AtEnd",
    ],
    rows,
  );
}

/** How Programs ended according to whether they flew Crew, for each strategy that did. */
function afterCrew(results: Results): string[] {
  const rows = results.flatMap(({ strategy, plays }) => {
    if (!plays.some(flewCrew)) return [];
    return [true, false].flatMap((flew) => {
      const group = plays.filter((play) => flewCrew(play) === flew);
      if (group.length === 0) return [];
      return [
        [
          strategy.name,
          flew ? "yes" : "no",
          percent(group.length, plays.length),
          ...ending(group),
        ],
      ];
    });
  });
  if (rows.length === 0) return [];
  return [
    "",
    ...table(
      ["Strategy", "Flew Crew", "Programs%", "Science", "Money", "Cancel%"],
      rows,
    ),
  ];
}

/**
 * The report's Crew section: Crewed Missions flown, the Crew lost by why and brought home by a Free-return, and how
 * Programs ended according to whether they flew Crew, for every strategy that did.
 */
export function crew(results: Results): string[] {
  return [
    "Flew% of Programs flew Crew. Over those Programs, the means per Program of: Crewed Missions, Crew they carried, Crew",
    "lost to a failed Mission Event (Event), to Health running out (Health), to Supplies running out (Supplies) and to a",
    "solar particle event that lost the Mission (SPE), Crew brought home by a Free-return (Home) and Crew still at Mars",
    "as the Program ends (AtEnd). Then how Programs ended according to whether they flew Crew.",
    "",
    ...crewFlown(results),
    ...afterCrew(results),
  ];
}
