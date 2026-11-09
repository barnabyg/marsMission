/** What the New Mission panel needs to know to show which of its steps apply yet, and which have folded. */
export interface MissionStepsState {
  /** Whether no Asset and no Crew are ticked. */
  nothingTicked: boolean;
  /** Whether the Mission carries an Asset or Crew that land at a Landing Site. */
  landsOnMars: boolean;
  /** The Launch Vehicle and Trajectory step: what it has chosen, as one line, and whether the player is changing it. */
  launch: {
    summary: string;
    /** Whether the player has pressed Change since the ticked Assets and Crew last changed. */
    changing: boolean;
  };
}

export interface MissionStep {
  number: number;
  title: string;
  /** One line on what this step decides. */
  note: string;
  /** Why the step doesn't apply yet, or null when it is open. */
  collapsedBecause: string | null;
  /**
   * The one line the step folds to once it is complete and the player has moved on, with a Change button to open it
   * again, or null while it is open. Only the Launch Vehicle and Trajectory step folds: it is done first and is the one
   * that costs a new player the most room before the steps that land.
   */
  summary: string | null;
}

/** The one line a folded Launch Vehicle and Trajectory step says: "Meridian Medium (4 t) · Slow (210 days)". */
export function launchSummary(
  vehicle: { name: string; capacityTonnes: number } | undefined,
  trajectory: { name: string; transferDays: number } | undefined,
): string {
  const parts = [
    ...(vehicle
      ? [`${vehicle.name} (${String(vehicle.capacityTonnes)} t)`]
      : []),
    ...(trajectory
      ? [`${trajectory.name} (${String(trajectory.transferDays)} days)`]
      : []),
  ];
  return parts.join(" · ");
}

/** The steps of the New Mission panel, in the order a player plans a Mission, and which of them apply yet. */
export function missionSteps({
  nothingTicked,
  landsOnMars,
  launch,
}: MissionStepsState): MissionStep[] {
  return [
    {
      number: 1,
      title: "Launch Vehicle and Trajectory",
      note: "How the Mission gets to Mars, which sets how much it can carry.",
      collapsedBecause: null,
      // Folded once the player has ticked something, so that the steps below come into view, until they ask to change
      // it; ticking or unticking anything else folds it again.
      summary: nothingTicked || launch.changing ? null : launch.summary,
    },
    {
      number: 2,
      title: "Assets and Crew",
      note: "What the Mission carries and what each will do at Mars.",
      collapsedBecause: null,
      summary: null,
    },
    {
      number: 3,
      title: "Landing Site",
      note: "Where a lander, rover or Crew come down.",
      collapsedBecause: landsOnMars
        ? null
        : "Opens when the Mission carries a lander, a rover or Crew who land.",
      summary: null,
    },
    {
      number: 4,
      title: "Mission Events, Reliability and Contingency",
      note: "Every risk, on the way and in service at Mars, and what is bought against it.",
      collapsedBecause: nothingTicked
        ? "Opens once the Mission carries an Asset or Crew."
        : null,
      summary: null,
    },
  ];
}
