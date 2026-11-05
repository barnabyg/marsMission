import { memo } from "react";
import type { Point } from "../sceneParts";
import { Box, Dish, Drum, Rod } from "./modelParts";

const roverTeal = "#37c9b5";
export const wheelDark = "#1c1e24";
export const deckBlue = "#23324f";
const deckLine = "#3a5282";
const strutGrey = "#c9cdd6";
const hubGrey = "#8f939c";
const white = "#eef0f4";
const mastGrey = "#d8dbe2";
const lensDark = "#1b2433";

export const wheelRadius = 0.11;
const wheelX = [0.38, 0, -0.38] as const;
const wheelZ = 0.34;
/** The suspension runs just outside the wheels on each side. */
const strutZ = 0.41;

/** A wheel, with its hub on the outside. */
function Wheel({ x, side }: { x: number; side: 1 | -1 }) {
  return (
    <group>
      <Drum
        radii={[wheelRadius, wheelRadius]}
        height={0.09}
        position={[x, wheelRadius, side * wheelZ]}
        rotation={[Math.PI / 2, 0, 0]}
        color={wheelDark}
      />
      <Drum
        radii={[0.045, 0.045]}
        height={0.05}
        position={[x, wheelRadius, side * (wheelZ + 0.05)]}
        rotation={[Math.PI / 2, 0, 0]}
        color={hubGrey}
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
    </group>
  );
}

/**
 * A rover is low and teal, on six dark wheels on rocker-bogie suspension, under a solar deck, with a camera mast, a
 * dish and an arm stowed at its front. Its front is along x.
 */
export const Rover = memo(function Rover() {
  return (
    <group>
      {wheelX.flatMap((x) =>
        ([1, -1] as const).map((side) => (
          <Wheel key={`${x},${side}`} x={x} side={side} />
        )),
      )}
      <Suspension side={1} />
      <Suspension side={-1} />
      <Box size={[0.8, 0.2, 0.5]} position={[0, 0.38, 0]} color={roverTeal} />
      <Box
        size={[0.08, 0.14, 0.36]}
        position={[-0.44, 0.42, 0]}
        color={mastGrey}
      />
      {/* The solar deck, with its cells drawn as a grid. */}
      <Box size={[0.9, 0.03, 0.6]} position={[0, 0.495, 0]} color={deckBlue} />
      {[-0.15, 0, 0.15].map((z) => (
        <Box
          key={`z${z}`}
          size={[0.86, 0.005, 0.01]}
          position={[0, 0.512, z]}
          color={deckLine}
        />
      ))}
      {[-0.22, 0, 0.22].map((x) => (
        <Box
          key={`x${x}`}
          size={[0.01, 0.005, 0.56]}
          position={[x, 0.512, 0]}
          color={deckLine}
        />
      ))}
      {/* The mast, with its camera head looking forward. */}
      <Rod
        from={[0.3, 0.51, -0.18]}
        to={[0.3, 0.95, -0.18]}
        radius={0.025}
        color={mastGrey}
      />
      <Box
        size={[0.12, 0.1, 0.22]}
        position={[0.32, 0.99, -0.18]}
        color={white}
      />
      {[-0.24, -0.12].map((z) => (
        <Box
          key={z}
          size={[0.02, 0.04, 0.04]}
          position={[0.385, 0.99, z]}
          color={lensDark}
        />
      ))}
      {/* The dish, and a short antenna beside it. */}
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
      <Rod
        from={[-0.3, 0.51, -0.2]}
        to={[-0.3, 0.68, -0.2]}
        radius={0.015}
        color={strutGrey}
      />
      {/* The arm, folded across the front with its turret of tools. */}
      <Rod
        from={[0.42, 0.42, 0.12]}
        to={[0.54, 0.48, -0.04]}
        radius={0.022}
        color={white}
      />
      <Rod
        from={[0.54, 0.48, -0.04]}
        to={[0.5, 0.36, -0.2]}
        radius={0.02}
        color={white}
      />
      <Box
        size={[0.1, 0.1, 0.1]}
        position={[0.5, 0.33, -0.2]}
        color={strutGrey}
      />
    </group>
  );
});
