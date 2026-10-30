import { addDays, type Timeline } from "../simulation/simulation";
import { formatDate } from "../ui/format";
import { GameText } from "../ui/GameText";

interface EventsColumnProps {
  timeline: Timeline;
  /** How many of the timeline's entries have happened so far. */
  entriesHappened: number;
}

/** Lists what has happened so far this Turn, newest at the top. */
export function EventsColumn({ timeline, entriesHappened }: EventsColumnProps) {
  const happened = timeline.entries.slice(0, entriesHappened);
  return (
    <aside className="events-column" data-testid="events-column">
      <h2>Events</h2>
      {happened.length === 0 && <p>Nothing yet</p>}
      <ol data-testid="event-entries">
        {happened
          .map((entry, index) => {
            const failed =
              entry.kind === "missionEvent" && entry.outcome === "failure";
            return (
              <li
                key={index}
                className={failed ? "event-entry failed" : "event-entry"}
                data-testid="event-entry"
              >
                <time>
                  {formatDate(addDays(timeline.startDate, entry.day))}
                </time>
                <h3>
                  <GameText>{entry.title}</GameText>
                </h3>
                <p>
                  <GameText>{entry.description}</GameText>
                </p>
              </li>
            );
          })
          .reverse()}
      </ol>
    </aside>
  );
}
