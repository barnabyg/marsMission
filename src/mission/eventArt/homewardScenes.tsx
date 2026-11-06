import {
  MarsSurface,
  Planet,
  Plume,
  Scene,
  Starfield,
  type Fill,
} from "./scenery";
import { Astronaut } from "./vehicles";

// The pictures of coming home from Mars: lifting off, meeting what brings it home, leaving Mars orbit, coming down at
// Earth, the Crew and the samples home, and a return vehicle waiting in Mars orbit.

/** An Earth return stage: a cream tank with an orange band, its engine behind, and a capsule ahead, facing +x. */
function ReturnStage({
  x,
  y,
  scale = 1,
  angle = 0,
}: {
  x: number;
  y: number;
  scale?: number;
  angle?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
      <rect
        x="-20"
        y="-16"
        width="9"
        height="11"
        fill="#2f4f8a"
        stroke="#8cc8ff"
        strokeWidth="0.5"
      />
      <rect
        x="-20"
        y="5"
        width="9"
        height="11"
        fill="#2f4f8a"
        stroke="#8cc8ff"
        strokeWidth="0.5"
      />
      <path d="M-26 -4 L-30 -6 V6 L-26 4 Z" fill="#59607a" />
      <rect x="-26" y="-7" width="20" height="14" rx="2" fill="#efe8d8" />
      <rect x="-18" y="-7" width="3" height="14" fill="#e2703a" />
      <path d="M-6 -8 L8 -4 V4 L-6 8 Z" fill="#d6dae3" />
      <rect x="-7" y="-8.5" width="2" height="17" fill="#7a3a22" />
      <rect x="8" y="-2" width="3" height="4" fill="#a3aabd" />
    </g>
  );
}

/** The Crew's cabin after Mars ascent, a small capsule with windows, its docking ring at +x. */
function Cabin({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M-9 -8 L5 -8 L10 -4 V4 L5 8 L-9 8 Z" fill="#eef0f5" />
      <rect x="-5" y="-3" width="3" height="3" fill="#2d3448" />
      <rect x="0" y="-3" width="3" height="3" fill="#2d3448" />
      <rect x="10" y="-2" width="2.5" height="4" fill="#a3aabd" />
      <path d="M-9 -5 L-13 -6 V6 L-9 5 Z" fill="#59607a" />
    </g>
  );
}

/** Rippled ocean under a pale sky, with the horizon at `horizon`. */
function Ocean({ fill, horizon }: { fill: Fill; horizon: number }) {
  return (
    <>
      <rect width="320" height="110" fill={fill("dusk")} />
      <rect width="320" height={horizon} fill="#9fc3e6" opacity="0.55" />
      <rect y={horizon} width="320" height={110 - horizon} fill="#2d5f8f" />
      {[8, 18, 30].map((below, index) => (
        <path
          key={below}
          d={`M${20 + index * 30} ${horizon + below} q12 -3 24 0 M${150 + index * 40} ${horizon + below + 4} q14 -3 28 0`}
          fill="none"
          stroke="#8cc8ff"
          strokeWidth="0.8"
          opacity="0.6"
        />
      ))}
    </>
  );
}

/** A capsule floating on its heat shield. */
function FloatingCapsule({
  x,
  y,
  scale = 1,
}: {
  x: number;
  y: number;
  scale?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M-7 -12 L7 -12 L13 0 L-13 0 Z" fill="#d6dae3" />
      <rect x="-4" y="-8" width="3" height="3" fill="#2d3448" />
      <rect x="1" y="-8" width="3" height="3" fill="#2d3448" />
      <path d="M-14 0 Q0 4 14 0 Z" fill="#7a3a22" />
      <ellipse cx="0" cy="2" rx="22" ry="3" fill="#e8f2fb" opacity="0.6" />
    </g>
  );
}

export function MarsAscentScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <MarsSurface fill={fill} horizon={72} sky="dusk" />
          {/* The descent stage left standing, and the cabin climbing away on its plume. */}
          <path
            d="M136 98 L142 84 M184 98 L178 84 M150 98 L152 84 M170 98 L168 84"
            stroke="#a3aabd"
            strokeWidth="1.6"
          />
          <rect x="138" y="78" width="44" height="8" rx="1" fill="#a9adb6" />
          <ellipse
            cx="160"
            cy="99"
            rx="40"
            ry="5"
            fill="#d9a77a"
            opacity="0.55"
          />
          <Plume fill={fill} x={160} y={50} length={26} spread={9} />
          <path
            d="M150 50 L150 34 L156 26 L164 26 L170 34 L170 50 Z"
            fill="#eef0f5"
          />
          <rect x="154" y="35" width="4" height="4" fill="#2d3448" />
          <rect x="162" y="35" width="4" height="4" fill="#2d3448" />
          <rect x="158" y="20" width="4" height="6" fill="#a3aabd" />
        </>
      )}
    </Scene>
  );
}

export function MarsOrbitRendezvousScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <Starfield fill={fill} />
          <Planet fill={fill} planet="mars" cx={160} cy={412} r={320} />
          <ReturnStage x={118} y={46} scale={1.1} />
          <path
            d="M136 46 H188"
            stroke="#ffb547"
            strokeWidth="1.6"
            strokeDasharray="4 3"
          />
          <g transform="translate(206 46) scale(-1 1)">
            <Cabin x={0} y={0} scale={1.1} />
          </g>
          <circle
            cx="160"
            cy="46"
            r="14"
            fill="none"
            stroke="#8cc8ff"
            strokeWidth="0.8"
            opacity="0.6"
          />
        </>
      )}
    </Scene>
  );
}

export function TransEarthInjectionScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <Starfield fill={fill} />
          <Planet fill={fill} planet="mars" cx={40} cy={84} r={30} />
          <Planet fill={fill} planet="earth" cx={290} cy={28} r={10} />
          <path
            d="M70 78 Q170 100 278 34"
            fill="none"
            stroke="#7fe7ff"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
          <Plume
            fill={fill}
            x={136}
            y={70}
            length={34}
            spread={10}
            angle={110}
          />
          <ReturnStage x={160} y={62} scale={1} angle={-20} />
        </>
      )}
    </Scene>
  );
}

export function EarthEntryScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <Ocean fill={fill} horizon={84} />
          {/* Three parachutes, striped orange and white. */}
          {[
            { cx: 136, cy: 20, color: "#e2703a" },
            { cx: 160, cy: 14, color: "#f4f1ea" },
            { cx: 184, cy: 20, color: "#e2703a" },
          ].map(({ cx, cy, color }) => (
            <g key={cx}>
              <path d={`M${cx - 13} ${cy} a13 10 0 0 1 26 0 Z`} fill={color} />
              <path
                d={`M${cx - 13} ${cy} L160 60 M${cx + 13} ${cy} L160 60`}
                stroke="#e8eaf0"
                strokeWidth="0.5"
              />
            </g>
          ))}
          <path d="M153 60 L167 60 L172 70 L148 70 Z" fill="#d6dae3" />
          <path d="M147 70 Q160 74 173 70 Z" fill="#7a3a22" />
          <path
            d="M252 84 h34 l-4 6 h-28 Z M262 84 v-6 h10 v6"
            fill="#5d6673"
          />
        </>
      )}
    </Scene>
  );
}

export function CrewHomeScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <Ocean fill={fill} horizon={66} />
          <path d="M196 66 h92 l-8 12 h-76 Z" fill="#5d6673" />
          <rect x="226" y="54" width="26" height="12" fill="#c9ced6" />
          <FloatingCapsule x={110} y={92} scale={1.2} />
          {/* The Crew, home, waving from the recovery boat. */}
          <path d="M150 96 h70 l-6 9 h-58 Z" fill="#e2703a" />
          <Astronaut x={172} y={96} scale={0.75} />
          <Astronaut x={192} y={96} scale={0.75} />
          <path
            d="M166 79 l-5 -6 M198 79 l5 -6"
            stroke="#eef0f5"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}
    </Scene>
  );
}

export function SamplesScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <rect width="320" height="110" fill={fill("space")} />
          <rect y="80" width="320" height="30" fill="#2d3448" />
          {/* A rack of sealed sample tubes, each holding a core of red Mars rock. */}
          <rect x="96" y="70" width="128" height="12" rx="2" fill="#a3aabd" />
          {[0, 1, 2, 3, 4, 5, 6].map((index) => {
            const x = 106 + index * 17;
            return (
              <g key={index}>
                <rect
                  x={x}
                  y="24"
                  width="9"
                  height="50"
                  rx="4.5"
                  fill="#e8eaf0"
                  opacity="0.9"
                />
                <rect
                  x={x + 1.5}
                  y={40 + (index % 3) * 6}
                  width="6"
                  height={30 - (index % 3) * 6}
                  rx="3"
                  fill={index % 2 === 0 ? "#b5512e" : "#8a4428"}
                />
                <rect
                  x={x - 0.5}
                  y="20"
                  width="10"
                  height="6"
                  rx="1"
                  fill="#59607a"
                />
              </g>
            );
          })}
          <Planet fill={fill} planet="mars" cx={290} cy={24} r={12} />
        </>
      )}
    </Scene>
  );
}

export function ReturnVehicleArrivedScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <Starfield fill={fill} />
          <ellipse
            cx="180"
            cy="58"
            rx="120"
            ry="34"
            fill="none"
            stroke="#a3aabd"
            strokeWidth="1"
            strokeDasharray="3 4"
            transform="rotate(-8 180 58)"
          />
          <Planet fill={fill} planet="mars" cx={180} cy={58} r={40} />
          <ReturnStage x={76} y={68} scale={0.95} angle={12} />
        </>
      )}
    </Scene>
  );
}
