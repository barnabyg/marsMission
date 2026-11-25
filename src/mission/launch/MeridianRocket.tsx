import { Batched, Box, Drum } from "../surface/modelParts";
import { rocketProfile } from "./launch";

const enamel = "#f0eee7";
const graphite = "#354453";
const copper = "#c56539";

function Engine({ radius }: { radius: number }) {
  return (
    <Drum
      position={[0, 0.31, 0]}
      radii={[radius * 0.52, radius]}
      height={0.62}
      color="#515458"
      finish="metal"
      sides={20}
    />
  );
}

/** Engines, tank barrel, cable raceway and strap-on boosters stay with the first stage in a breakup. */
function Core({ vehicleId }: { vehicleId: string }) {
  const { height, radius, engines, boosters } = rocketProfile(vehicleId);
  const barrel = height * 0.66;
  return (
    <Batched>
      <Drum
        position={[0, 0.6 + barrel / 2, 0]}
        radii={[radius, radius]}
        height={barrel}
        color={enamel}
        sides={40}
      />
      {[0.08, 0.14, 0.94].map((share) => (
        <Drum
          key={share}
          position={[0, 0.6 + barrel * share, 0]}
          radii={[radius * 1.012, radius * 1.012]}
          height={share === 0.94 ? 0.45 : 0.12}
          color={graphite}
          sides={40}
        />
      ))}
      {[0.25, 0.48, 0.73].map((share) => (
        <Drum
          key={share}
          position={[0, 0.6 + barrel * share, 0]}
          radii={[radius * 1.007, radius * 1.007]}
          height={0.035}
          color="#aeb5b6"
          sides={40}
        />
      ))}
      {Array.from({ length: 20 }, (_, i) => {
        const angle = (i * Math.PI) / 10;
        return (
          <Box
            key={i}
            position={[
              radius * Math.cos(angle),
              barrel * 0.86 + 0.6,
              radius * Math.sin(angle),
            ]}
            rotation={[0, -angle, 0]}
            size={[0.04, barrel * 0.09, 0.045]}
            color="#acb2b0"
          />
        );
      })}
      <Box
        position={[0, barrel * 0.52 + 0.6, radius]}
        size={[0.12, barrel * 0.9, 0.06]}
        color={copper}
      />
      {Array.from({ length: engines }, (_, i) => {
        const angle = (i * 2 * Math.PI) / engines;
        const offset = engines === 1 ? 0 : radius * 0.57;
        return (
          <group
            key={i}
            position={[offset * Math.cos(angle), 0, offset * Math.sin(angle)]}
          >
            <Engine radius={radius * (engines === 1 ? 0.72 : 0.34)} />
          </group>
        );
      })}
      {Array.from({ length: boosters }, (_, i) => {
        const angle = (i * 2 * Math.PI) / boosters;
        const r = radius * 0.46;
        const length = barrel * 0.78;
        return (
          <group
            key={i}
            position={[
              (radius + r) * Math.cos(angle),
              0,
              (radius + r) * Math.sin(angle),
            ]}
          >
            <Engine radius={r * 0.8} />
            <Drum
              position={[0, 0.56 + length / 2, 0]}
              radii={[r, r]}
              height={length}
              color={enamel}
              sides={24}
            />
            <Drum
              position={[0, length + 0.96, 0]}
              radii={[0.04, r]}
              height={0.8}
              color={copper}
              sides={24}
            />
            <Drum
              position={[0, 1.2, 0]}
              radii={[r * 1.02, r * 1.02]}
              height={0.23}
              color={graphite}
              sides={24}
            />
          </group>
        );
      })}
    </Batched>
  );
}

export function MeridianRocket({
  vehicleId,
  apart,
}: {
  vehicleId: string;
  apart: number;
}) {
  const { height, radius } = rocketProfile(vehicleId);
  const joint = height * 0.66 + 0.6;
  const upper = height - joint;
  return (
    <>
      <group rotation={[0, 0, apart * 0.6]}>
        <Core vehicleId={vehicleId} />
      </group>
      <group
        position={[apart * 2, joint + apart * 1.6, 0]}
        rotation={[apart * 0.7, 0, -apart * 0.8]}
      >
        <Batched>
          <Drum
            position={[0, upper * 0.09, 0]}
            radii={[radius * 1.19, radius]}
            height={upper * 0.18}
            color={graphite}
            sides={40}
          />
          <Drum
            position={[0, upper * 0.4, 0]}
            radii={[radius * 1.19, radius * 1.19]}
            height={upper * 0.44}
            color={enamel}
            sides={40}
          />
          <Drum
            position={[0, upper * 0.24, 0]}
            radii={[radius * 1.2, radius * 1.2]}
            height={0.14}
            color={copper}
            sides={40}
          />
          <Drum
            position={[0, upper * 0.72, 0]}
            radii={[radius * 0.85, radius * 1.19]}
            height={upper * 0.2}
            color={enamel}
            sides={40}
          />
          <Drum
            position={[0, upper * 0.91, 0]}
            radii={[0.03, radius * 0.85]}
            height={upper * 0.18}
            color={enamel}
            sides={40}
          />
        </Batched>
      </group>
    </>
  );
}
