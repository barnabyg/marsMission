import type { PlanningTools } from "../balance/strategy";
import {
  daysBetween,
  type ProgramView,
  type TurnPlan,
} from "../simulation/simulation";
import {
  assetsWithIds,
  listOf,
  siteName,
  type PlannedMission,
} from "./adviceItems";
import { baseKinds } from "./base";

/** The previous Turn, for spotting a change of course: its view and tools at its start, and the plan the player submitted. */
export interface LastTurn {
  view: ProgramView;
  tools: PlanningTools;
  plan: TurnPlan;
}

type OperatingAsset = ProgramView["operatingAssets"][number];

/** A Mission in a few words: what it carries and where it lands. */
function summaryOf(view: ProgramView, mission: PlannedMission | null): string {
  if (!mission) return "launching nothing";
  const carried = [
    ...(mission.crew ? [`a Crew of ${mission.crew.size}`] : []),
    ...assetsWithIds(view, mission.assetIds).map(({ name }) => name),
  ];
  const where =
    mission.landingSiteId === undefined
      ? ""
      : ` to ${siteName(view, mission.landingSiteId)}`;
  return `sending ${listOf(carried)}${where}`;
}

/** Whether two plans make the same main choices: the Mission's Launch Vehicle, Assets, Landing Site and Crew, and Development. */
function sameChoices(first: TurnPlan, second: TurnPlan): boolean {
  const key = ({ mission, developmentIds = [] }: TurnPlan) =>
    JSON.stringify([
      mission?.launchVehicleId ?? null,
      mission?.assetIds.toSorted() ?? [],
      mission?.landingSiteId ?? null,
      mission?.crew?.size ?? 0,
      developmentIds.toSorted(),
    ]);
  return key(first) === key(second);
}

/** An Asset at Mars, as a key that stays the same from one Turn's view to the next. */
const assetKey = ({ assetId, arrivedOn, landingSiteId }: OperatingAsset) =>
  `${assetId}@${arrivedOn}@${landingSiteId ?? "orbit"}`;

/** Assets named with where they are, the same ones counted: "2 Trailblazer Rovers at Gale Crater". */
function namesOf(assets: readonly OperatingAsset[]): string {
  const counts = new Map<
    string,
    { name: string; site: string; count: number }
  >();
  for (const { name, landingSiteName } of assets) {
    const site = landingSiteName ? ` at ${landingSiteName}` : "";
    const known = counts.get(name + site);
    if (known) known.count++;
    else counts.set(name + site, { name, site, count: 1 });
  }
  return listOf(
    [...counts.values()].map(({ name, site, count }) =>
      count > 1 ? `${count} ${name}s${site}` : `${name}${site}`,
    ),
  );
}

/** The names of the Crew at Mars in a view. */
const crewNames = (view: ProgramView) =>
  view.crew.flatMap(({ members }) => members.map(({ name }) => name));

/** What went wrong over the last Turn, going by the views before and after it, and the Assets it lost. */
function setbacks(
  last: LastTurn,
  view: ProgramView,
): { sentences: string[]; lostIds: string[]; crewLost: boolean } {
  const { plan } = last;
  const sentences: string[] = [];
  const lostIds: string[] = [];
  let crewLost = false;
  const arrived = view.operatingAssets.filter(
    ({ arrivedOn }) => arrivedOn > last.view.date,
  );
  const before = new Set(crewNames(last.view));
  const { mission } = plan;
  if (mission) {
    const aboard = assetsWithIds(last.view, mission.assetIds);
    const lost = aboard.filter(
      ({ id }) => !arrived.some(({ assetId }) => assetId === id),
    );
    const crewMissing =
      mission.crew !== undefined &&
      !crewNames(view).some((name) => !before.has(name));
    lostIds.push(...lost.map(({ id }) => id));
    crewLost ||= crewMissing;
    if (lost.length === aboard.length && (aboard.length > 0 || crewMissing)) {
      sentences.push(
        `The Mission ${summaryOf(last.view, mission).replace("sending", "carrying")} failed.`,
      );
    } else if (lost.length > 0) {
      sentences.push(
        `${listOf(lost.map(({ name }) => name))} didn't make it to Mars.`,
      );
    }
  }
  const now = new Set(view.operatingAssets.map(assetKey));
  const span = daysBetween(last.view.date, view.date);
  const gone = last.view.operatingAssets.filter(
    (asset) =>
      !plan.endedAssetKeys?.includes(asset.key) && !now.has(assetKey(asset)),
  );
  const failed = gone.filter(({ daysLeft }) => daysLeft >= span);
  const baseEnded = gone.filter(
    ({ daysLeft, kind }) =>
      daysLeft < span && (baseKinds as readonly string[]).includes(kind),
  );
  lostIds.push(...failed.map(({ assetId }) => assetId));
  if (failed.length > 0) {
    sentences.push(
      `${namesOf(failed)} failed at Mars before ${failed.length === 1 ? "its" : "their"} Service Life ended.`,
    );
  }
  if (baseEnded.length > 0) {
    lostIds.push(...baseEnded.map(({ assetId }) => assetId));
    sentences.push(
      `${namesOf(baseEnded)} reached the end of ${baseEnded.length === 1 ? "its" : "their"} Service Life, leaving the Base incomplete.`,
    );
  }
  const home = new Set(
    last.view.crew.flatMap(({ waysHome }) =>
      waysHome.flatMap(({ key, names }) =>
        key === plan.bringHome ? names : [],
      ),
    ),
  );
  const stillThere = new Set(crewNames(view));
  const lostAtMars = [...before].filter(
    (name) => !home.has(name) && !stillThere.has(name),
  );
  if (lostAtMars.length > 0) {
    crewLost = true;
    sentences.push(
      `${listOf(lostAtMars)} ${lostAtMars.length === 1 ? "was" : "were"} lost at Mars.`,
    );
  }
  return { sentences, lostIds, crewLost };
}

/**
 * Why the advice changed course since the last Turn, or null if it didn't: the player didn't follow it, or a Mission
 * failed, an Asset failed or a part of the Base ended, or Crew were lost. It ends with what this Turn does about it.
 */
export function changeOfCourse(
  last: LastTurn,
  advisedThen: TurnPlan,
  view: ProgramView,
  plan: TurnPlan,
): string | null {
  const { sentences, lostIds, crewLost } = setbacks(last, view);
  const followed = sameChoices(advisedThen, last.plan);
  if (followed && sentences.length === 0) return null;
  const notFollowed = followed
    ? []
    : [
        `Last Turn's plan went a different way from the advice, ${summaryOf(last.view, last.plan.mission)} rather than ${summaryOf(last.view, advisedThen.mission)}.`,
      ];
  const retry =
    plan.mission !== null &&
    (plan.mission.assetIds.some((id) => lostIds.includes(id)) ||
      (crewLost && plan.mission.crew !== undefined));
  const doing = plan.mission
    ? `${retry ? "tries again" : "carries on"}, ${summaryOf(view, plan.mission)}`
    : "launches nothing";
  const response =
    sentences.length > 0
      ? `So this Turn ${doing}.`
      : `This Turn's advice picks up from where the Program is now, ${
          plan.mission ? summaryOf(view, plan.mission) : "launching nothing"
        }.`;
  return [...notFollowed, ...sentences, response].join(" ");
}
