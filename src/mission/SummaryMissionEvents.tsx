import { formatDate } from "../ui/format";
import { GameText } from "../ui/GameText";
import { Icon } from "../ui/Icon";
import type { SummaryCardContent } from "./SummaryCard";
import type { TurnMissionEvent } from "./turnMissionEvents";

/**
 * The card of every Mission Event of the Turn with its outcome, as the events column showed or would have shown it, so
 * that skipping the rest of the Turn in Mission Mode loses none of them.
 */
export function missionEventsCards(
  events: TurnMissionEvent[],
): SummaryCardContent[] {
  if (events.length === 0) return [];
  return [
    {
      key: "mission-events",
      heading: "Mission Events",
      className: "summary-mission-events",
      testId: "summary-mission-events",
      content: (
        <ol className="plain-list">
          {events.map(({ date, title, description, failed }, index) => (
            <li
              key={index}
              className={failed ? "failed" : undefined}
              data-testid="summary-mission-event"
              data-outcome={failed ? "failure" : "success"}
            >
              <Icon name={failed ? "alert-triangle" : "rocket"} />
              <span>
                <strong>
                  <GameText>{title}</GameText>
                </strong>{" "}
                <time>{formatDate(date)}</time>
                <br />
                <GameText>{description}</GameText>
              </span>
            </li>
          ))}
        </ol>
      ),
    },
  ];
}
