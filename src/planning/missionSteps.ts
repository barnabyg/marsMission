/** What the New Mission panel needs to know to show which of its steps apply yet. */
export interface MissionStepsState {
  /** Whether no Asset and no Crew are ticked. */
  nothingTicked: boolean;
  /** Whether the Mission carries an Asset or Crew that land at a Landing Site. */
  landsOnMars: boolean;
}

export interface MissionStep {
  number: number;
  title: string;
  /** One line on what this step decides. */
  note: string;
  /** Why the step doesn't apply yet, or null when it is open. */
  collapsedBecause: string | null;
}

/** The steps of the New Mission panel, in the order a player plans a Mission, and which of them apply yet. */
export function missionSteps({
  nothingTicked,
  landsOnMars,
}: MissionStepsState): MissionStep[] {
  return [
    {
      number: 1,
      title: "Launch Vehicle and Trajectory",
      note: "How the Mission gets to Mars, which sets how much it can carry.",
      collapsedBecause: null,
    },
    {
      number: 2,
      title: "Assets and Crew",
      note: "What the Mission carries and what each will do at Mars.",
      collapsedBecause: null,
    },
    {
      number: 3,
      title: "Landing Site",
      note: "Where a lander, rover or Crew come down.",
      collapsedBecause: landsOnMars
        ? null
        : "Opens when the Mission carries a lander, a rover or Crew who land.",
    },
    {
      number: 4,
      title: "Mission Events, Reliability and Contingency",
      note: "The risks on the way, and the Safety Margin bought against them.",
      collapsedBecause: nothingTicked
        ? "Opens once the Mission carries an Asset or Crew."
        : null,
    },
  ];
}
