import type { Catalogue } from "../catalogue/catalogue";
import { labelsFor } from "./assetLabels";
import { baseFundingFor } from "./baseFunding";
import { describeMakes, makesPerTurn } from "./ascentPropellant";
import { describeHabitat, habitatBenefit } from "./habitats";
import { benefitImpact } from "./benefitImpact";
import { describeBenefit } from "./benefits";
import { grantImpact } from "./marsLabs";
import { crewAtMarsView, crewedMissionView } from "./crewView";
import { needingDevelopment, plannedDevelopment } from "./development";
import { plannedActivity, surfaceRaise } from "./missionPreviews";
import { daysUntilServiceEnds, operatingKey, type Rules } from "./rules";
import { sampleReturnsOf } from "./sampleReturn";
import { costOf, readinessOf } from "./technologyReadiness";
import type { Program, ProgramView } from "./types";
import { upkeepOf } from "./upkeep";

/** A Program as it starts, before its first Turn. */
export function newProgram(
  catalogue: Catalogue,
  seed: number,
  tutorial = false,
): Program {
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
    earthReturnStages: [],
    ascentPropellantKg: {},
    habitatSuppliesKg: {},
    samplesAtSites: {},
    tutorial: { kind: tutorial ? "on" : "off" },
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
  const labels = labelsFor(program.operatingAssets);
  const nextThreshold = catalogue.fundingThresholds.find(
    ({ publicSupport }) =>
      !program.fundingThresholdsPaid.includes(publicSupport),
  );
  return {
    status: program.status,
    tutorial: program.tutorial,
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
    operatingAssets: program.operatingAssets.map((asset, index) => ({
      ...asset,
      key: operatingKey(asset),
      label: labels[index] ?? asset.name,
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
      ascentPropellantKg: program.ascentPropellantKg[site.id] ?? 0,
      habitatSuppliesKg: program.habitatSuppliesKg[site.id] ?? 0,
      samples: program.samplesAtSites[site.id] ?? 0,
    })),
    sampleReturns: sampleReturnsOf(catalogue, rules, program),
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
      description: asset.description,
      costMillions: costOf(program, asset),
      massTonnes: asset.massTonnes,
      upkeepMillionsPerTurn: asset.upkeepMillionsPerTurn ?? 0,
      landsAtSite: asset.landsAtSite === true,
      technologyReadiness: readinessOf(program, asset),
      // An Asset gives a Benefit by raising something for others, by making something at its Landing Site or by housing
      // the Crew there.
      benefit: asset.benefit
        ? describeBenefit(asset.benefit)
        : asset.makes
          ? describeMakes(asset.makes)
          : asset.habitat
            ? describeHabitat(asset.habitat)
            : null,
      benefitImpact:
        asset.benefit?.raises === "surfaceResearch"
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
      grantImpact: grantImpact(catalogue, rules, program, asset),
      makes: makesPerTurn(catalogue, asset),
      habitat: habitatBenefit(catalogue, asset),
    })),
  };
}
