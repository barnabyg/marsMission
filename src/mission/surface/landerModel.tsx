import { memo } from "react";
import type { Point } from "../sceneParts";
import {
  Antenna,
  blanketSeams,
  deckBoxes,
  RoundSolarCells,
} from "./modelDetails";
import {
  Box,
  Dish,
  Drum,
  PartSet,
  Rod,
  Shape,
  splayedLegs,
} from "./modelParts";

export const landerGold = "#f2c14e";
const goldShade = "#b98a2e";
const seamGold = "#c99a3a";
const deckGrey = "#d8dbe2";
const legGrey = "#c9cdd6";
const footGrey = "#8f939c";
const white = "#eef0f4";
const lensDark = "#1b2433";
const nozzleDark = "#3a3d44";

const legs = splayedLegs(0.46, 0.3, 0.56);

/** A round solar panel either side of the deck, as robot landers fly, on a short arm, with its cells in rings. */
function SolarPanel({ side }: { side: 1 | -1 }) {
  return (
    <group>
      <Box
        size={[0.16, 0.03, 0.05]}
        position={[side * 0.5, 0.79, 0]}
        color={legGrey}
        finish="metal"
      />
      <RoundSolarCells
        radius={0.28}
        gores={10}
        position={[side * 0.72, 0.792, 0]}
      />
    </group>
  );
}

/** Each leg, braced back to the body, with a shock absorber near its top and a round foot pad. */
function Legs() {
  return (
    <>
      {legs.map(({ key, foot, top }) => (
        <group key={key}>
          <Rod from={foot} to={top} radius={0.03} color={legGrey} />
          <Rod
            from={[foot[0] * 0.75, 0.22, foot[2] * 0.75]}
            to={[foot[0] * 0.55, 0.36, foot[2] * 0.55]}
            radius={0.042}
            color={footGrey}
          />
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
            sides={12}
            color={footGrey}
            finish="metal"
          />
        </group>
      ))}
    </>
  );
}

/** The deck's instruments: a domed seismometer, a weather boom, electronics boxes and the camera mast. */
function Instruments() {
  const lenses: Point[] = [
    [0.15, 1.34, -0.235],
    [0.21, 1.34, -0.235],
  ];
  return (
    <>
      <PartSet
        pieces={deckBoxes([
          { size: [0.2, 0.12, 0.16], foot: [-0.05, 0.8, -0.05] },
          { size: [0.09, 0.06, 0.09], foot: [-0.02, 0.8, 0.3] },
          { size: [0.12, 0.05, 0.08], foot: [0.3, 0.8, 0.05] },
        ])}
        color={white}
      />
      <Box
        size={[0.14, 0.08, 0.14]}
        position={[0.12, 0.84, 0.2]}
        color={goldShade}
        finish="foil"
      />
      {/* The seismometer, under its domed wind shield, set down on the deck's edge. */}
      <Shape
        position={[-0.32, 0.8, -0.08]}
        scale={[1, 0.7, 1]}
        color="#e3dccb"
        finish="paint"
      >
        <sphereGeometry args={[0.09, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </Shape>
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
      {lenses.map((position) => (
        <Box
          key={position.join()}
          size={[0.03, 0.03, 0.02]}
          position={position}
          color={lensDark}
          finish="glass"
        />
      ))}
      {/* The weather boom, with its two sensor arms. */}
      <Rod
        from={[-0.3, 0.8, -0.22]}
        to={[-0.3, 1.12, -0.22]}
        radius={0.012}
        color={legGrey}
      />
      <PartSet
        pieces={[
          { size: [0.07, 0.03, 0.03], position: [-0.3, 1.13, -0.22] },
          { size: [0.12, 0.012, 0.012], position: [-0.36, 1.06, -0.22] },
          { size: [0.012, 0.012, 0.1], position: [-0.3, 1.0, -0.27] },
        ]}
        color={white}
      />
      <Antenna base={[0.3, 0.8, 0.28]} height={0.26} />
    </>
  );
}

/**
 * A lander is gold and stands still on four splayed legs, with a round solar panel either side, a camera on a mast, a
 * dish, a seismometer, a weather boom and an arm reaching out in front, towards the camera, to dig. Its body is
 * wrapped in a seamed thermal blanket, with the nozzles of its descent engines underneath.
 */
export const Lander = memo(function Lander() {
  return (
    <group>
      <Legs />
      {/* The descent engines' nozzles, between the legs. */}
      <PartSet
        pieces={[0, 1, 2, 3].map((quarter) => {
          const angle = (quarter * Math.PI) / 2;
          return {
            radii: [0.03, 0.055],
            height: 0.08,
            sides: 10,
            position: [Math.cos(angle) * 0.24, 0.46, Math.sin(angle) * 0.24],
          };
        })}
        color={nozzleDark}
        finish="metal"
      />
      {/* The body, wrapped in gold blanket, with a darker band at its foot and the deck on top. */}
      <Drum
        radii={[0.4, 0.42]}
        height={0.26}
        position={[0, 0.63, 0]}
        sides={8}
        color={landerGold}
        finish="foil"
      />
      <PartSet
        pieces={blanketSeams({
          radius: 0.415,
          height: 0.24,
          centre: [0, 0.63, 0],
          count: 8,
          bands: [0.66],
        })}
        color={seamGold}
        finish="foil"
      />
      <Drum
        radii={[0.425, 0.425]}
        height={0.05}
        position={[0, 0.52, 0]}
        sides={8}
        color={goldShade}
        finish="foil"
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
      <Instruments />
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
      {/* The arm, from the front of the deck down to its scoop, with an elbow joint. */}
      <Rod
        from={[0.28, 0.8, -0.3]}
        to={[0.42, 0.98, -0.55]}
        radius={0.022}
        color={white}
        finish="paint"
      />
      <Drum
        radii={[0.032, 0.032]}
        height={0.06}
        position={[0.42, 0.98, -0.55]}
        rotation={[0, 0, Math.PI / 2]}
        sides={10}
        color={footGrey}
        finish="metal"
      />
      <Rod
        from={[0.42, 0.98, -0.55]}
        to={[0.48, 0.56, -0.74]}
        radius={0.02}
        color={white}
        finish="paint"
      />
      <Box
        size={[0.1, 0.06, 0.08]}
        position={[0.48, 0.53, -0.76]}
        rotation={[0.3, 0, 0]}
        color={legGrey}
        finish="metal"
      />
    </group>
  );
});
