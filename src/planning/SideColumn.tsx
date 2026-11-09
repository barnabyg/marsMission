import { useRef, type ReactNode } from "react";
import { ScrollCue } from "./ScrollCue";

/**
 * Planning Mode's right-hand column of panels. With the Tutorial panel at its top, the column scrolls as a whole, so
 * that the advice gets the room it needs, and a fade at its foot says when that pushes the panels under it out of sight.
 * Otherwise its panels share its height and each scrolls by itself, and the fade never shows.
 */
export function SideColumn({ children }: { children: ReactNode }) {
  const column = useRef<HTMLDivElement>(null);
  return (
    <div className="planning-side" ref={column} data-testid="planning-side">
      {children}
      <ScrollCue scroller={column}>More panels below</ScrollCue>
    </div>
  );
}
