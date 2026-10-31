/**
 * What each game term means, for the tooltips. Wording starts from GLOSSARY.md, and a test
 * fails if a glossary term is missing here or its opening sentence no longer matches.
 */
export const tooltips = {
  Program:
    "One complete game: an open-ended sequence of Turns in which the player launches Missions and builds up Assets at Mars. It ends when the player retires it or when it is cancelled.",
  Turn: "The period from one Launch Window to the next. It is made up of Planning Mode followed by Mission Mode.",
  "Launch Window":
    "The recurring opportunity, roughly every 26 months, when an Earth–Mars transfer is practical. Each Turn begins at one.",
  Mission:
    "The single journey launched in a Turn's Launch Window, carrying one or more Assets and possibly Crew. There is at most one Mission per Turn. It ends when it has delivered what it carries, or has failed.",
  "Launch Vehicle":
    "The rocket chosen from the catalogue to launch a Mission. It sets how much mass the Mission can carry.",
  Trajectory:
    "One of a few fixed routes to Mars chosen for a Mission, such as Slow, Fast or Free-return. It trades fuel and mass against Duration and safety.",
  "Robotic Mission":
    "A Mission with no crew aboard. It is cheaper than a Crewed Mission and risks only hardware and money.",
  "Crewed Mission":
    "A Mission carrying Crew. It costs much more than a Robotic Mission and earns more Public Support, and failure can cost lives.",
  Precursor:
    "A Robotic Mission whose main value is lowering the risk or cost of later Missions, for example by surveying landing sites.",
  Crew: "The named astronauts on a Crewed Mission. Apart from their names and Health, they have no individual traits.",
  Health:
    "A single value for each Crew member. Radiation, time at Mars and failed Mission Events lower it, Protection slows the decline, and at zero the Crew member dies.",
  Supplies:
    "The food, water and other consumables Crew need to stay alive. When they run out, Health falls quickly.",
  Asset:
    "A pre-designed piece of hardware chosen from a catalogue, such as an orbiter, lander, rover, drone, habitat or fuel plant. Assets remain in place and keep working after their Mission until their Service Life ends or they fail.",
  "Service Life":
    "How long an Asset keeps operating once in place. Longer Service Life costs more.",
  Activity:
    "The one task given to an Asset, or to all the Crew at one Landing Site, for a Turn, such as soil analysis, a Survey or nothing. An Asset keeps its Activity into later Turns until the player changes it.",
  "Landing Site":
    "A named location on Mars where a Mission can land, with its own landing risk and Science value. Apart from a couple of well-known sites, they become available only through a Survey.",
  Survey:
    "Observing Mars from orbit to reveal Landing Sites and lower their landing risk. It is an Activity, and one surveying Asset is enough.",
  "Planning Mode":
    "The first part of a Turn, in which the player chooses Missions, Assets, Activities, technology and Safety Margin and spends money. No game time passes in Planning Mode.",
  "Mission Mode":
    "The graphical second part of a Turn, in which the Turn's Mission and every operating Asset and Crew play out until the next Launch Window.",
  "Save Slot":
    "One of three places where the player can keep a Program by hand, usable only in Planning Mode. It is separate from the automatic save made at the start of each Planning Mode.",
  "Decision Point":
    "A moment in Mission Mode when play pauses for the player to make a limited choice, such as aborting or using a Contingency.",
  "Mission Event":
    "A discrete, riskable step within a Mission, such as launch, Mars transfer burn, Mars orbit insertion, entry/descent/landing or rendezvous. Each one has a failure probability.",
  "Safety Margin":
    "Everything the player buys to reduce risk. It comes in three kinds (Reliability, Contingency and Protection) and costs money and sometimes mass.",
  "Risk Band":
    'A rough failure figure shown for a Mission Event or an Asset in Planning Mode, such as "~5%", in place of its exact failure probability.',
  Reliability:
    "Safety Margin that lowers the chance of a Mission Event or an Asset failing, such as testing or redundancy.",
  Contingency:
    "Safety Margin that changes the outcome when a Mission Event fails, such as an escape module or abort fuel.",
  Protection:
    "Safety Margin that reduces harm to Crew that builds up over a Mission's Duration, such as radiation shielding.",
  Hazard:
    "A random environmental danger that happens during Mission Mode, separate from planned Mission Events, such as a dust storm, a solar particle event or an asteroid strike on a base.",
  Science:
    "The Program's score. It comes from Milestones and Ongoing Research, and is weighted heavily towards activity at Mars itself.",
  Milestone:
    "A one-off achievement, such as the first orbiter at Mars or returning a sample to Earth. It awards Science and Public Support.",
  "Ongoing Research":
    "Science earned at a steady rate for as long as an Asset or Crew is actively doing it, such as analysing fresh soil samples in a lab on Mars. The rate doesn't decline over time. It also adds a small, steady amount of Public Support.",
  "Research Grant":
    "Money paid at the start of a Turn for certain Ongoing Research done in the previous Turn, at a rate set for each kind of research. Early-game research pays little or nothing, and Science from Milestones and first landings pays none.",
  "Public Support":
    "Points of public and political backing. Milestones add them, setbacks remove them, and a percentage drains away each Turn as excitement fades. Reaching a Funding Threshold pays money; falling below the Cancellation Level cancels the Program.",
  "Funding Threshold":
    "One of a fixed list of Public Support levels, each paying a fixed sum the first time it is reached. Reaching it again later pays nothing.",
  "Cancellation Level":
    "The Public Support level below which the Program is cancelled.",
  Duration:
    "How long a Mission lasts. Longer Missions use more supplies and expose Crew to more radiation.",
  "Technology Readiness":
    "How mature a technology is, from flight-proven to not yet built. Less mature technology costs more, needs development time before it can fly and fails more often until it has flown successfully.",
  Development:
    "Paying up front, in Planning Mode, to bring an immature technology to the point where it can fly. It takes a set number of Turns.",
  "Flight-proven":
    "Describes a technology that has been used successfully at least once. It is cheaper and more reliable from then on.",
} as const;

export type Term = keyof typeof tooltips;

const termsLongestFirst = (Object.keys(tooltips) as Term[]).sort(
  (first, second) => second.length - first.length,
);

/** Matches any game term in text, singular or plural, longest first so "Mission Mode" beats "Mission". */
export const termPattern = new RegExp(
  `\\b(${termsLongestFirst.join("|")})s?\\b`,
  "g",
);

/** The term a piece of matched text refers to. */
export function termFor(matched: string): Term | undefined {
  return termsLongestFirst.find(
    (term) => matched === term || matched === `${term}s`,
  );
}
