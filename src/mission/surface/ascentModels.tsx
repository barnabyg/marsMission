import { memo } from "react";
import { Antenna } from "./modelDetails";
import { Box, Drum, PartSet, Rod, splayedLegs, Shape } from "./modelParts";

/**
 * The ascent vehicle, which lifts samples off the surface: a rocket standing on a platform, which stays behind when the
 * rocket lifts off. Simple models made here from three.js shapes, so they use no art file (ADR 0005). Like everything
 * at the surface they work out their own light from the surface's Sun.
 */

const white = "#eef0f4";
const shade = "#c2c6ce";
const frameGrey = "#a9adb6";
const footGrey = "#8f939c";
const bandOrange = "#e2703a";
const nozzleDark = "#3a3d44";

/** How high the rocket stands on its platform, where its engine is. */
export const rocketBase = 0.42;

const platformLegs = splayedLegs(0.5, 0.36, 0.36);

/** The platform the rocket stands on: a deck on four splayed legs, with a support arm on either side of the rocket. */
export const KestrelPlatform = memo(function KestrelPlatform() {
  return (
    <group>
      {platformLegs.map(({ key, foot, top }) => (
        <group key={key}>
          <Rod from={foot} to={top} radius={0.03} color={frameGrey} />
          <Drum
            radii={[0.08, 0.1]}
            height={0.05}
            position={foot}
            sides={10}
            color={footGrey}
          />
        </group>
      ))}
      <Drum
        radii={[0.46, 0.46]}
        height={0.06}
        position={[0, 0.38, 0]}
        sides={8}
        color="#d8dbe2"
      />
      <Drum
        radii={[0.47, 0.47]}
        height={0.03}
        position={[0, 0.34, 0]}
        sides={8}
        color={footGrey}
      />
      {/* A block of electronics at the back in gold blanket, an antenna, and the arms that hold the rocket up. */}
      <Box
        size={[0.3, 0.14, 0.18]}
        position={[0, 0.48, 0.28]}
        color="#f2c14e"
        finish="foil"
      />
      <PartSet
        pieces={[-0.075, 0, 0.075].map((x) => ({
          size: [0.006, 0.135, 0.185],
          position: [x, 0.48, 0.28],
        }))}
        color="#c99a3a"
        finish="foil"
      />
      <Antenna base={[-0.3, 0.41, 0.2]} height={0.3} />
      {/* The umbilical from the electronics up to the rocket, released at lift-off. */}
      <Rod
        from={[0.06, 0.55, 0.22]}
        to={[0.06, 0.75, 0.11]}
        radius={0.012}
        color="#3a3d44"
        finish="matte"
      />
      {[1, -1].map((side) => (
        <group key={side}>
          <Rod
            from={[side * 0.36, 0.41, 0]}
            to={[side * 0.36, 1.1, 0]}
            radius={0.025}
            color={frameGrey}
          />
          <Rod
            from={[side * 0.36, 1.05, 0]}
            to={[side * 0.12, 1.05, 0]}
            radius={0.018}
            color={frameGrey}
          />
        </group>
      ))}
    </group>
  );
});

/**
 * The rocket, standing on its engine: two white stages with an orange band between them, fins at its foot, and a nose
 * cone holding the samples. Its foot is at 0, for the platform to stand it on.
 */
export const KestrelRocket = memo(function KestrelRocket() {
  return (
    <group>
      <Drum
        radii={[0.06, 0.1]}
        height={0.12}
        position={[0, 0.06, 0]}
        sides={14}
        color={nozzleDark}
        finish="metal"
      />
      <Drum
        radii={[0.11, 0.11]}
        height={0.6}
        position={[0, 0.42, 0]}
        sides={16}
        color={white}
      />
      <Drum
        radii={[0.112, 0.112]}
        height={0.06}
        position={[0, 0.75, 0]}
        sides={16}
        color={bandOrange}
      />
      <Drum
        radii={[0.09, 0.11]}
        height={0.38}
        position={[0, 0.97, 0]}
        sides={16}
        color={white}
      />
      <Drum
        radii={[0.0, 0.09]}
        height={0.22}
        position={[0, 1.27, 0]}
        sides={16}
        color={shade}
      />
      <PartSet
        pieces={[0, 1, 2, 3].map((quarter) => {
          const angle = (quarter * Math.PI) / 2 + Math.PI / 4;
          return {
            size: [0.02, 0.16, 0.1],
            position: [Math.cos(angle) * 0.13, 0.2, Math.sin(angle) * 0.13],
            rotation: [0, -angle, 0],
          };
        })}
        color={bandOrange}
      />
      {/* Seams between the rocket's panels, and the hatch the samples went in by. */}
      <PartSet
        pieces={[
          ...[0.22, 0.36, 0.58].map((y) => ({
            radii: [0.1115, 0.1115] as [number, number],
            height: 0.008,
            sides: 16,
            position: [0, y, 0] as const,
          })),
          ...[0.9, 1.06].map((y) => ({
            radii: [0.1 - (y - 0.78) * 0.05, 0.1 - (y - 0.78) * 0.05] as [
              number,
              number,
            ],
            height: 0.008,
            sides: 16,
            position: [0, y, 0] as const,
          })),
        ]}
        color={shade}
      />
      <Box
        size={[0.07, 0.07, 0.01]}
        position={[0, 1.18, -0.065]}
        rotation={[-0.4, 0, 0]}
        color={shade}
      />
    </group>
  );
});

/** The Kestrel Lifter whole, its rocket standing ready on its platform. */
export const AscentVehicle = memo(function AscentVehicle() {
  return (
    <group>
      <KestrelPlatform />
      <group position={[0, rocketBase, 0]}>
        <KestrelRocket />
      </group>
    </group>
  );
});

/** What's left of something that fell back after lifting off: a scorch, its body crumpled on its side and parts thrown clear. */
export const AscentWreck = memo(function AscentWreck({
  color,
}: {
  color: string;
}) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.1, 24]} />
        <meshBasicMaterial color="#0c0705" transparent opacity={0.7} />
      </mesh>
      <Shape
        position={[0.1, 0.18, -0.1]}
        rotation={[0.3, 0.7, 1.45]}
        color={color}
      >
        <cylinderGeometry args={[0.2, 0.3, 0.55, 12]} />
      </Shape>
      <Box
        size={[0.3, 0.06, 0.2]}
        position={[-0.55, 0.05, -0.35]}
        rotation={[0.1, 0.6, 0.2]}
        color={shade}
      />
      <Box
        size={[0.05, 0.5, 0.05]}
        position={[0.6, 0.06, 0.3]}
        rotation={[0.3, 0, 1.4]}
        color={footGrey}
      />
      <Drum
        radii={[0.05, 0.09]}
        height={0.12}
        position={[-0.3, 0.06, 0.45]}
        rotation={[1.2, 0, 0.4]}
        color={nozzleDark}
      />
    </group>
  );
});
