import { formatMoney, type PlannedActivity } from "../simulation/simulation";
import { GameText } from "../ui/GameText";

/** Whether an Asset's current Activity is a Survey. */
export function isSurveying(
  activityId: string,
  activities: PlannedActivity[],
): boolean {
  return activities.some(({ id, surveys }) => id === activityId && surveys);
}

/** An Asset set to Survey with nothing left would otherwise sit idle with no sign of it. */
export function NothingLeftToSurvey() {
  return (
    <p data-testid="nothing-left-to-survey">
      <GameText>
        Nothing is left to Survey, so an Asset set to Survey does nothing.
      </GameText>
    </p>
  );
}

/** What a research Activity earns, leaving out whether a Benefit raises it. */
function earningsOf({ name, earnsPerTurn }: PlannedActivity) {
  if (!earnsPerTurn) return [];
  const { science, publicSupport, researchGrantMillions } = earnsPerTurn;
  return [
    `${name} earns ${science} Science${
      publicSupport > 0 ? ` and ${publicSupport} Public Support` : ""
    }${
      researchGrantMillions > 0
        ? `, and pays a ${formatMoney(researchGrantMillions)} Research Grant`
        : ""
    }.`,
  ];
}

/** Which Benefit raises the research on offer, said once for all the Activities it raises. */
function raisesOf({ raisedBy }: PlannedActivity) {
  return raisedBy
    ? [
        `${raisedBy.givenBy.join(" and ")}'s Benefit adds ${raisedBy.percent}% on the surface.`,
      ]
    : [];
}

/**
 * What each research Activity on offer earns and any Research Grant it pays, once each however many Assets can do it,
 * and the Benefit that raises it on the surface, if one does. Only Assets on the surface are raised, and in one panel
 * those are all raised alike. Where each choice already says what its Activity earns, as Operating at Mars does, only
 * the Benefit is said.
 */
export function ResearchEarnings({
  activities,
  onlyRaises = false,
}: {
  activities: PlannedActivity[];
  onlyRaises?: boolean;
}) {
  const earnings = new Set(activities.flatMap(earningsOf));
  if (earnings.size === 0) return null;
  const raises = new Set(activities.flatMap(raisesOf));
  if (onlyRaises && raises.size === 0) return null;
  return (
    <p data-testid="research-earnings">
      <GameText>
        {onlyRaises
          ? `Ongoing Research on the surface: ${[...raises].join(" ")}`
          : `Ongoing Research for a whole Turn: ${[...earnings, ...raises].join(" ")}`}
      </GameText>
    </p>
  );
}
