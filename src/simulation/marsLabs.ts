import type { Catalogue } from "../catalogue/catalogue";
import {
  labBenefitOf,
  largestRaise,
  raisesGrantsFor,
  type GrantEarner,
} from "./benefits";
import { crewAtMarsOf, crewKeyOf } from "./crewPlaces";
import { surfaceRaise } from "./missionPreviews";
import { earningsPerTurn } from "./ongoingResearch";
import { daysUntilServiceEnds, sum, type Rules } from "./rules";
import type { GrantImpact, Program } from "./types";

type Asset = Catalogue["assets"][number];
type LabBenefit = NonNullable<ReturnType<typeof labBenefitOf>>;

/**
 * What a Mars lab would add over a whole Turn at one Landing Site: the Assets and Crew there earning a Research Grant
 * it raises, as the Turn starts, and the extra money, after what labs already there raise.
 */
function impactAt(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  benefit: LabBenefit,
  landingSiteId: string,
) {
  const operating = program.operatingAssets.filter(
    (asset) =>
      asset.landingSiteId === landingSiteId &&
      daysUntilServiceEnds(program.date, asset) > 0,
  );
  const surface = surfaceRaise(catalogue, program)?.percent ?? 0;
  /** What labs at the site raise this earner's grant by now. */
  const nowFor = (earner: GrantEarner) =>
    largestRaise(
      catalogue,
      operating.filter(({ assetId }) =>
        raisesGrantsFor(labBenefitOf(catalogue, assetId), earner),
      ),
      "siteResearchGrants",
    );
  /** The extra grant over a whole Turn for one earner on this Activity, or null if it earns no grant. */
  const extraFor = (activityId: string, earner: GrantEarner) => {
    const activity = rules.activityById(activityId);
    if (!activity || !raisesGrantsFor(benefit, earner)) return null;
    const grantAt = (percent: number) =>
      earningsPerTurn(catalogue, activity, surface, percent)
        ?.researchGrantMillions ?? 0;
    const now = nowFor(earner)?.percent ?? 0;
    if (grantAt(now) <= 0) return null;
    return grantAt(Math.max(now, benefit.percent)) - grantAt(now);
  };
  const assets = operating.flatMap((asset) => {
    const extra = extraFor(asset.activityId, { assetKind: asset.kind });
    return extra === null ? [] : [extra];
  });
  const place = { kind: "landingSite", landingSiteId } as const;
  const key = crewKeyOf(place);
  const members = crewAtMarsOf(program).filter(
    ({ location }) => crewKeyOf(location) === key,
  ).length;
  const crewExtra =
    members > 0 ? extraFor(program.crewActivities[key] ?? "", "crew") : null;
  const now = largestRaise(catalogue, operating, "siteResearchGrants");
  return {
    landingSiteName: rules.landingSiteById(landingSiteId)?.name ?? null,
    assets: assets.length,
    crew: crewExtra === null ? 0 : members,
    extraGrantMillions: sum(assets) + (crewExtra ?? 0) * members,
    alreadyGivenBy: now && now.percent >= benefit.percent ? now.givenBy : [],
  };
}

/**
 * What a Mars lab would add this Turn, for its Benefit tag: at the Landing Site where it would add the most money
 * over a whole Turn, going by the Assets and Crew there as the Turn starts. Null if this Asset isn't a Mars lab.
 */
export function grantImpact(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  asset: Asset,
): GrantImpact | null {
  const benefit = labBenefitOf(catalogue, asset.id);
  if (!benefit) return null;
  const siteIds = new Set([
    ...program.operatingAssets.flatMap(({ landingSiteId }) =>
      landingSiteId === null ? [] : [landingSiteId],
    ),
    ...crewAtMarsOf(program).flatMap(({ location }) =>
      location.kind === "landingSite" ? [location.landingSiteId] : [],
    ),
  ]);
  const [best] = [...siteIds]
    .map((siteId) => impactAt(catalogue, rules, program, benefit, siteId))
    .filter(({ assets, crew }) => assets + crew > 0)
    .toSorted(
      (first, second) =>
        second.extraGrantMillions - first.extraGrantMillions ||
        second.assets + second.crew - (first.assets + first.crew),
    );
  return (
    best ?? {
      landingSiteName: null,
      assets: 0,
      crew: 0,
      extraGrantMillions: 0,
      alreadyGivenBy: [],
    }
  );
}
