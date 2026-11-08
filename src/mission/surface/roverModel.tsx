import { memo } from "react";
import type { Point } from "../sceneParts";
import { Antenna, louvrePieces, SolarCells } from "./modelDetails";
import {
  Batched,
  Box,
  Dish,
  Drum,
  PartSet,
  Rod,
  type SetPiece,
} from "./modelParts";

const roverTeal = "#37c9b5";
const tealShade = "#2a9e8e";
export const wheelDark = "#1c1e24";
export const deckBlue = "#23324f";
const strutGrey = "#c9cdd6";
const hubGrey = "#8f939c";
const white = "#eef0f4";
const mastGrey = "#d8dbe2";
const lensDark = "#1b2433";

export const wheelRadius = 0.11;
const wheelWidth = 0.09;
const wheelX = [0.38, 0, -0.38] as const;
const wheelZ = 0.34;
/** The suspension runs just outside the wheels on each side. */
const strutZ = 0.41;
const grousersPerWheel = 14;

const wheels = wheelX.flatMap((x) =>
  ([1, -1] as const).map((side) => ({ key: `${x},${side}`, x, side })),
);

/**
 * The grousers of every wheel, the cleats across each tyre that bite into the sand, as one shape: there are many of
 * them, and they never move apart.
 */
const grousers: SetPiece[] = wheels.flatMap(({ x, side }) =>
  Array.from({ length: grousersPerWheel }, (_, index): SetPiece => {
    const angle = (index / grousersPerWheel) * Math.PI * 2;
    return {
      size: [0.018, 0.012, wheelWidth + 0.004],
      position: [
        x + Math.cos(angle) * wheelRadius,
        wheelRadius + Math.sin(angle) * wheelRadius,
        side * wheelZ,
      ],
      rotation: [0, 0, angle + Math.PI / 2],
    };
  }),
);

/** A wheel: a dark tyre, a lighter rim on its outer face and a hub. */
function Wheel({ x, side }: { x: number; side: 1 | -1 }) {
  const across: Point = [Math.PI / 2, 0, 0];
  return (
    <group>
      <Drum
        radii={[wheelRadius, wheelRadius]}
        height={wheelWidth}
        position={[x, wheelRadius, side * wheelZ]}
        rotation={across}
        sides={20}
        color={wheelDark}
        finish="matte"
      />
      <Drum
        radii={[0.075, 0.075]}
        height={0.008}
        position={[x, wheelRadius, side * (wheelZ + wheelWidth / 2)]}
        rotation={across}
        sides={16}
        color="#4a4e57"
        finish="metal"
      />
      <Drum
        radii={[0.045, 0.045]}
        height={0.05}
        position={[x, wheelRadius, side * (wheelZ + 0.05)]}
        rotation={across}
        color={hubGrey}
        finish="metal"
      />
    </group>
  );
}

/**
 * One side's rocker-bogie suspension: the rocker from its pivot on the body to the front wheel and to the bogie, and
 * the bogie between the middle and back wheels.
 */
function Suspension({ side }: { side: 1 | -1 }) {
  const z = side * strutZ;
  const pivot: Point = [0.08, 0.32, z];
  const bogie: Point = [-0.19, 0.22, z];
  const hub = (x: number): Point => [x, wheelRadius, z];
  return (
    <group>
      <Rod
        from={[0.08, 0.32, side * 0.25]}
        to={pivot}
        radius={0.025}
        color={hubGrey}
      />
      <Rod from={pivot} to={hub(wheelX[0])} radius={0.022} color={strutGrey} />
      <Rod from={pivot} to={bogie} radius={0.022} color={strutGrey} />
      <Rod from={bogie} to={hub(wheelX[1])} radius={0.02} color={strutGrey} />
      <Rod from={bogie} to={hub(wheelX[2])} radius={0.02} color={strutGrey} />
      <Drum
        radii={[0.032, 0.032]}
        height={0.04}
        position={bogie}
        rotation={[Math.PI / 2, 0, 0]}
        sides={10}
        color={hubGrey}
        finish="metal"
      />
    </group>
  );
}

/** The power source at the back: a finned drum, slanting up from the body. */
function PowerSource() {
  const fins: SetPiece[] = Array.from({ length: 8 }, (_, fin) => {
    const angle = (fin / 8) * Math.PI * 2;
    return {
      size: [0.012, 0.2, 0.05],
      position: [0, 0, 0],
      rotation: [0, angle, 0],
    };
  });
  return (
    <group position={[-0.5, 0.46, 0]} rotation={[0, 0, 0.6]}>
      <Drum
        radii={[0.055, 0.055]}
        height={0.22}
        position={[0, 0, 0]}
        color="#5d6068"
        finish="metal"
      />
      <PartSet pieces={fins} color="#7a7e87" finish="metal" />
    </group>
  );
}

/** The mast, with its camera head looking forward: two cameras either side and a laser between them. */
function Mast() {
  return (
    <group>
      <Rod
        from={[0.3, 0.51, -0.18]}
        to={[0.3, 0.95, -0.18]}
        radius={0.025}
        color={mastGrey}
      />
      <Drum
        radii={[0.035, 0.035]}
        height={0.05}
        position={[0.3, 0.92, -0.18]}
        sides={10}
        color={hubGrey}
        finish="metal"
      />
      <Box
        size={[0.12, 0.1, 0.22]}
        position={[0.32, 0.99, -0.18]}
        color={white}
      />
      <PartSet
        pieces={[-0.26, -0.22, -0.14, -0.1].map((z) => ({
          radii: [0.014, 0.014],
          height: 0.02,
          sides: 10,
          position: [0.385, 0.99, z],
          rotation: [0, 0, Math.PI / 2],
        }))}
        color={lensDark}
        finish="glass"
      />
      <Drum
        radii={[0.024, 0.024]}
        height={0.03}
        position={[0.39, 1.0, -0.18]}
        rotation={[0, 0, Math.PI / 2]}
        sides={12}
        color="#3d5a92"
        finish="glass"
      />
    </group>
  );
}

/**
 * A rover is low and teal, on six dark wheels with grousers on rocker-bogie suspension, under a solar deck of cells,
 * with a camera mast, a dish, antennas, a finned power source at the back and an arm stowed at its front. Its front is
 * along x.
 */
export const Rover = memo(function Rover() {
  return (
    <Batched>
      {wheels.map(({ key, x, side }) => (
        <Wheel key={key} x={x} side={side} />
      ))}
      <PartSet pieces={grousers} color="#2c2f36" finish="matte" />
      <Suspension side={1} />
      <Suspension side={-1} />
      <Box size={[0.8, 0.2, 0.5]} position={[0, 0.38, 0]} color={roverTeal} />
      <Box size={[0.81, 0.03, 0.51]} position={[0, 0.3, 0]} color={tealShade} />
      {/* Louvres on each side of the body, letting out heat. */}
      <PartSet
        pieces={[1, -1].flatMap((side) =>
          louvrePieces({
            width: 0.22,
            height: 0.1,
            count: 4,
            centre: [-0.18, 0.4, side * 0.255],
          }),
        )}
        color={tealShade}
      />
      <Box
        size={[0.08, 0.14, 0.36]}
        position={[-0.44, 0.42, 0]}
        color={mastGrey}
      />
      <PowerSource />
      <SolarCells
        width={0.86}
        depth={0.56}
        rows={4}
        columns={6}
        position={[0, 0.495, 0]}
        frame={deckBlue}
      />
      <Mast />
      {/* The dish, and an antenna beside it. */}
      <Rod
        from={[-0.15, 0.51, 0.18]}
        to={[-0.15, 0.62, 0.18]}
        radius={0.02}
        color={strutGrey}
      />
      <Dish
        radius={0.12}
        depth={0.04}
        position={[-0.15, 0.65, 0.18]}
        rotation={[0, 0, -0.6]}
        color="#f5f1e3"
      />
      <Antenna base={[-0.3, 0.51, -0.2]} height={0.2} color={strutGrey} />
      {/* The arm, folded across the front with its turret of tools. */}
      <Rod
        from={[0.42, 0.42, 0.12]}
        to={[0.54, 0.48, -0.04]}
        radius={0.022}
        color={white}
        finish="paint"
      />
      <Rod
        from={[0.54, 0.48, -0.04]}
        to={[0.5, 0.36, -0.2]}
        radius={0.02}
        color={white}
        finish="paint"
      />
      <Box
        size={[0.1, 0.1, 0.1]}
        position={[0.5, 0.33, -0.2]}
        color={strutGrey}
        finish="metal"
      />
      <PartSet
        pieces={[
          {
            radii: [0.018, 0.018],
            height: 0.06,
            position: [0.57, 0.33, -0.2],
            rotation: [0, 0, Math.PI / 2],
          },
          { radii: [0.012, 0.02], height: 0.06, position: [0.5, 0.25, -0.2] },
          { size: [0.04, 0.03, 0.05], position: [0.5, 0.33, -0.27] },
        ]}
        color={hubGrey}
        finish="metal"
      />
    </Batched>
  );
});
