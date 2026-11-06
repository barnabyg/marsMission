import type { Catalogue } from "../catalogue/catalogue";
import { baseFundingFor } from "./baseFunding";
import { benefitImpact } from "./benefitImpact";
import { describeBenefit } from "./benefits";
import { crewAtMarsView, crewedMissionView } from "./crewView";
import { needingDevelopment, plannedDevelopment } from "./development";
import { plannedActivity, surfaceRaise } from "./missionPreviews";
import { daysUntilServiceEnds, operatingKey, type Rules } from "./rules";
import { costOf, readinessOf } from "./technologyReadiness";
import type { Program, ProgramView } from "./types";
import { upkeepOf } from "./upkeep";

/** A Program as it starts, before its first Turn. */
export function newProgram(catalogue: Catalogue, seed: number): Program {
  const { firstLaunchWindow, startingMoneyMillions, startingPublicSupport } =
    catalogue.program;
  return {
    seed,
    turnNumber: 1,
    date: firstLaunchWindow,
    moneyMillions: startingMoneyMillions,
    publicSupport: startingPublicSupport,
    science: 0,
    milestoneIds: [],
    landedSiteIds: [],
    knownLandingSiteIds: catalogue.landingSites
      .filter((site) => site.knownFromStart)
      .map((site) => site.id),
    surveyedLandingSiteIds: [],
    fundingThresholdsPaid: [],
    provenTechnologyIds: [],
    developments: [],
    operatingAssets: [],
    crew: [],
    crewActivities: {},
    crewSupplies: {},
    status: { kind: "active" },
  };
}

/** What the player sees of a Program between Turns: its standing, what is at Mars and what's on offer for a Mission. */
export function programView(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
): ProgramView {
  const { activitiesOf, activityNameOf, knownLandingSites } = rules;
  const { landingRisk, landingSiteById, riskBandFor } = rules;
  const raised = surfaceRaise(catalogue, program);
  const nextThreshold = catalogue.fundingThresholds.find(
    ({ publicSupport }) =>
      !program.fundingThresholdsPaid.includes(publicSupport),
  );
  return {
    status: program.status,
    nextFundingThreshold: nextThreshold
      ? {
          ...nextThreshold,
          // A save can already be above a level that pays when its next Turn runs.
          pointsAway: Math.max(
            0,
            nextThreshold.publicSupport - program.publicSupport,
          ),
        }
      : null,
    cancellationLevel: catalogue.program.cancellationLevel,
    baseFundingMillions: baseFundingFor(catalogue, program.publicSupport),
    turnNumber: program.turnNumber,
    date: program.date,
    moneyMillions: program.moneyMillions,
    publicSupport: program.publicSupport,
    science: program.science,
    milestones: catalogue.milestones
      .filter(({ id }) => program.milestoneIds.includes(id))
      .map(({ id, name }) => ({ id, name })),
    operatingAssets: program.operatingAssets.map((asset) => ({
      ...asset,
      key: operatingKey(asset),
      activityName: activityNameOf(asset),
      activities: catalogue.assets
        .filter(({ id }) => id === asset.assetId)
        .flatMap(activitiesOf)
        .map(
          plannedActivity(
            catalogue,
            asset.landingSiteId === null ? null : raised,
          ),
        ),
      daysLeft: Math.max(0, daysUntilServiceEnds(program.date, asset)),
      upkeepMillions: upkeepOf(catalogue, program, asset),
      landingSiteName: landingSiteById(asset.landingSiteId)?.name ?? null,
    })),
    crewedMission: crewedMissionView(catalogue, program),
    crew: crewAtMarsView(catalogue, rules, program, raised),
    developments: needingDevelopment(catalogue).map((technology) =>
      plannedDevelopment(program, technology),
    ),
    somethingLeftToSurvey: catalogue.landingSites.some(
      ({ id }) => !program.surveyedLandingSiteIds.includes(id),
    ),
    landingSites: knownLandingSites(program).map((site) => ({
      id: site.id,
      name: site.name,
      description: site.description,
      science: site.science,
      surveyed: program.surveyedLandingSiteIds.includes(site.id),
      riskBand: riskBandFor(landingRisk(program, site)),
      landed: program.landedSiteIds.includes(site.id),
    })),
    launchVehicles: catalogue.launchVehicles.map((vehicle) => ({
      id: vehicle.id,
      name: vehicle.name,
      costMillions: costOf(program, vehicle),
      capacityTonnes: vehicle.capacityTonnes,
      technologyReadiness: readinessOf(program, vehicle),
    })),
    assets: catalogue.assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      kind: asset.kind,
      costMillions: costOf(program, asset),
      massTonnes: asset.massTonnes,
      landsAtSite: asset.landsAtSite === true,
      technologyReadiness: readinessOf(program, asset),
      benefit: asset.benefit ? describeBenefit(asset.benefit) : null,
      benefitImpact: asset.benefit
        ? benefitImpact(
            catalogue,
            rules,
            program,
            asset.benefit,
            surfaceRaise(catalogue, program),
            surfaceRaise(catalogue, program, [
              { assetId: asset.id, name: asset.name },
            ]),
          )
        : null,
    })),
  };
}
