import type { Catalogue } from "../catalogue/catalogue";
import { deliveryDayOf } from "./flyMission";
import {
  addDays,
  daysUntilServiceEnds,
  operatingKey,
  roll,
  type Asset,
  type LandingSite,
  type Rules,
} from "./rules";
import type { Program, TurnPlan } from "./types";
import type {
  AssetEndedEntry,
  AssetFailedEntry,
  SurveyEntry,
} from "./timeline";

/** One Asset's time at Mars during this Turn. */
export interface AssetInService {
  asset: Program["operatingAssets"][number];
  /** The day of the Turn it starts operating, which is 0 if it already was. */
  fromDay: number;
  /** The day of the Turn it stops, or null if it lasts beyond the Turn. */
  untilDay: number | null;
  /** Whether it stopped by failing, rather than its Service Life ending. */
  failed: boolean;
  /** The Landing Site of the dust storm it failed in, if that's how it stopped. */
  failedInStormAt?: string;
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
  const chance = rules.inServiceFailureChance(design, level);
  if (roll(program.seed, program.turnNumber, key) >= chance) return null;
  const dayRoll = roll(program.seed, program.turnNumber, `${key}:day`);
  return 1 + Math.floor(dayRoll * (limitDay - 1));
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
    },
    fromDay: deliveryDayOf(rules, plan, flown, asset),
  }));
  return [
    ...program.operatingAssets.map((asset) => ({
      asset: {
        ...asset,
        activityId:
          plan.operatingActivities?.[operatingKey(asset)] ?? asset.activityId,
      },
      fromDay: 0,
    })),
    ...delivered,
  ].map(({ asset, fromDay }): AssetInService => {
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
      ? { asset, fromDay, untilDay, failed: false }
      : { asset, fromDay, untilDay: failureDay, failed: true };
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
      untilDay,
      failed,
      failedInStormAt,
    }): (AssetEndedEntry | AssetFailedEntry)[] => {
      if (untilDay === null) return [];
      const site = rules.landingSiteById(asset.landingSiteId)?.name;
      const place = site ? `at ${site}` : "at Mars";
      if (failed) {
        const entry: AssetFailedEntry = {
          kind: "assetFailed",
          day: untilDay,
          title: `${asset.name} failed`,
          description: failedInStormAt
            ? `The dust storm over ${failedInStormAt} was too much for ${asset.name}, which has stopped operating. It costs no Public Support.`
            : `${asset.name} has broken down and stopped operating ${place}. It costs no Public Support.`,
        };
        return [entry];
      }
      const entry: AssetEndedEntry = {
        kind: "assetEnded",
        day: untilDay,
        title: `${asset.name}: Service Life ended`,
        description: `${asset.name} has stopped operating ${place}. It costs no Public Support.`,
      };
      return [entry];
    },
  );
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

  const newlySurveyed = program.knownLandingSiteIds.filter(
    (id) => !program.surveyedLandingSiteIds.includes(id),
  );
  const revealed = catalogue.landingSites.find(
    (site) => !program.knownLandingSiteIds.includes(site.id),
  );
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
