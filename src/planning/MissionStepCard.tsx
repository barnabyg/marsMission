import type { ReactNode } from "react";
import { GameText } from "../ui/GameText";
import type { MissionStep } from "./missionSteps";

/**
 * One numbered step of the New Mission panel: its heading, a line on what it decides, and its choices. A step that
 * doesn't apply yet shows why in place of that line, and none of its choices.
 */
export function MissionStepCard({
  step,
  children,
}: {
  step: MissionStep;
  children: ReactNode;
}) {
  const headingId = `mission-step-${step.number}`;
  const collapsed = step.collapsedBecause !== null;
  return (
    <section
      className={collapsed ? "mission-step collapsed" : "mission-step"}
      aria-labelledby={headingId}
      data-testid="mission-step"
    >
      <header className="mission-step-header">
        <h3 id={headingId}>
          <span className="mission-step-number">{step.number}</span>
          {/* One piece, so that the heading's gap doesn't split it at each game term. */}
          <span>
            <GameText heading>{step.title}</GameText>
          </span>
        </h3>
        <p
          className="mission-step-note"
          data-testid={collapsed ? "mission-step-collapsed" : undefined}
        >
          <GameText>{step.collapsedBecause ?? step.note}</GameText>
        </p>
      </header>
      {!collapsed && children}
    </section>
  );
}
