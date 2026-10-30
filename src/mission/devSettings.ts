interface Environment {
  DEV: boolean;
  VITE_MISSION_TIME_SCALE?: string;
}

/**
 * How many times faster than normal Mission Mode runs, for browser tests. It's read from
 * VITE_MISSION_TIME_SCALE on the development server only, so normal play can't use it.
 */
export function missionTimeScale(environment: Environment): number {
  if (!environment.DEV) return 1;
  const scale = Number(environment.VITE_MISSION_TIME_SCALE);
  return scale > 0 ? scale : 1;
}
