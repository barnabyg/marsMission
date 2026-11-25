import type { CameraPose, SceneLabel } from "../sceneParts";
import { Flame } from "./EarthOrbitView";
import { EarthReturnStage, ReturnOrbiter } from "./homewardModels";
import { marsRendezvousCentre } from "./marsRendezvous";
import { inMarsOrbitShot, MarsLimb } from "./MarsRendezvousView";
import type { DepartureNow } from "./transEarthInjection";

export const departureShot: CameraPose = {
  position: [15.2, 1.25, -8.8],
  // Leave room for the flight panel on the left at 1080p.
  target: inMarsOrbitShot([-0.85, 0, 0]),
};

export function DepartureScene({ now }: { now: DepartureNow | null }) {
  if (!now) return null;
  return (
    <group position={marsRendezvousCentre}>
      <MarsLimb />
      <group rotation={[0, -Math.PI / 2, 0]}>
        <group position={now.place} rotation={[0, 0.38, 0.12]}>
          {now.crewed ? (
            <EarthReturnStage lost={false} />
          ) : (
            // The orbiter's engine is under its bus; turn it into the burn direction.
            <group rotation={[0, 0, -Math.PI / 2]}>
              <ReturnOrbiter lost={false} deployed />
            </group>
          )}
          {now.flame > 0 && (
            <Flame
              x={now.crewed ? -0.5 : -0.6}
              ms={now.sinceMs}
              size={now.flame * 0.7}
            />
          )}
        </group>
      </group>
    </group>
  );
}

export function departureLabels(now: DepartureNow): SceneLabel[] {
  const [x, y, z] = now.place;
  return [
    {
      text: now.vehicleName,
      position: inMarsOrbitShot([x, y + 1, z]),
      className: "spacecraft-label",
      testId: "spacecraft-asset",
    },
  ];
}
