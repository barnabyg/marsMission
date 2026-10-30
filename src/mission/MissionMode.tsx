import { useState } from "react";
import type { Timeline } from "../simulation/simulation";
import { presentationFor } from "./presentation";

interface MissionModeProps {
  timeline: Timeline;
  onFinished: () => void;
}

export function MissionMode({ timeline, onFinished }: MissionModeProps) {
  const [index, setIndex] = useState(0);
  const entry = timeline.entries[index];

  return (
    <main className="mission">
      <h1>Mission Mode</h1>
      {entry &&
        (() => {
          const Presentation = presentationFor(entry);
          return (
            <Presentation
              key={index}
              entry={entry}
              onDismiss={() => {
                if (index + 1 < timeline.entries.length) setIndex(index + 1);
                else onFinished();
              }}
            />
          );
        })()}
    </main>
  );
}
