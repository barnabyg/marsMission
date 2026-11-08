interface Environment {
  DEV: boolean;
  VITE_MISSION_TIME_SCALE?: string;
  VITE_SEQUENCE_TIME_SCALE?: string;
}

/** A development-only scale, or 1 in a production build or for anything but a positive number. */
function scaleFrom(
  environment: Environment,
  value: string | undefined,
): number {
  if (!environment.DEV) return 1;
  const scale = Number(value);
  return scale > 0 ? scale : 1;
}

/**
 * How many times faster than normal Mission Mode runs, for browser tests. It's read from
 * VITE_MISSION_TIME_SCALE on the development server only, so normal play can't use it.
 */
export function missionTimeScale(environment: Environment): number {
  return scaleFrom(environment, environment.VITE_MISSION_TIME_SCALE);
}

/**
 * How many times faster than normal what plays in real time runs, such as a landing, for browser tests, leaving game
 * days at the pace missionTimeScale gives them. It's read from VITE_SEQUENCE_TIME_SCALE on the development server only.
 */
export function sequenceTimeScale(environment: Environment): number {
  return scaleFrom(environment, environment.VITE_SEQUENCE_TIME_SCALE);
}
