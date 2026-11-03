import {
  everyTechnology,
  type ProgramView,
  type Timeline,
  type TurnSummary,
} from "../simulation/simulation";
import { sum } from "./sum";

/** Anything impossible about one Turn, read from the Program before it, its summary and the Program after it. */
export function invalidStates(
  before: ProgramView,
  summary: TurnSummary,
  after: ProgramView,
): string[] {
  const thresholdMillions = sum(
    summary.fundingPayouts.map(({ payoutMillions }) => payoutMillions),
  );
  const belowCancellationLevel = after.publicSupport < after.cancellationLevel;
  const milestoneIds = after.milestones.map(({ id }) => id);
  const siteIds = after.landingSites.map(({ id }) => id);
  const flightProven = (view: ProgramView) =>
    everyTechnology(view)
      .filter(
        ({ technologyReadiness }) => technologyReadiness === "flight-proven",
      )
      .map(({ name }) => name);
  const provenBefore = flightProven(before);
  const provenAfter = flightProven(after);
  const newlyProven = provenAfter
    .filter((name) => !provenBefore.includes(name))
    .toSorted();
  const development = developmentProblems(before, summary, after);
  const checks: [impossible: boolean, problem: string][] = [
    [
      before.status.kind !== "active",
      `A ${before.status.kind} Program played another Turn.`,
    ],
    [
      after.turnNumber !== before.turnNumber + 1,
      "The Turn number didn't go up by one.",
    ],
    [after.moneyMillions < 0, `Money fell to ${after.moneyMillions}.`],
    [
      summary.moneyStartMillions !== before.moneyMillions,
      "moneyStartMillions doesn't match the Program's money before the Turn.",
    ],
    [
      summary.moneyEndMillions !== after.moneyMillions,
      "moneyEndMillions doesn't match the next Program's money.",
    ],
    [
      summary.moneyStartMillions -
        summary.missionCostMillions -
        summary.developmentCostMillions +
        thresholdMillions +
        summary.researchGrantMillions +
        (summary.failure?.refundMillions ?? 0) !==
        summary.moneyEndMillions,
      "The Turn's money doesn't add up.",
    ],
    [
      sum(summary.researchGrants.map(({ millions }) => millions)) !==
        summary.researchGrantMillions,
      "researchGrantMillions isn't the total of researchGrants.",
    ],
    [
      after.science < before.science,
      `Science fell from ${before.science} to ${after.science}.`,
    ],
    [
      before.science + summary.scienceGained !== after.science,
      "scienceGained doesn't match the next Program's Science.",
    ],
    [
      !Number.isInteger(after.publicSupport) || after.publicSupport < 0,
      `Public Support is out of range at ${after.publicSupport}.`,
    ],
    [
      summary.publicSupportStart !== before.publicSupport ||
        summary.publicSupportEnd !== after.publicSupport,
      "The summary's Public Support doesn't match the Programs either side of it.",
    ],
    [
      summary.publicSupportStart +
        summary.publicSupportGained -
        (summary.failure?.publicSupportLost ?? 0) -
        summary.publicSupportDrained !==
        summary.publicSupportEnd,
      "The Turn's Public Support doesn't add up.",
    ],
    [
      belowCancellationLevel !== (after.status.kind === "cancelled"),
      `A Program at ${after.publicSupport} Public Support has the status ${after.status.kind}.`,
    ],
    [
      (summary.cancellationReason !== null) !==
        (after.status.kind === "cancelled"),
      "The summary's cancellation doesn't match the Program's status.",
    ],
    [
      new Set(milestoneIds).size < milestoneIds.length ||
        before.milestones.some(({ id }) => !milestoneIds.includes(id)),
      "A Milestone was awarded twice or lost.",
    ],
    [
      summary.failure !== null &&
        !summary.failure.returnedToEarth &&
        summary.failure.refundMillions !== 0,
      "A Mission that didn't come back was refunded.",
    ],
    [
      summary.contingencies.some(
        ({ rescued, assets }) => !rescued && assets.length > 0,
      ),
      "A Contingency that didn't work saved some Assets.",
    ],
    [
      summary.contingencies.some(({ answer, rescued }) => {
        return answer === "decline" && rescued;
      }),
      "A Contingency that was declined saved something.",
    ],
    [
      summary.contingencies
        .flatMap(({ assets }) => assets)
        .some(({ serviceLifeDays }) => serviceLifeDays <= 0),
      "A Contingency left an Asset with no Service Life.",
    ],
    [
      summary.failure !== null &&
        summary.contingencies.some(
          ({ missionEventName, rescued }) =>
            rescued && missionEventName === summary.failure?.missionEventName,
        ),
      "A Mission Event both failed and was saved.",
    ],
    [
      summary.dustStorms.some(
        ({ answer, assetsFailed }) =>
          answer === "shelter" && assetsFailed.length > 0,
      ),
      "An Asset failed while it sheltered from a dust storm.",
    ],
    [
      summary.dustStorms
        .flatMap(({ assetsFailed }) => assetsFailed)
        .some((name) => !summary.assetsFailed.includes(name)),
      "An Asset lost to a dust storm isn't listed as failed.",
    ],
    [
      summary.dustStorms.some(
        ({ assets, assetsFailed }) =>
          assets.length === 0 ||
          assetsFailed.some((name) => !assets.includes(name)),
      ),
      "A dust storm raised a Decision Point with nothing at stake, or took an Asset that wasn't there.",
    ],
    [
      (summary.solarParticleEvent?.outcome === "lost") !==
        (summary.failure?.hazard === true),
      "A solar particle event and the Mission's failure disagree about whether it was lost.",
    ],
    [
      summary.solarParticleEvent !== null &&
        (summary.solarParticleEvent.answer === "safeMode") !==
          (summary.solarParticleEvent.outcome === "protected"),
      "A solar particle event's outcome doesn't follow from its answer.",
    ],
    [
      summary.goNoGo !== null &&
        (summary.goNoGo.answer === "holdOff") !==
          (summary.goNoGo.daysHeld > 0 &&
            summary.goNoGo.serviceLifeDaysLost > 0),
      "A landing was held off with no wait or no cost, or went ahead with one.",
    ],
    [
      before.landingSites.some(({ id }) => !siteIds.includes(id)),
      "A known Landing Site was forgotten.",
    ],
    [
      provenBefore.some((name) => !provenAfter.includes(name)),
      "A Flight-proven technology became unproven.",
    ],
    [
      newlyProven.join() !== summary.technologiesProven.toSorted().join(),
      "The technologies that became Flight-proven don't match the Turn summary.",
    ],
    [
      summary.technologiesProven.some((name) =>
        summary.failure?.assetsLost.includes(name),
      ),
      "An Asset lost with the Mission became Flight-proven.",
    ],
    ...development,
    ...summary.ongoingResearch.flatMap(
      ({ assetName, science, publicSupport, days, benefit }) =>
        benefit
          ? ([
              [
                benefit.days <= 0 || benefit.days > days,
                `${assetName}'s research was raised on ${benefit.days} of its ${days} days.`,
              ],
              [
                benefit.science < 0 ||
                  benefit.science >= science ||
                  benefit.publicSupport < 0 ||
                  benefit.publicSupport > publicSupport,
                `A Benefit added more to ${assetName}'s research than it earned, or took some away.`,
              ],
              [
                benefit.givenBy.length === 0,
                `No Asset gave the Benefit that raised ${assetName}'s research.`,
              ],
            ] satisfies [boolean, string][])
          : [],
    ),
  ];
  return checks.flatMap(([impossible, problem]) =>
    impossible ? [problem] : [],
  );
}

/** What's impossible about Development over one Turn. */
function developmentProblems(
  before: ProgramView,
  summary: TurnSummary,
  after: ProgramView,
): [impossible: boolean, problem: string][] {
  const beforeOf = (id: string) =>
    before.developments.find((development) => development.id === id);
  const namesWhere = (
    changed: (
      was: ProgramView["developments"][number] | undefined,
      now: ProgramView["developments"][number],
    ) => boolean,
  ) =>
    after.developments
      .filter((now) => changed(beforeOf(now.id), now))
      .map(({ name }) => name)
      .toSorted()
      .join();
  const started = after.developments.filter(
    ({ id, status }) =>
      status !== "notStarted" && beforeOf(id)?.status === "notStarted",
  );
  const notBuiltBefore = everyTechnology(before)
    .filter(({ technologyReadiness }) => technologyReadiness === "not-built")
    .map(({ name }) => name);
  const flown = [
    ...summary.technologiesProven,
    ...(summary.failure?.assetsLost ?? []),
    ...after.operatingAssets.map(({ name }) => name),
  ];
  return [
    [
      namesWhere(
        (was, now) =>
          was?.status === "notStarted" && now.status !== "notStarted",
      ) !== summary.developmentsStarted.toSorted().join(),
      "The Developments that started don't match the Turn summary.",
    ],
    [
      namesWhere(
        (was, now) => was?.status !== "finished" && now.status === "finished",
      ) !== summary.developmentsFinished.toSorted().join(),
      "The Developments that finished don't match the Turn summary.",
    ],
    [
      sum(started.map(({ costMillions }) => costMillions)) !==
        summary.developmentCostMillions,
      "developmentCostMillions isn't what the Developments started cost.",
    ],
    [
      after.developments.some(
        ({ id, status, turnsLeft }) =>
          status !== "notStarted" &&
          turnsLeft !== Math.max(0, (beforeOf(id)?.turnsLeft ?? 0) - 1),
      ),
      "A Development didn't go on by one Turn.",
    ],
    [
      everyTechnology(after).some(({ id, technologyReadiness }) => {
        const development = after.developments.find((each) => each.id === id);
        return (
          development !== undefined &&
          (technologyReadiness === "not-built") !==
            (development.status !== "finished")
        );
      }),
      "A technology's Technology Readiness doesn't match its Development.",
    ],
    [
      flown.some((name) => notBuiltBefore.includes(name)),
      "A technology flew before its Development finished.",
    ],
  ];
}

/**
 * What's impossible about the Mission Events on a Turn's Timeline, such as those of orbital refuelling: each on a day
 * of its own, none after one that failed, a failure the Turn summary reports, and nothing delivered once it was lost.
 */
export function timelineMissionEventProblems(
  timeline: Timeline,
  summary: TurnSummary,
): string[] {
  const events = timeline.entries.flatMap((entry) =>
    entry.kind === "missionEvent" ? [entry] : [],
  );
  const days = events.map(({ day }) => day);
  const failedAt = events.findIndex(({ outcome }) => outcome === "failure");
  const failedName =
    summary.failure && !summary.failure.hazard
      ? summary.failure.missionEventName
      : null;
  const failedOnDay = timeline.mission?.failedOnDay ?? null;
  const checks: [impossible: boolean, problem: string][] = [
    [
      new Set(days).size < days.length,
      "Two Mission Events happened on the same day.",
    ],
    [
      failedAt >= 0 && failedAt < events.length - 1,
      "A Mission Event happened after one failed.",
    ],
    [
      (events[failedAt]?.title ?? null) !==
        (failedName === null ? null : `${failedName} failed`),
      "The Mission Event that failed doesn't match the Turn summary.",
    ],
    [
      failedOnDay !== null &&
        (timeline.mission?.assets ?? []).some(
          ({ deliveredOnDay }) =>
            deliveredOnDay !== null && deliveredOnDay > failedOnDay,
        ),
      "An Asset was delivered after the Mission was lost.",
    ],
  ];
  return checks.flatMap(([impossible, problem]) =>
    impossible ? [problem] : [],
  );
}
