import { baseFundingFor } from "./baseFunding";
import type { Catalogue } from "../catalogue/catalogue";
import type { AssetInService } from "./assetsInService";
import type { creditFirstLanding } from "./arrivals";
import type { CrewAtWork } from "./crewAtMars";
import type { welcomeCrewHome } from "./crewHome";
import type { MissionOutcome } from "./flight";
import type { loseCrew } from "./lostCrew";
import { carryOutOngoingResearch } from "./ongoingResearch";
import { fadePublicSupport, payFundingThresholds } from "./fundingThresholds";
import type { settleSamples } from "./samplesHome";
import {
  awardScienceMilestones,
  type MilestoneAward,
} from "./scienceMilestones";
import { sum, type Rules } from "./rules";
import type { Program } from "./types";

/**
 * What the Turn earns and pays once everything else in it is settled: Ongoing Research, Science Milestones, Funding
 * Thresholds, the fading of Public Support and base funding, and the Science, Public Support and money it ends with.
 */
export function earnTurn(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  {
    costMillions,
    developmentCostMillions,
    upkeepMillions,
    flown,
    homeward,
    homewardLost,
    inService,
    crewAtWork,
    arrivalAwards,
    firstLanding,
    welcome,
    samplesHome,
    lostCrew,
  }: {
    costMillions: number;
    developmentCostMillions: number;
    upkeepMillions: number;
    flown: MissionOutcome;
    homeward: MissionOutcome | null;
    homewardLost: number;
    inService: AssetInService[];
    crewAtWork: CrewAtWork[];
    arrivalAwards: MilestoneAward[];
    firstLanding: ReturnType<typeof creditFirstLanding>;
    welcome: ReturnType<typeof welcomeCrewHome>;
    samplesHome: ReturnType<typeof settleSamples>["welcome"];
    lostCrew: ReturnType<typeof loseCrew>;
  },
) {
  const { failedOnDay } = flown;
  const research = carryOutOngoingResearch(
    catalogue,
    rules,
    inService,
    crewAtWork,
  );
  const scienceAwards = awardScienceMilestones(
    catalogue,
    program.milestoneIds,
    {
      start: program.science,
      lumps: [
        ...[...arrivalAwards, ...welcome.awards, ...samplesHome.awards].map(
          ({ milestone, day }) => ({ day, amount: milestone.science }),
        ),
        ...samplesHome.lumps,
        ...(firstLanding
          ? [{ day: firstLanding.entry.day, amount: firstLanding.site.science }]
          : []),
      ],
      stints: research.stints.map(({ fromDay, toDay, science }) => ({
        fromDay,
        toDay,
        amount: science,
      })),
    },
  );
  const awards = [
    ...arrivalAwards,
    ...welcome.awards,
    ...samplesHome.awards,
    ...scienceAwards,
  ];
  const scienceGained =
    sum(awards.map(({ milestone }) => milestone.science)) +
    samplesHome.science +
    (firstLanding ? firstLanding.site.science : 0) +
    research.science;
  const publicSupportGained =
    sum(awards.map(({ milestone }) => milestone.publicSupport)) +
    research.publicSupport +
    welcome.publicSupport;
  const publicSupportBeforeDrain =
    program.publicSupport -
    flown.publicSupportLost -
    homewardLost -
    lostCrew.publicSupportLost +
    publicSupportGained;
  const funding = payFundingThresholds(catalogue, program, {
    start: program.publicSupport,
    lumps: [
      ...awards.map(({ milestone, day }) => ({
        day,
        amount: milestone.publicSupport,
      })),
      ...(failedOnDay === null
        ? []
        : [{ day: failedOnDay, amount: -flown.publicSupportLost }]),
      ...(homeward?.failedOnDay === undefined || homeward.failedOnDay === null
        ? []
        : [{ day: homeward.failedOnDay, amount: -homewardLost }]),
      ...lostCrew.lumps,
      ...welcome.lumps,
    ],
    stints: research.stints.map(({ fromDay, toDay, publicSupport }) => ({
      fromDay,
      toDay,
      amount: publicSupport,
    })),
  });
  const faded = fadePublicSupport(catalogue, publicSupportBeforeDrain);

  // Sized by Public Support as the Turn started, so that Planning Mode can say what it will be.
  const baseFundingMillions = baseFundingFor(catalogue, program.publicSupport);
  const moneyEndMillions =
    program.moneyMillions -
    costMillions -
    developmentCostMillions -
    upkeepMillions +
    sum(funding.payouts.map(({ payoutMillions }) => payoutMillions)) +
    research.researchGrantMillions +
    baseFundingMillions +
    (flown.returned?.refundMillions ?? 0);
  return {
    research,
    scienceAwards,
    awards,
    scienceGained,
    publicSupportGained,
    publicSupportBeforeDrain,
    funding,
    faded,
    baseFundingMillions,
    moneyEndMillions,
  };
}
