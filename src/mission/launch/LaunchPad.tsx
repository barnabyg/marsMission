import { memo } from "react";
import { Box, Drum, Rod, Shape } from "../surface/modelParts";

import { SunlitParts } from "./SunlitParts";

const steel = "#667989";
const rail = "#f4be65";
const yard = "#828c90";

function ServiceTower() {
  return (
    <group position={[-2.8, 0, -1.5]}>
      {[-0.62, 0.62].flatMap((x) =>
        [-0.62, 0.62].map((z) => (
          <Box
            key={`${x}/${z}`}
            position={[x, 6, z]}
            size={[0.14, 12, 0.14]}
            color={steel}
          />
        )),
      )}
      {Array.from({ length: 8 }, (_, i) => {
        const y = 0.3 + i * 1.5;
        return (
          <group key={i} position={[0, y, 0]}>
            <Box position={[0, 0, 0]} size={[1.5, 0.12, 1.5]} color={steel} />
            <Rod
              from={[-0.62, 0, 0.62]}
              to={[0.62, 1.5, 0.62]}
              radius={0.045}
              color={steel}
            />
            <Rod
              from={[0.62, 0, 0.62]}
              to={[0.62, 1.5, -0.62]}
              radius={0.045}
              color={steel}
            />
            <Rod
              from={[0.62, 0, 0.62]}
              to={[-0.62, 1.5, 0.62]}
              radius={0.037}
              color={steel}
            />
            <Box
              position={[0, 0.24, 0.72]}
              size={[1.45, 0.045, 0.045]}
              color={rail}
            />
          </group>
        );
      })}
      {[4.8, 7.8, 10.8].map((y) => (
        <group key={y} position={[0, y, 0]}>
          <Box position={[1.3, 0, 0]} size={[1.75, 0.15, 0.55]} color={steel} />
          <Box
            position={[1.3, 0.28, 0.25]}
            size={[1.75, 0.06, 0.06]}
            color={rail}
          />
          {[0.55, 1.3, 2.1].map((x) => (
            <Box
              key={x}
              position={[x, 0.14, 0.25]}
              size={[0.04, 0.28, 0.04]}
              color={rail}
            />
          ))}
        </group>
      ))}
      <Rod from={[0, 11.8, 0]} to={[0, 14, 0]} radius={0.04} color={steel} />
    </group>
  );
}

export const LaunchPad = memo(function LaunchPad() {
  return (
    <SunlitParts>
      <Box position={[0, -0.04, 0]} size={[17, 0.14, 12]} color={yard} />
      {/* The two piers carry the deck across a channel that is open at both ends. */}
      <Box position={[0, 0.04, 0]} size={[8.4, 0.06, 1.8]} color="#363a3e" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box
            position={[0, 0.55, side * 1.5]}
            size={[4.6, 1.1, 1.3]}
            color="#697579"
          />
          <Box
            position={[0, 1.15, side * 1.52]}
            size={[4.8, 0.12, 1.56]}
            color="#b0b5af"
          />
          <Box
            position={[0, 1.22, side * 0.85]}
            size={[4.74, 0.09, 0.16]}
            color="#303940"
          />
          {[-1.95, -1.4, -0.85, -0.3, 0.25, 0.8, 1.35, 1.9].map((x) => (
            <Box
              key={x}
              position={[x, 1.22, side * 2.16]}
              rotation={[0, -side * 0.5, 0]}
              size={[0.24, 0.025, 0.22]}
              color={rail}
            />
          ))}
          <Box
            position={[-1.6, 0.1, side * 1.12]}
            size={[6.9, 0.16, 0.22]}
            color="#7f8888"
          />
        </group>
      ))}
      {[-1.6, -0.56, 0.56, 1.6].map((x) => (
        <Box
          key={x}
          position={[x, 1.13, 0]}
          size={[0.22, 0.16, 1.8]}
          color="#495760"
        />
      ))}
      <Box position={[0, -0.04, 42]} size={[2.8, 0.12, 74]} color="#69716e" />
      {Array.from({ length: 19 }, (_, i) => (
        <Box
          key={i}
          position={[0, 0.028, 6 + i * 3.8]}
          size={[0.065, 0.014, 1.4]}
          color="#d2c399"
        />
      ))}
      <ServiceTower />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box
            position={[side * 3.1, 0.04, 0]}
            size={[0.055, 0.025, 6.2]}
            color={rail}
          />
          <Box
            position={[0, 0.04, side * 3.1]}
            size={[6.25, 0.025, 0.055]}
            color={rail}
          />
          <Rod
            from={[-10, 0.32, -5 + side * 0.17]}
            to={[-3, 0.32, -5 + side * 0.17]}
            radius={0.1}
            color="#d0ccbc"
          />
          <Rod
            from={[-3, 0.32, -5 + side * 0.17]}
            to={[-2, 0.32, -1.5 + side * 0.17]}
            radius={0.1}
            color="#d0ccbc"
          />
        </group>
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <Box
          key={i}
          position={[2.32 + i * 0.22, 1.05 - i * 0.15, 1.15]}
          size={[0.28, 0.18, 0.85]}
          color={steel}
        />
      ))}
      <Rod
        from={[2.28, 1.62, 1.56]}
        to={[3.72, 0.58, 1.56]}
        radius={0.035}
        color={rail}
      />
      {[2.32, 3.05, 3.7].map((x, i) => (
        <Box
          key={x}
          position={[x, 1.35 - i * 0.51, 1.56]}
          size={[0.055, 0.55, 0.055]}
          color={rail}
        />
      ))}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 5.4, 0, -4.4]}>
          <Rod
            from={[0, 0, 0]}
            to={[0, 4.25, 0]}
            radius={0.055}
            color={steel}
          />
          <Box position={[0, 4.2, 0]} size={[1.05, 0.42, 0.24]} color={steel} />
          {[-0.33, 0, 0.33].map((x) => (
            <Drum
              key={x}
              position={[x, 4.2, 0.13]}
              radii={[0.135, 0.135]}
              height={0.09}
              rotation={[Math.PI / 2, 0, 0]}
              color="#fff1c3"
              sides={12}
            />
          ))}
        </group>
      ))}
      {[-11, -15].map((x) => (
        <group key={x} position={[x, 0, -7]}>
          <Drum
            position={[0, 1.15, 0]}
            radii={[1.5, 1.5]}
            height={2.3}
            color="#c9d3d4"
            sides={32}
          />
          <Shape
            position={[0, 2.3, 0]}
            scale={[1.5, 0.42, 1.5]}
            color="#b5c5ca"
          >
            <sphereGeometry args={[1, 24, 12]} />
          </Shape>
          <Drum
            position={[0, 0.45, 0]}
            radii={[1.52, 1.52]}
            height={0.13}
            color={steel}
            sides={32}
          />
        </group>
      ))}
    </SunlitParts>
  );
});
