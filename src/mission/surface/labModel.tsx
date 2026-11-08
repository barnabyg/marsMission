import { memo } from "react";
import {
  FlatPanel,
  footGrey,
  frameGrey,
  shade,
  white,
  WorkLight,
} from "./baseParts";
import { Antenna, deckBoxes, louvrePieces } from "./modelDetails";
import {
  Batched,
  Box,
  Dish,
  Drum,
  PartSet,
  Rod,
  splayedLegs,
} from "./modelParts";

const labSilver = "#d9dde4";
const labTeal = "#4fb7c8";

const legs = splayedLegs(0.5, 0.42, 0.3);

/** The lab's front: the glovebox window in its frame, the hatch beside it with its handle, louvres and a light. */
function LabFront() {
  return (
    <>
      <Box
        size={[0.4, 0.2, 0.02]}
        position={[-0.18, 0.58, -0.372]}
        color={footGrey}
        finish="metal"
      />
      <Box
        size={[0.36, 0.16, 0.02]}
        position={[-0.18, 0.58, -0.378]}
        color="#2d4b63"
        finish="glass"
      />
      {/* The gloves' two round ports under the window. */}
      <PartSet
        pieces={[-0.26, -0.1].map((x) => ({
          radii: [0.03, 0.03],
          height: 0.012,
          sides: 12,
          position: [x, 0.46, -0.378],
          rotation: [Math.PI / 2, 0, 0],
        }))}
        color="#3a3d44"
        finish="matte"
      />
      <Box
        size={[0.38, 0.02, 0.025]}
        position={[-0.18, 0.67, -0.38]}
        color={frameGrey}
        finish="metal"
      />
      <Box
        size={[0.2, 0.3, 0.02]}
        position={[0.3, 0.55, -0.375]}
        color={shade}
      />
      <Box
        size={[0.02, 0.1, 0.02]}
        position={[0.37, 0.55, -0.39]}
        color={footGrey}
        finish="metal"
      />
      <PartSet
        pieces={[1, -1].flatMap((side) =>
          louvrePieces({
            width: 0.3,
            height: 0.12,
            count: 4,
            centre: [side * 0.2, 0.56, 0.375],
          }).map((piece) => ({
            ...piece,
            rotation: [-0.5, 0, 0] as const,
          })),
        )}
        color={shade}
      />
      <WorkLight position={[0.3, 0.73, -0.39]} />
    </>
  );
}

/** The instrument mast, with a weather station and a camera, and the dish at the back. */
function Masts() {
  return (
    <>
      <Rod
        from={[0.42, 0.75, -0.25]}
        to={[0.42, 1.25, -0.25]}
        radius={0.02}
        color={frameGrey}
      />
      <Box
        size={[0.1, 0.1, 0.1]}
        position={[0.42, 1.29, -0.25]}
        color={labTeal}
      />
      <Drum
        radii={[0.022, 0.022]}
        height={0.02}
        position={[0.42, 1.29, -0.305]}
        rotation={[Math.PI / 2, 0, 0]}
        sides={10}
        color="#1b2433"
        finish="glass"
      />
      <PartSet
        pieces={[
          { size: [0.2, 0.012, 0.012], position: [0.42, 1.12, -0.25] },
          {
            radii: [0.025, 0.025],
            height: 0.03,
            sides: 8,
            position: [0.52, 1.14, -0.25],
          },
          {
            radii: [0.025, 0.025],
            height: 0.03,
            sides: 8,
            position: [0.32, 1.14, -0.25],
          },
        ]}
        color={white}
      />
      <Rod
        from={[-0.38, 0.75, 0.3]}
        to={[-0.38, 1.05, 0.3]}
        radius={0.02}
        color={frameGrey}
      />
      <Dish
        radius={0.18}
        depth={0.06}
        position={[-0.38, 1.09, 0.3]}
        rotation={[-0.5, 0, 0.3]}
        color="#f5f1e3"
      />
      <Antenna base={[0.45, 0.77, 0.32]} height={0.3} />
    </>
  );
}

/**
 * The Mars lab is a low silver building on short legs, with a teal band, a glovebox window in its front, an arm reaching
 * out to take in samples, a roof of solar panels, an instrument mast, a dish and an antenna. Its front, towards the
 * camera, is along -z, as the rest of a base's.
 */
export const MarsLab = memo(function MarsLab() {
  return (
    <Batched>
      {legs.map(({ key, foot, top }) => (
        <group key={key}>
          <Rod from={foot} to={top} radius={0.03} color={frameGrey} />
          <Drum
            radii={[0.08, 0.1]}
            height={0.05}
            position={foot}
            sides={10}
            color={footGrey}
            finish="metal"
          />
        </group>
      ))}
      <Box
        size={[1.0, 0.44, 0.74]}
        position={[0, 0.52, 0]}
        color={labSilver}
        finish="metal"
      />
      {/* Panel lines across the walls. */}
      <PartSet
        pieces={[-0.25, 0.08].flatMap((x) => [
          { size: [0.006, 0.34, 0.745], position: [x, 0.55, 0] },
        ])}
        color="#b9bec8"
        finish="metal"
      />
      <Box size={[1.01, 0.06, 0.75]} position={[0, 0.4, 0]} color={labTeal} />
      <Box size={[1.04, 0.04, 0.78]} position={[0, 0.75, 0]} color={shade} />
      <LabFront />
      {/* Boxes of equipment on the roof, behind the panels. */}
      <PartSet
        pieces={deckBoxes([
          { size: [0.14, 0.06, 0.1], foot: [0.3, 0.77, 0.3] },
          { size: [0.1, 0.05, 0.08], foot: [-0.1, 0.77, 0.32] },
        ])}
        color={white}
      />
      {/* The roof of solar panels, sloping back. */}
      <FlatPanel position={[0, 0.86, 0.06]} size={[0.92, 0.56]} tilt={-0.3} />
      {/* The sample arm, out in front, with its elbow and a scoop. */}
      <Rod
        from={[-0.45, 0.6, -0.3]}
        to={[-0.62, 0.78, -0.55]}
        radius={0.022}
        color={white}
        finish="paint"
      />
      <Drum
        radii={[0.03, 0.03]}
        height={0.055}
        position={[-0.62, 0.78, -0.55]}
        rotation={[0, 0, Math.PI / 2]}
        sides={10}
        color={footGrey}
        finish="metal"
      />
      <Rod
        from={[-0.62, 0.78, -0.55]}
        to={[-0.66, 0.4, -0.7]}
        radius={0.02}
        color={white}
        finish="paint"
      />
      <Box
        size={[0.1, 0.06, 0.08]}
        position={[-0.66, 0.37, -0.72]}
        color={labTeal}
      />
      <Masts />
    </Batched>
  );
});
