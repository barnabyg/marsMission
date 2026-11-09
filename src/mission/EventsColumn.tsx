import { addDays, type Timeline } from "../simulation/simulation";
import { formatDate } from "../ui/format";
import { GameText } from "../ui/GameText";
import { Icon } from "../ui/Icon";
import { eventCardFor } from "./eventArt/eventCard";
import { EventPictureArt } from "./eventArt/EventPictureArt";

interface EventsColumnProps {
  timeline: Timeline;
  /** How many of the timeline's entries have happened so far. */
  entriesHappened: number;
  /** Whether the Decision Point panel is open. It shows the Decision Point's sentence, so its card here doesn't. */
  deciding: boolean;
}

/** Lists what has happened so far this Turn, newest at the top, each as a card with a picture of what it was. */
export function EventsColumn({
  timeline,
  entriesHappened,
  deciding,
}: EventsColumnProps) {
  const happened = timeline.entries.slice(0, entriesHappened);
  return (
    <aside className="events-column" data-testid="events-column">
      <h2 className="subheading">Events</h2>
      {happened.length === 0 && <p>Nothing yet</p>}
      <ol className="plain-list" data-testid="event-entries">
        {happened
          .map((entry, index) => {
            const { picture, tag, icon, failed } = eventCardFor(entry);
            const latest = index === happened.length - 1;
            const open = deciding && latest && entry.kind === "decisionPoint";
            return (
              <li
                key={index}
                className={[
                  "event-entry",
                  failed && "failed",
                  latest && "latest",
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-testid="event-entry"
              >
                <div
                  className="event-picture"
                  data-testid="event-picture"
                  data-picture={picture}
                >
                  <EventPictureArt picture={picture} />
                  {failed && (
                    <span className="event-picture-badge">
                      <Icon name="alert-triangle" />
                    </span>
                  )}
                </div>
                <div className="event-meta">
                  <span className="event-tag tag-label">
                    <Icon name={icon} />
                    <GameText>{tag}</GameText>
                  </span>
                  <time>
                    {formatDate(addDays(timeline.startDate, entry.day))}
                  </time>
                </div>
                <h3>
                  <GameText heading>{entry.title}</GameText>
                </h3>
                {!open && (
                  <p>
                    <GameText>{entry.description}</GameText>
                  </p>
                )}
              </li>
            );
          })
          .reverse()}
      </ol>
    </aside>
  );
}
