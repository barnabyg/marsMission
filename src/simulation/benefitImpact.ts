import type { Catalogue } from "../catalogue/catalogue";
import type { Raise } from "./benefits";
import { crewAtMarsView } from "./crew";
import { earningsPerTurn } from "./ongoingResearch";
import { daysUntilServiceEnds, type Rules } from "./rules";
import type { BenefitImpact, Program } from "./types";

type Benefit = NonNullable<Catalogue["assets"][number]["benefit"]>;

/**
 * The Assets and Crew doing research on the surface as the Turn starts, and the Science they earn over a whole Turn
 * with their research raised by this.
 */
function surfaceResearch(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  raise: Raise | null,
) {
  const assets = program.operatingAssets
    .filter(
      (asset) =>
        asset.landingSiteId !== null &&
        daysUntilServiceEnds(program.date, asset) > 0,
    )
    .flatMap((asset) => {
      const activity = catalogue.activities.find(
        ({ id }) => id === asset.activityId,
      );
      const earns =
        activity && earningsPerTurn(catalogue, activity, raise?.percent);
      return earns ? [earns.science] : [];
    });
  const crew = crewAtMarsView(catalogue, rules, program, raise)
    .filter(({ landingSiteId }) => landingSiteId !== null)
    .flatMap(({ activityId, activities, members }) => {
      const earns = activities.find(
        ({ id }) => id === activityId,
      )?.earnsPerTurn;
      return earns ? [{ science: earns.science, members: members.length }] : [];
    });
  return {
    assets: assets.length,
    crew: crew.reduce((total, { members }) => total + members, 0),
    science:
      assets.reduce((total, science) => total + science, 0) +
      crew.reduce((total, { science }) => total + science, 0),
  };
}

/**
 * What an Asset's Benefit would add to the research on the surface as the Turn starts, given what raises it now and
 * what would raise it with that Asset operating too.
 */
export function benefitImpact(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  benefit: Benefit,
  now: Raise | null,
  withIt: Raise | null,
): BenefitImpact {
  const before = surfaceResearch(catalogue, rules, program, now);
  const after = surfaceResearch(catalogue, rules, program, withIt);
  return {
    assets: before.assets,
    crew: before.crew,
    extraScience: after.science - before.science,
    alreadyGivenBy: now && now.percent >= benefit.percent ? now.givenBy : [],
  };
}
