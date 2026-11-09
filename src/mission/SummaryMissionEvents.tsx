import { formatDate } from "../ui/format";
import { GameText } from "../ui/GameText";
import { Icon } from "../ui/Icon";
import type { TurnMissionEvent } from "./turnMissionEvents";

/**
 * Every Mission Event of the Turn with its outcome, as the events column showed or would have shown it, so that skipping
 * the rest of the Turn in Mission Mode loses none of them.
 */
export function SummaryMissionEvents({
  events,
}: {
  events: TurnMissionEvent[];
}) {
  if (events.length === 0) return null;
  return (
    <section
      className="summary-mission-events"
      data-testid="summary-mission-events"
    >
      <h2>
        <GameText heading>Mission Events</GameText>
      </h2>
      <ol>
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
    </section>
  );
}
