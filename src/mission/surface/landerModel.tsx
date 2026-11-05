import { memo } from "react";
import type { Point } from "../sceneParts";
import { Box, Dish, Drum, Rod, splayedLegs } from "./modelParts";

export const landerGold = "#f2c14e";
const goldShade = "#b98a2e";
const deckGrey = "#d8dbe2";
const legGrey = "#c9cdd6";
const footGrey = "#8f939c";
const white = "#eef0f4";
const lensDark = "#1b2433";
const panelBlue = "#24365e";
const panelLine = "#3d5a92";

const legs = splayedLegs(0.46, 0.3, 0.56);

/** A round solar panel either side of the deck, as robot landers fly, with its cells drawn as spokes. */
function SolarPanel({ side }: { side: 1 | -1 }) {
  const centre: Point = [side * 0.72, 0.8, 0];
  return (
    <group>
      <Box
        size={[0.16, 0.03, 0.05]}
        position={[side * 0.5, 0.79, 0]}
        color={legGrey}
      />
      <Drum
        radii={[0.3, 0.3]}
        height={0.015}
        position={[centre[0], 0.785, 0]}
        sides={10}
        color={legGrey}
      />
      <Drum
        radii={[0.28, 0.28]}
        height={0.025}
        position={centre}
        sides={10}
        color={panelBlue}
      />
      {[0, 1, 2, 3, 4].map((spoke) => (
        <Box
          key={spoke}
          size={[0.54, 0.004, 0.012]}
          position={[centre[0], 0.8135, 0]}
          rotation={[0, (spoke * Math.PI) / 5, 0]}
          color={panelLine}
        />
      ))}
    </group>
  );
}

/**
 * A lander is gold and stands still on four splayed legs, with a round solar panel either side, a camera on a mast, a
 * dish, a weather boom and an arm reaching out in front, towards the camera, to dig.
 */
export const Lander = memo(function Lander() {
  return (
    <group>
      {legs.map(({ key, foot, top }) => (
        <group key={key}>
          <Rod from={foot} to={top} radius={0.03} color={legGrey} />
          <Rod
            from={[foot[0] * 0.6, 0.3, foot[2] * 0.6]}
            to={[foot[0] * 0.25, 0.5, foot[2] * 0.25]}
            radius={0.018}
            color={footGrey}
          />
          <Drum
            radii={[0.1, 0.12]}
            height={0.05}
            position={foot}
            sides={10}
            color={footGrey}
          />
        </group>
      ))}
      {/* The body, wrapped in gold blanket, with a darker band at its foot and the deck on top. */}
      <Drum
        radii={[0.4, 0.42]}
        height={0.26}
        position={[0, 0.63, 0]}
        sides={8}
        color={landerGold}
      />
      <Drum
        radii={[0.425, 0.425]}
        height={0.05}
        position={[0, 0.52, 0]}
        sides={8}
        color={goldShade}
      />
      <Drum
        radii={[0.46, 0.46]}
        height={0.04}
        position={[0, 0.78, 0]}
        sides={8}
        color={deckGrey}
      />
      <SolarPanel side={1} />
      <SolarPanel side={-1} />
      {/* Instruments on the deck. */}
      <Box
        size={[0.2, 0.12, 0.16]}
        position={[-0.05, 0.86, -0.05]}
        color={white}
      />
      <Box
        size={[0.14, 0.08, 0.14]}
        position={[0.12, 0.84, 0.2]}
        color={goldShade}
      />
      {/* The camera mast, with its head looking forward. */}
      <Rod
        from={[0.18, 0.8, -0.18]}
        to={[0.18, 1.3, -0.18]}
        radius={0.02}
        color={deckGrey}
      />
      <Box
        size={[0.13, 0.08, 0.1]}
        position={[0.18, 1.34, -0.18]}
        color={white}
      />
      {[0.15, 0.21].map((x) => (
        <Box
          key={x}
          size={[0.03, 0.03, 0.02]}
          position={[x, 1.34, -0.235]}
          color={lensDark}
        />
      ))}
      {/* The dish, on a short stalk at the back, tilted towards Earth. */}
      <Rod
        from={[-0.2, 0.8, 0.18]}
        to={[-0.2, 1.0, 0.18]}
        radius={0.02}
        color={legGrey}
      />
      <Dish
        radius={0.2}
        depth={0.07}
        position={[-0.2, 1.04, 0.18]}
        rotation={[-0.5, 0, -0.3]}
        color="#f5f1e3"
      />
      {/* The weather boom. */}
      <Rod
        from={[-0.3, 0.8, -0.22]}
        to={[-0.3, 1.12, -0.22]}
        radius={0.012}
        color={legGrey}
      />
      <Box
        size={[0.07, 0.03, 0.03]}
        position={[-0.3, 1.13, -0.22]}
        color={white}
      />
      {/* The arm, from the front of the deck down to its scoop. */}
      <Rod
        from={[0.28, 0.8, -0.3]}
        to={[0.42, 0.98, -0.55]}
        radius={0.022}
        color={white}
      />
      <Rod
        from={[0.42, 0.98, -0.55]}
        to={[0.48, 0.56, -0.74]}
        radius={0.02}
        color={white}
      />
      <Box
        size={[0.1, 0.06, 0.08]}
        position={[0.48, 0.53, -0.76]}
        rotation={[0.3, 0, 0]}
        color={legGrey}
      />
    </group>
  );
});
