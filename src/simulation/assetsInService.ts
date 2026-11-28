import { deliveryDayOf, type MissionOutcome } from "./flight";
import { labelsFor } from "./assetLabels";
import type { Catalogue } from "../catalogue/catalogue";
import {
  addDays,
  daysBetween,
  daysUntilServiceEnds,
  operatingKey,
  roll,
  type Asset,
  type LandingSite,
  type Rules,
} from "./rules";
import { homewardPurchase } from "./earthReturnStages";
import { isFlightProven } from "./technologyReadiness";
import type { Program, TurnPlan } from "./types";
import type {
  AssetAtMars,
  AssetEndedEntry,
  AssetFailedEntry,
  SurveyEntry,
} from "./timeline";

/** One Asset's time at Mars during this Turn. */
export interface AssetInService {
  asset: Program["operatingAssets"][number];
  /** How the screen names it, numbered in arrival order when several of its kind are at Mars, as Operating at Mars does. */
  label: string;
  /** The day of the Turn it starts operating, which is 0 if it already was. */
  fromDay: number;
  /** The day of the Turn it stops, or null if it lasts beyond the Turn. */
  untilDay: number | null;
  /** Whether it stopped by failing, rather than its Service Life ending. */
  failed: boolean;
  /** The Landing Site of the dust storm it failed in, if that's how it stopped. */
  failedInStormAt?: string;
  /** Whether it stopped by leaving Mars, flying samples home, rather than its Service Life ending. */
  leftForHome?: true;
  /** When it sheltered from a dust storm and so earned nothing, if it did. */
  shelter?: { fromDay: number; toDay: number };
}

/**
 * The day an already operating Asset fails this Turn, if it does. Each roll depends only on the seed,
 * the Turn and this Asset, and the day comes before `limitDay`, when its time in this Turn ends anyway.
 */
function inServiceFailureDay(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  asset: Program["operatingAssets"][number],
  limitDay: number,
): number | null {
  const design = catalogue.assets.find(({ id }) => id === asset.assetId);
  const level = catalogue.reliabilityLevels.find(
    ({ id }) => id === asset.reliabilityLevelId,
  );
  // An Asset with no time left in this Turn has nothing to fail in.
  if (!design || !level || limitDay <= 1) return null;
  const key = `in-service:${asset.assetId}:${asset.arrivedOn}`;
  const chance = rules.inServiceFailureChance(
    design,
    level,
    asset.flewUnproven,
  );
  if (roll(program.seed, program.turnNumber, key) >= chance) return null;
  const dayRoll = roll(program.seed, program.turnNumber, `${key}:day`);
  return 1 + Math.floor(dayRoll * (limitDay - 1));
}

/**
 * How the Turn names each Asset at Mars, numbered among those of its kind there as the Turn starts and every one the
 * Mission is sending, whether or not it gets there. So the names don't change with how a Decision Point is answered,
 * and those already there keep the numbers Operating at Mars showed them with, as they arrived first.
 */
function turnLabels(
  catalogue: Catalogue,
  program: Program,
  plan: TurnPlan,
): { there: string[]; sent: Map<string, string> } {
  const sending = (plan.mission?.assetIds ?? []).map((assetId) => ({
    assetId,
    name: catalogue.assets.find(({ id }) => id === assetId)?.name ?? assetId,
    // After all those there now, whenever it arrives.
    arrivedOn: "￿",
  }));
  const there = program.operatingAssets.length;
  const labels = labelsFor([...program.operatingAssets, ...sending]);
  return {
    there: labels.slice(0, there),
    // Only one of each Asset flies on a Mission.
    sent: new Map(
      sending.map(({ assetId, name }, index) => [
        assetId,
        labels[there + index] ?? name,
      ]),
    ),
  };
}

/** Works out when each Asset at Mars stops operating this Turn, because its Service Life has ended or it has failed. */
export function operateAssets(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  plan: TurnPlan,
  flown: {
    deliveredAssets: Asset[];
    landingSite: LandingSite | undefined;
    cutServiceLife: Map<Asset, number>;
    heldLanding: { eventId: string; days: number } | null;
  },
): AssetInService[] {
  const { launchWindowIntervalDays } = catalogue.program;
  const delivered = flown.deliveredAssets.map((asset) => ({
    asset: {
      assetId: asset.id,
      name: asset.name,
      kind: asset.kind,
      arrivedOn: addDays(
        program.date,
        deliveryDayOf(rules, plan, flown, asset),
      ),
      landingSiteId: asset.landsAtSite ? (flown.landingSite?.id ?? null) : null,
      serviceLifeDays:
        flown.cutServiceLife.get(asset) ??
        rules.serviceLifeFor(plan.mission, asset).days,
      reliabilityLevelId: rules.assetReliabilityFor(plan.mission, asset).id,
      activityId: rules.activityFor(plan.mission, asset).id,
      flewUnproven: !isFlightProven(program, asset),
      // An ascent vehicle or an Earth return orbiter keeps what its Mission bought for sending samples home.
      ...(asset.sampleReturn
        ? {
            homeward: homewardPurchase(
              rules,
              plan.mission,
              rules.sampleReturnEventsOf(asset),
            ),
          }
        : {}),
    },
    fromDay: deliveryDayOf(rules, plan, flown, asset),
  }));
  const all = [
    ...program.operatingAssets.map((asset) => ({
      asset: {
        ...asset,
        activityId:
          plan.operatingActivities?.[operatingKey(asset)] ?? asset.activityId,
      },
      fromDay: 0,
    })),
    ...delivered,
  ];
  const labels = turnLabels(catalogue, program, plan);
  return all.map(({ asset, fromDay }, index): AssetInService => {
    const label =
      (fromDay === 0 && index < labels.there.length
        ? labels.there[index]
        : labels.sent.get(asset.assetId)) ?? asset.name;
    const endDay = daysUntilServiceEnds(program.date, asset);
    // An upgraded save can hold an Asset whose Service Life has already passed. It ends as the Turn starts.
    const untilDay =
      endDay < launchWindowIntervalDays ? Math.max(endDay, 0) : null;
    // An Asset can't fail in the Turn it arrives.
    const failureDay =
      fromDay === 0
        ? inServiceFailureDay(
            catalogue,
            rules,
            program,
            asset,
            untilDay ?? launchWindowIntervalDays,
          )
        : null;
    return failureDay === null
      ? { asset, label, fromDay, untilDay, failed: false }
      : { asset, label, fromDay, untilDay: failureDay, failed: true };
  });
}

/** The entry for each Asset that stops operating this Turn, however it does. */
export function stoppedEntries(
  rules: Rules,
  inService: AssetInService[],
): (AssetEndedEntry | AssetFailedEntry)[] {
  return inService.flatMap(
    ({
      asset,
      label,
      untilDay,
      failed,
      failedInStormAt,
      leftForHome,
    }): (AssetEndedEntry | AssetFailedEntry)[] => {
      // The journey home says when it left.
      if (untilDay === null || leftForHome) return [];
      const site = rules.landingSiteById(asset.landingSiteId)?.name;
      const place = site ? `at ${site}` : "at Mars";
      if (failed) {
        const entry: AssetFailedEntry = {
          kind: "assetFailed",
          day: untilDay,
          title: `${label} failed`,
          description: failedInStormAt
            ? `The dust storm over ${failedInStormAt} was too much for ${label}, which has stopped operating. It costs no Public Support.`
            : `${label} has broken down and stopped operating ${place}. It costs no Public Support.`,
        };
        return [entry];
      }
      const entry: AssetEndedEntry = {
        kind: "assetEnded",
        day: untilDay,
        title: `${label}: Service Life ended`,
        description: `${label} has stopped operating ${place}. It costs no Public Support.`,
      };
      return [entry];
    },
  );
}

/**
 * What a Survey would find as things stand: the known sites not yet surveyed, which drop to their surveyed risk, and
 * the next site in the catalogue, which becomes known and is surveyed as it's found. Planning Mode's preview of a
 * Survey (`surveyOutlook`) reads it too, so that what it promises is what happens.
 */
export function surveyFindings(catalogue: Catalogue, program: Program) {
  return {
    newlySurveyed: program.knownLandingSiteIds.filter(
      (id) => !program.surveyedLandingSiteIds.includes(id),
    ),
    revealed: catalogue.landingSites.find(
      (site) => !program.knownLandingSiteIds.includes(site.id),
    ),
  };
}

/**
 * Carries out the Turn's Survey, if an Asset operating at Mars has a survey Activity during it. Every known site
 * drops to its surveyed risk in one step, and the next site in the catalogue becomes known.
 */
export function carryOutSurvey(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  inService: AssetInService[],
) {
  // An Asset counts if it operated at any point in the Turn, however briefly.
  const surveyDays = inService
    .filter(
      ({ asset, fromDay, untilDay }) =>
        rules.activityById(asset.activityId)?.effect.kind === "survey" &&
        (untilDay === null || untilDay > fromDay),
    )
    .map(({ fromDay }) => fromDay);
  const unchanged = {
    knownLandingSiteIds: program.knownLandingSiteIds,
    surveyedLandingSiteIds: program.surveyedLandingSiteIds,
    entry: null,
    summary: null,
  };
  if (surveyDays.length === 0) return unchanged;

  const { newlySurveyed, revealed } = surveyFindings(catalogue, program);
  if (newlySurveyed.length === 0 && !revealed) return unchanged;

  const knownLandingSiteIds = [
    ...program.knownLandingSiteIds,
    ...(revealed ? [revealed.id] : []),
  ];
  const namesSurveyed = newlySurveyed.flatMap(
    (id) => rules.landingSiteById(id)?.name ?? [],
  );
  const findings = [
    ...(namesSurveyed.length > 0
      ? [`Lower landing risk at ${namesSurveyed.join(", ")}.`]
      : []),
    ...(revealed ? [`A new Landing Site is known: ${revealed.name}.`] : []),
  ];
  const entry: SurveyEntry = {
    kind: "survey",
    day: Math.min(...surveyDays),
    title: "Survey from orbit",
    description: findings.join(" "),
  };
  return {
    knownLandingSiteIds,
    surveyedLandingSiteIds: knownLandingSiteIds,
    entry,
    summary: {
      siteNamesSurveyed: namesSurveyed,
      siteNameRevealed: revealed?.name ?? null,
    },
  };
}

/** The Assets at Mars this Turn as Mission Mode shows them, with the Service Life that something on the way cut short for those arriving. */
export function assetsAtMarsOnTimeline(
  rules: Rules,
  program: Program,
  inService: AssetInService[],
  flown: Pick<MissionOutcome, "cutServiceLife">,
): AssetAtMars[] {
  const cutServiceLife = new Map(
    [...flown.cutServiceLife].map(([asset, days]) => [asset.id, days]),
  );
  return inService.map(
    ({ asset, label, fromDay, untilDay, shelter }): AssetAtMars => {
      const cutServiceLifeDays =
        fromDay > 0 ? cutServiceLife.get(asset.assetId) : undefined;
      return {
        key: operatingKey(asset),
        name: asset.name,
        label,
        kind: asset.kind,
        landingSiteName:
          rules.landingSiteById(asset.landingSiteId)?.name ?? null,
        activityName: rules.activityNameOf(asset),
        surfaceMotion: rules.surfaceMotionOf(asset),
        arrivedOnDay: daysBetween(program.date, asset.arrivedOn),
        fromDay,
        untilDay,
        ...(cutServiceLifeDays === undefined ? {} : { cutServiceLifeDays }),
        ...(shelter ? { shelter } : {}),
      };
    },
  );
}
