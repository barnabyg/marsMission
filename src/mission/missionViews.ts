/**
 * The views Mission Mode can show, in the order the buttons list them. Adding a view here makes
 * MissionScene ask for its camera shot, and gives it a button. Views only display a Timeline, so
 * which one is showing can't change any results.
 */
export const missionViews = [
  { id: "solarSystem", name: "Solar system" },
  { id: "marsOrbit", name: "Mars orbit" },
] as const;

export type MissionViewId = (typeof missionViews)[number]["id"];

export function viewName(view: MissionViewId): string {
  return missionViews.find(({ id }) => id === view)?.name ?? view;
}
