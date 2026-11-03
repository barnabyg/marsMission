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
    "The vehicle chosen from the catalogue to lift a Mission off Earth. It sets how much mass the Mission can carry.",
  "Orbital refuelling":
    "Filling a Mission's tanks in Earth orbit from a Tanker, so that a larger Launch Vehicle can send much more mass to Mars. It adds two Mission Events between launch and the Mars transfer burn: the Tanker's launch and the Rendezvous.",
  Tanker:
    "A second launch for a Mission that needs Orbital refuelling, carrying only propellant up to it in Earth orbit. Its launch is a Mission Event of its own.",
  Rendezvous:
    "The Mission Event in which a Mission meets its Tanker in Earth orbit, docks and takes on propellant for the journey to Mars.",
  Trajectory:
    "The way a Mission travels to Mars, chosen from a few fixed options such as Slow, Fast or Free-return. It trades fuel and mass against Duration and safety.",
  "Robotic Mission":
    "A Mission with no crew aboard. It is cheaper than a Crewed Mission and risks only hardware and money.",
  "Crewed Mission":
    "A Mission carrying Crew. It costs much more than a Robotic Mission and earns more Public Support, and failure can cost lives.",
  Precursor:
    "A Robotic Mission whose main value is lowering the risk or cost of later Missions, for example by surveying landing sites.",
  Crew: "The named astronauts on a Crewed Mission. Apart from their names and Health, they have no individual traits.",
  "Crew size":
    "How many Crew fly on a Crewed Mission, chosen in Planning Mode. A larger Crew earns more Ongoing Research, but weighs and costs more.",
  Health:
    "A single value for each Crew member. Radiation, time at Mars and failed Mission Events lower it, Protection slows the decline, and at zero the Crew member dies.",
  Supplies:
    "The food, water and everything else Crew use up to stay alive. When they run out, Health falls quickly.",
  Asset:
    "A pre-designed piece of hardware chosen from a catalogue, such as an orbiter, lander, rover, drone, habitat or fuel plant. Assets remain in place and keep working after their Mission until their Service Life ends or they fail.",
  "Service Life":
    "How long an Asset keeps operating once in place. Longer Service Life costs more.",
  Benefit:
    "What one Asset does for others on each day it operates at Mars, whatever its Activity, such as a relay orbiter raising the Ongoing Research of every Asset on the surface. A second Asset giving the same Benefit adds nothing.",
  Activity:
    "What an Asset, or all the Crew in one place at Mars, is given to do for a Turn, such as soil analysis, a Survey or nothing. An Asset or Crew keep their Activity into later Turns until the player changes it.",
  "Landing Site":
    "A named place on Mars where a Mission can land, with its own landing risk and Science value. Apart from a couple of well-known sites, they become available only through a Survey.",
  Survey:
    "Observing Mars from orbit to reveal Landing Sites and lower their landing risk. It is an Activity, and one surveying Asset is enough.",
  "Orbital research":
    "An Activity for an orbiter: Ongoing Research into the atmosphere and climate of Mars, in place of a Survey. It pays no Research Grant.",
  "Surface research":
    "An Activity for a lander: Ongoing Research into the rocks and weather around its Landing Site. It pays a small Research Grant.",
  "Soil analysis":
    "An Activity for a rover: Ongoing Research that stays near the Landing Site and analyses soil samples. It earns less Science than a Long traverse and pays a Research Grant.",
  "Long traverse":
    "An Activity for a rover: Ongoing Research that drives long distances around the Landing Site. It earns more Science than Soil analysis and pays no Research Grant.",
  "Crew research":
    "An Activity for Crew in Mars orbit: Ongoing Research from orbit, such as studying Mars, driving robots on the surface from above and running experiments aboard. Each Crew member earns it, and it pays a Research Grant.",
  "Planning Mode":
    "The first part of a Turn, in which the player chooses Missions, Assets, Activities, technology and Safety Margin and spends money. No game time passes in Planning Mode.",
  "Mission Mode":
    "The graphical second part of a Turn, in which the Turn's Mission and every operating Asset and Crew play out until the next Launch Window.",
  "Save Slot":
    "One of three places where the player can keep a Program by hand, usable only in Planning Mode. It is separate from the automatic save made at the start of each Planning Mode.",
  "Decision Point":
    "A moment in Mission Mode when play pauses for the player to make a limited choice, such as aborting or using a Contingency.",
  "Go/no-go check":
    "A Decision Point before a landing due while a dust storm is over its Landing Site: go ahead at a raised risk, or hold off until the storm has passed, at a cost in Service Life.",
  "Mission Event":
    "A discrete, riskable event within a Mission, such as launch, Mars transfer burn, Mars orbit insertion, entry/descent/landing or rendezvous. Each one has a failure probability.",
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
  "Dust storm":
    "A Hazard: a storm over one Landing Site for a stretch of days. If an Asset is operating there when it starts, the player chooses between sheltering, which earns no Ongoing Research for those days, and carrying on, with a chance of each Asset failing.",
  "Solar particle event":
    "A Hazard: a burst of radiation from the Sun that hits a Mission on its way to Mars, more likely the longer its Duration. The player chooses between safe mode, which costs each Asset on board some Service Life, and carrying on, with a chance of damage that costs much more or loses the Mission.",
  Science:
    "The Program's score. It comes from Milestones and Ongoing Research, and is weighted heavily towards activity at Mars itself.",
  Milestone:
    "A one-off reward for a feat, such as the first orbiter at Mars, reaching a total of Science, or returning a sample to Earth. It awards Science and Public Support.",
  "Ongoing Research":
    "Science earned at a steady rate for as long as an Asset or Crew is actively doing it, such as analysing fresh soil samples in a lab on Mars. The rate doesn't decline over time. It also adds a small, steady amount of Public Support.",
  "Research Grant":
    "Money paid at the start of a Turn for certain Ongoing Research done in the previous Turn, at a rate set for each kind of research. Early-game research pays little or nothing, and Science from Milestones and first landings pays none.",
  "Public Support":
    "Points of public and political backing. Milestones and Ongoing Research add them, setbacks remove them, and a percentage drains away each Turn as excitement fades. Reaching a Funding Threshold pays money; falling below the Cancellation Level cancels the Program.",
  "Funding Threshold":
    "One of a fixed list of Public Support figures, each paying a fixed sum the first time it is reached. Reaching it again later pays nothing.",
  "Cancellation Level":
    "The Public Support level below which the Program is cancelled.",
  Duration:
    "How long a Mission lasts. Longer Missions use more supplies and expose Crew to more radiation.",
  "Technology Readiness":
    "How mature a technology is: Flight-proven, built but unproven, or not yet built, when it needs Development before it can fly. Until it is Flight-proven, it costs more and fails more often.",
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
