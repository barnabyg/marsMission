import type { Catalogue } from "../catalogue/catalogue";
import type { AssetInService } from "./assetsInService";
import { earningsOfStay, surfaceResearchRaised } from "./ongoingResearch";
import type { Stretch } from "./benefits";
import {
  formatMoney,
  operatingKey,
  roll,
  sum,
  type LandingSite,
  type Rules,
} from "./rules";
import type {
  DecisionAnswers,
  DecisionPoint,
  Program,
  TurnSummary,
} from "./types";
import type { DecisionPointEntry, HazardEntry, Timeline } from "./timeline";

export interface DustStorm {
  site: LandingSite;
  /** The day it starts, which is never the Turn's first. */
  fromDay: number;
  /** The first day that's clear again, which is always within the Turn. */
  toDay: number;
}

/**
 * The dust storm over a Landing Site this Turn, if there is one. Whether it happens, when and for how long depend
 * only on the seed, the Turn and that site's rolls, so no plan or answer can move it.
 */
export function dustStormOver(
  catalogue: Catalogue,
  program: Program,
  site: LandingSite,
): DustStorm | null {
  const { chancePerSitePerTurn, minDays, maxDays } =
    catalogue.hazards.dustStorm;
  const { launchWindowIntervalDays } = catalogue.program;
  const key = `dust-storm:${site.id}`;
  const rolled = (part: string) =>
    roll(program.seed, program.turnNumber, `${key}:${part}`);
  if (rolled("happens") >= chancePerSitePerTurn) return null;
  const days = minDays + Math.floor(rolled("days") * (maxDays - minDays + 1));
  const fromDay =
    1 + Math.floor(rolled("day") * (launchWindowIntervalDays - days - 1));
  return { site, fromDay, toDay: fromDay + days };
}

const decisionIdOf = (site: LandingSite) => `dust-storm:${site.id}`;

/** What sheltering gives up, in the player's terms, for the Assets at stake, at the raised rate where a Benefit raises it. */
function whatSheltering(
  catalogue: Catalogue,
  rules: Rules,
  atStake: AssetInService[],
  { fromDay, toDay }: DustStorm,
  raised: Stretch[],
): string {
  const given = atStake.map((stay) => {
    const full = earningsOfStay(catalogue, rules, stay, raised).earned;
    const less = earningsOfStay(
      catalogue,
      rules,
      { ...stay, shelter: { fromDay, toDay } },
      raised,
    ).earned;
    return {
      science: full.science - less.science,
      publicSupport: full.publicSupport - less.publicSupport,
      grantMillions: full.grantMillions - less.grantMillions,
    };
  });
  const science = sum(given.map((part) => part.science));
  const publicSupport = sum(given.map((part) => part.publicSupport));
  const grantMillions = sum(given.map((part) => part.grantMillions));
  if (science === 0 && publicSupport === 0)
    return "nothing, as none is doing research";
  return `${science} Science, ${publicSupport} Public Support and ${formatMoney(grantMillions)} of Research Grants`;
}

/**
 * Works out each dust storm over a known Landing Site. One raises a Decision Point only if an Asset is operating
 * there when it starts. One with no answer yet counts as sheltering, and `decision` is the earliest of those.
 */
export function resolveDustStorms(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  operating: AssetInService[],
  answers: DecisionAnswers,
): {
  inService: AssetInService[];
  entries: (HazardEntry | DecisionPointEntry)[];
  decision: { decisionPoint: DecisionPoint; entry: DecisionPointEntry } | null;
  summary: TurnSummary["dustStorms"];
  storms: Timeline["dustStorms"];
} {
  const { name, failureChance, description } = catalogue.hazards.dustStorm;
  const storms = rules
    .knownLandingSites(program)
    .flatMap((site) => dustStormOver(catalogue, program, site) ?? [])
    .sort((first, second) => first.fromDay - second.fromDay);
  let inService = operating;
  // Only Assets on the surface shelter, so a dust storm never changes what raises them.
  const raised = surfaceResearchRaised(catalogue, operating);
  const entries: (HazardEntry | DecisionPointEntry)[] = [];
  const summary: TurnSummary["dustStorms"] = [];
  let decision: {
    decisionPoint: DecisionPoint;
    entry: DecisionPointEntry;
  } | null = null;

  for (const storm of storms) {
    const { site, fromDay, toDay } = storm;
    const days = toDay - fromDay;
    const told = description
      .replaceAll("{site}", site.name)
      .replaceAll("{days}", String(days));
    const atStake = inService.filter(
      ({ asset, fromDay: from, untilDay }) =>
        asset.landingSiteId === site.id &&
        from < fromDay &&
        (untilDay === null || untilDay > fromDay),
    );
    if (atStake.length === 0) {
      entries.push({
        kind: "hazard",
        hazard: "dustStorm",
        day: fromDay,
        title: `${name} over ${site.name}`,
        description: `${told} Nothing is operating there.`,
      });
      continue;
    }

    const names = atStake.map(({ asset }) => asset.name);
    const entry: DecisionPointEntry = {
      kind: "decisionPoint",
      hazard: "dustStorm",
      siteName: site.name,
      day: fromDay,
      title: `${name} over ${site.name}: Decision Point`,
      description: told,
    };
    const answer = answers[decisionIdOf(site)];
    if (answer === undefined) {
      decision ??= {
        entry,
        decisionPoint: {
          id: decisionIdOf(site),
          kind: "dustStorm",
          day: fromDay,
          title: `${name} over ${site.name}`,
          description: `${told} Operating there: ${names.join(", ")}.`,
          assets: names,
          siteName: site.name,
          choices: [
            {
              answer: "shelter",
              label: "Shelter",
              riskBand: null,
              description: `Sheltering keeps ${names.join(", ")} safe, but nothing there earns Ongoing Research for the storm's ${days} days. That gives up ${whatSheltering(catalogue, rules, atStake, storm, raised)}.`,
            },
            {
              answer: "carryOn",
              label: "Carry on",
              riskBand: rules.riskBandFor(failureChance),
              description: `Carrying on keeps the research going, and each Asset there has this chance of failing for good during the storm.`,
            },
          ],
        },
      };
    } else {
      entries.push(entry);
    }

    const carriesOn = answer === "carryOn";
    const failedHere: string[] = [];
    inService = inService.map((stay) => {
      if (!atStake.includes(stay)) return stay;
      if (!carriesOn) return { ...stay, shelter: { fromDay, toDay } };
      const key = `dust-storm:${site.id}:${operatingKey(stay.asset)}`;
      const failed =
        roll(program.seed, program.turnNumber, key) < failureChance;
      if (!failed) return stay;
      const day =
        fromDay +
        Math.floor(roll(program.seed, program.turnNumber, `${key}:day`) * days);
      if (stay.untilDay !== null && stay.untilDay <= day) return stay;
      failedHere.push(stay.asset.name);
      return {
        ...stay,
        untilDay: day,
        failed: true,
        failedInStormAt: site.name,
      };
    });
    if (answer === undefined) continue;

    summary.push({
      siteName: site.name,
      days,
      answer: carriesOn ? "carryOn" : "shelter",
      assets: names,
      assetsFailed: failedHere,
    });
    entries.push(
      {
        kind: "hazard",
        hazard: "dustStorm",
        day: fromDay,
        title: carriesOn
          ? `Carrying on through the storm at ${site.name}`
          : `Sheltering from the storm at ${site.name}`,
        description: carriesOn
          ? `Work carries on at ${site.name}, at the risk of losing ${names.join(", ")}.`
          : `Work stops at ${site.name} until the storm has passed.`,
      },
      {
        kind: "hazard",
        hazard: "dustStorm",
        day: toDay,
        title: `Storm over ${site.name} has passed`,
        description:
          failedHere.length > 0
            ? `Lost to it: ${failedHere.join(", ")}.`
            : `It lasted ${days} days.`,
      },
    );
  }
  return {
    inService,
    entries,
    decision,
    summary,
    storms: storms.map(({ site, fromDay, toDay }) => ({
      siteName: site.name,
      fromDay,
      toDay,
    })),
  };
}
