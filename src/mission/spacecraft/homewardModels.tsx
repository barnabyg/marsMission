import { At, Part, SolarArray } from "./spacecraftModels";

/**
 * The craft of a journey home, lit by the Sun as the spacecraft view's other models are: the Earth return stage that
 * brings Crew home, which a return vehicle flies to Mars orbit, the Earth return orbiter that brings samples home, and
 * what lifts each off the surface to meet them. Simple models made here from three.js shapes, so they use no art file
 * (ADR 0005). Each lies along x, with its front, which docks, towards +x.
 */

const foilCream = "#e8e2d4";
const bandOrange = "#d9792b";
const engineDark = "#55585f";
const capsuleWhite = "#d7dae0";
const heatShield = "#7a4a2c";
const panelBlue = "#20345e";
const ringGrey = "#8a8d94";

/** Turns a part standing along y to lie along x, its top towards +x, so that an engine bell opens towards -x. */
const alongX = [0, 0, -Math.PI / 2] as const;

/** A capsule for coming home through Earth's atmosphere, its heat shield towards -x and its nose, which docks, towards +x. */
function Capsule({
  lost,
  x,
  size,
}: {
  lost: boolean;
  x: number;
  size: number;
}) {
  return (
    <At position={[x, 0, 0]} rotation={alongX}>
      <Part color={capsuleWhite} lost={lost}>
        <cylinderGeometry args={[size * 0.45, size, size * 0.85, 24]} />
      </Part>
      <At position={[0, -size * 0.47, 0]}>
        <Part color={heatShield} lost={lost}>
          <cylinderGeometry
            args={[size * 1.04, size * 1.04, size * 0.12, 24]}
          />
        </Part>
      </At>
    </At>
  );
}

/**
 * The Earth return stage: a cream propellant tank with an orange band, its engine behind, the capsule the Crew come
 * home in ahead with a docking port on its nose, and a blue solar wing either side.
 */
export function EarthReturnStage({ lost }: { lost: boolean }) {
  return (
    <>
      <At position={[-0.12, 0, 0]} rotation={alongX}>
        <Part color={foilCream} lost={lost}>
          <cylinderGeometry args={[0.27, 0.27, 0.42, 24]} />
        </Part>
        <Part color={bandOrange} lost={lost}>
          <cylinderGeometry args={[0.275, 0.275, 0.07, 24]} />
        </Part>
      </At>
      <At position={[-0.4, 0, 0]} rotation={alongX}>
        <Part color={engineDark} lost={lost}>
          <coneGeometry args={[0.15, 0.2, 20, 1, true]} />
        </Part>
      </At>
      <Capsule lost={lost} x={0.24} size={0.22} />
      <At position={[0.41, 0, 0]} rotation={alongX}>
        <Part color={ringGrey} lost={lost}>
          <cylinderGeometry args={[0.07, 0.07, 0.06, 16]} />
        </Part>
      </At>
      {[1, -1].map((side) => (
        <At key={side} position={[-0.12, side * 0.55, 0]}>
          <Part color={panelBlue} lost={lost}>
            <boxGeometry args={[0.3, 0.5, 0.02]} />
          </Part>
        </At>
      ))}
    </>
  );
}

/**
 * The Earth return orbiter: a silver bus over a big propellant tank and its engine, the samples' capsule riding on its
 * front, a dish on a mast above, and a solar array either side, folded flat against it for the journey.
 */
export function ReturnOrbiter({
  lost,
  deployed = false,
}: {
  lost: boolean;
  deployed?: boolean;
}) {
  return (
    <>
      <Part color="#cfd3da" lost={lost}>
        <boxGeometry args={[0.44, 0.34, 0.4]} />
      </Part>
      <At position={[0, 0.18, 0]}>
        <Part color={bandOrange} lost={lost}>
          <boxGeometry args={[0.46, 0.03, 0.42]} />
        </Part>
      </At>
      <At position={[0, -0.32, 0]}>
        <Part color={foilCream} lost={lost}>
          <cylinderGeometry args={[0.2, 0.2, 0.3, 24]} />
        </Part>
      </At>
      <At position={[0, -0.52, 0]}>
        <Part color={engineDark} lost={lost}>
          <coneGeometry args={[0.12, 0.16, 20, 1, true]} />
        </Part>
      </At>
      <Capsule lost={lost} x={0.3} size={0.13} />
      <At position={[-0.1, 0.3, 0]}>
        <Part color="#a9acb3" lost={lost}>
          <cylinderGeometry args={[0.02, 0.02, 0.22, 8]} />
        </Part>
      </At>
      <At position={[-0.1, 0.43, 0]} rotation={[Math.PI, 0, 0]}>
        <Part color="#eef0f4" lost={lost} double>
          <coneGeometry args={[0.16, 0.06, 24, 1, true]} />
        </Part>
      </At>
      {deployed ? (
        <>
          <SolarArray side={1} lost={lost} />
          <SolarArray side={-1} lost={lost} />
        </>
      ) : (
        [1, -1].map((side) => (
          <At key={side} position={[0, 0, side * 0.22]}>
            <Part color={panelBlue} lost={lost}>
              <boxGeometry args={[0.4, 0.3, 0.02]} />
            </Part>
          </At>
        ))
      )}
    </>
  );
}

/** The Crew's cabin after Mars ascent, on its way up to dock: a white drum with windows, narrowing to its docking ring at +x. */
export function AscentCabin({ lost }: { lost: boolean }) {
  return (
    <>
      <At position={[0, 0, 0]} rotation={alongX}>
        <Part color="#eceef2" lost={lost}>
          <cylinderGeometry args={[0.24, 0.26, 0.34, 20]} />
        </Part>
      </At>
      <At position={[0.25, 0, 0]} rotation={alongX}>
        <Part color={capsuleWhite} lost={lost}>
          <cylinderGeometry args={[0.1, 0.24, 0.16, 20]} />
        </Part>
      </At>
      <At position={[0.35, 0, 0]} rotation={alongX}>
        <Part color={ringGrey} lost={lost}>
          <cylinderGeometry args={[0.08, 0.08, 0.05, 16]} />
        </Part>
      </At>
      {[-0.1, 0.1].map((y) => (
        <At key={y} position={[0.05, y, -0.25]}>
          <Part color="#1b2433" lost={lost}>
            <boxGeometry args={[0.1, 0.07, 0.02]} />
          </Part>
        </At>
      ))}
      <At position={[-0.2, 0, 0]} rotation={alongX}>
        <Part color={engineDark} lost={lost}>
          <coneGeometry args={[0.1, 0.12, 16, 1, true]} />
        </Part>
      </At>
    </>
  );
}

/** The ascent vehicle's upper stage after Mars ascent, carrying the samples' canister on its nose at +x. */
export function SampleStage({ lost }: { lost: boolean }) {
  return (
    <>
      <At position={[-0.05, 0, 0]} rotation={alongX}>
        <Part color="#eef0f4" lost={lost}>
          <cylinderGeometry args={[0.1, 0.1, 0.4, 16]} />
        </Part>
        <At position={[0, 0.18, 0]}>
          <Part color={bandOrange} lost={lost}>
            <cylinderGeometry args={[0.102, 0.102, 0.04, 16]} />
          </Part>
        </At>
      </At>
      <At position={[0.22, 0, 0]}>
        <Part color={capsuleWhite} lost={lost}>
          <sphereGeometry args={[0.1, 16, 12]} />
        </Part>
      </At>
      <At position={[-0.3, 0, 0]} rotation={alongX}>
        <Part color={engineDark} lost={lost}>
          <coneGeometry args={[0.07, 0.1, 14, 1, true]} />
        </Part>
      </At>
    </>
  );
}
