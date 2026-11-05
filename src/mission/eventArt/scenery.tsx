import { useId, type ReactNode } from "react";

// The parts the event pictures are drawn from, in a 320 by 110 box. Everything is drawn here, so the pictures are
// CC0 like the rest of the repository (ADR 0005).

const width = 320;
const height = 110;

/** The gradients a picture can fill with, by name. */
type Paint =
  | "space"
  | "marsSky"
  | "marsGround"
  | "marsDisc"
  | "earthDisc"
  | "sun"
  | "flame"
  | "dusk";

/** Turns a gradient's name into a fill that points at this picture's copy of it. */
export type Fill = (paint: Paint) => string;

interface SceneProps {
  children: (fill: Fill) => ReactNode;
}

/** A picture's frame and gradients. Each picture has its own ids, so two on the page never share one. */
export function Scene({ children }: SceneProps) {
  const prefix = useId().replaceAll(":", "");
  const fill: Fill = (paint) => `url(#${prefix}-${paint})`;
  const id = (paint: Paint) => `${prefix}-${paint}`;
  return (
    <svg
      className="event-picture-art"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id("space")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#05070f" />
          <stop offset="1" stopColor="#141a2e" />
        </linearGradient>
        <linearGradient id={id("marsSky")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6b4a3a" />
          <stop offset="1" stopColor="#d9a77a" />
        </linearGradient>
        <linearGradient id={id("dusk")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b2236" />
          <stop offset="0.7" stopColor="#4d5b80" />
          <stop offset="1" stopColor="#9fb3d6" />
        </linearGradient>
        <linearGradient id={id("marsGround")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b5603a" />
          <stop offset="1" stopColor="#6e2e1b" />
        </linearGradient>
        <radialGradient id={id("marsDisc")} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#e08a5a" />
          <stop offset="0.6" stopColor="#b5512e" />
          <stop offset="1" stopColor="#4a1d10" />
        </radialGradient>
        <radialGradient id={id("earthDisc")} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#8fc4ff" />
          <stop offset="0.55" stopColor="#2f6fc0" />
          <stop offset="1" stopColor="#0b2550" />
        </radialGradient>
        <radialGradient id={id("sun")}>
          <stop offset="0" stopColor="#fffbe8" />
          <stop offset="0.35" stopColor="#ffd77a" />
          <stop offset="1" stopColor="#ff9a3c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("flame")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff4c2" />
          <stop offset="0.4" stopColor="#ffb547" />
          <stop offset="1" stopColor="#e2703a" stopOpacity="0" />
        </linearGradient>
      </defs>
      {children(fill)}
    </svg>
  );
}

const starPositions = [
  [12, 14],
  [34, 62],
  [52, 22],
  [71, 88],
  [90, 40],
  [118, 12],
  [133, 70],
  [152, 30],
  [176, 92],
  [190, 50],
  [214, 16],
  [232, 76],
  [251, 34],
  [272, 58],
  [290, 20],
  [306, 84],
  [24, 98],
  [104, 100],
  [162, 8],
  [244, 100],
  [298, 46],
  [64, 44],
] as const;

/** A dark sky with stars, filling the picture. */
export function Starfield({ fill }: { fill: Fill }) {
  return (
    <>
      <rect width={width} height={height} fill={fill("space")} />
      {starPositions.map(([x, y], index) => (
        <circle
          key={index}
          cx={x}
          cy={y}
          r={index % 3 === 0 ? 1.1 : 0.6}
          fill="#e8eaf0"
          opacity={index % 2 === 0 ? 0.9 : 0.5}
        />
      ))}
    </>
  );
}

/** Mars's sky and rolling ground, with the horizon at `horizon`. */
export function MarsSurface({
  fill,
  horizon = 74,
  sky = "marsSky",
}: {
  fill: Fill;
  horizon?: number;
  sky?: "marsSky" | "dusk";
}) {
  return (
    <>
      <rect width={width} height={height} fill={fill(sky)} />
      <path
        d={`M0 ${horizon} Q60 ${horizon - 8} 120 ${horizon - 2} T240 ${horizon - 4} T320 ${horizon} V110 H0 Z`}
        fill="#8a4428"
        opacity="0.7"
      />
      <path
        d={`M0 ${horizon + 6} Q80 ${horizon} 160 ${horizon + 5} T320 ${horizon + 3} V110 H0 Z`}
        fill={fill("marsGround")}
      />
      <ellipse
        cx="70"
        cy={horizon + 22}
        rx="9"
        ry="2.5"
        fill="#5a2414"
        opacity="0.6"
      />
      <ellipse
        cx="250"
        cy={horizon + 28}
        rx="13"
        ry="3"
        fill="#5a2414"
        opacity="0.6"
      />
      <circle cx="210" cy={horizon + 15} r="2.2" fill="#4a1d10" />
      <circle cx="40" cy={horizon + 30} r="1.8" fill="#4a1d10" />
    </>
  );
}

/** A planet's disc, lit from the top left. */
export function Planet({
  fill,
  planet,
  cx,
  cy,
  r,
}: {
  fill: Fill;
  planet: "mars" | "earth";
  cx: number;
  cy: number;
  r: number;
}) {
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={r * 1.06}
        fill={planet === "earth" ? "#5aa0ff" : "#e2703a"}
        opacity="0.18"
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={fill(planet === "earth" ? "earthDisc" : "marsDisc")}
      />
      {planet === "earth" ? (
        <>
          <path
            d={`M${cx - r * 0.5} ${cy - r * 0.3} q${r * 0.25} ${-r * 0.25} ${r * 0.5} ${-r * 0.05} t${r * 0.2} ${r * 0.35} q${-r * 0.3} ${r * 0.2} ${-r * 0.6} ${-r * 0.05} Z`}
            fill="#4f9a57"
            opacity="0.8"
          />
          <path
            d={`M${cx + r * 0.1} ${cy + r * 0.25} q${r * 0.3} ${-r * 0.1} ${r * 0.45} ${r * 0.15} q${-r * 0.2} ${r * 0.3} ${-r * 0.45} ${r * 0.1} Z`}
            fill="#4f9a57"
            opacity="0.7"
          />
        </>
      ) : (
        <>
          <ellipse
            cx={cx + r * 0.15}
            cy={cy + r * 0.1}
            rx={r * 0.45}
            ry={r * 0.12}
            fill="#7a2f17"
            opacity="0.5"
          />
          <ellipse
            cx={cx - r * 0.3}
            cy={cy - r * 0.35}
            rx={r * 0.2}
            ry={r * 0.08}
            fill="#7a2f17"
            opacity="0.4"
          />
          <ellipse
            cx={cx}
            cy={cy - r * 0.86}
            rx={r * 0.28}
            ry={r * 0.09}
            fill="#f3e6dc"
            opacity="0.8"
          />
        </>
      )}
    </g>
  );
}

/** A rocket standing on its tail, centred on `x`, with its base at `y`. */
export function Rocket({
  x,
  y,
  scale = 1,
  boosters = false,
}: {
  x: number;
  y: number;
  scale?: number;
  boosters?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {boosters && (
        <>
          <rect x="-11" y="-34" width="5" height="32" rx="2" fill="#c9ced9" />
          <rect x="6" y="-34" width="5" height="32" rx="2" fill="#c9ced9" />
          <path
            d="M-11 -34 l2.5 -6 l2.5 6 Z M6 -34 l2.5 -6 l2.5 6 Z"
            fill="#c9ced9"
          />
        </>
      )}
      <rect x="-6" y="-56" width="12" height="54" rx="2" fill="#eef0f5" />
      <rect x="-6" y="-40" width="12" height="4" fill="#e2703a" />
      <rect x="-6" y="-20" width="12" height="2" fill="#2d3448" />
      <path d="M-6 -56 Q0 -72 6 -56 Z" fill="#d6dae3" />
      <path d="M-6 -8 l-6 8 h6 Z M6 -8 l6 8 h-6 Z" fill="#2d3448" />
      <rect x="-4" y="-2" width="8" height="3" fill="#59607a" />
    </g>
  );
}

/** A flame pouring down from (`x`, `y`), `length` long. */
export function Plume({
  fill,
  x,
  y,
  length,
  spread = 8,
  angle = 0,
}: {
  fill: Fill;
  x: number;
  y: number;
  length: number;
  spread?: number;
  angle?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path
        d={`M${-spread / 2} 0 Q${-spread} ${length * 0.5} 0 ${length} Q${spread} ${length * 0.5} ${spread / 2} 0 Z`}
        fill={fill("flame")}
      />
      <path
        d={`M${-spread / 5} 0 Q${-spread / 3} ${length * 0.3} 0 ${length * 0.5} Q${spread / 3} ${length * 0.3} ${spread / 5} 0 Z`}
        fill="#fffbe8"
        opacity="0.9"
      />
    </g>
  );
}

/** A small spacecraft with two solar wings, centred on (`x`, `y`). */
export function Spacecraft({
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
        x="-26"
        y="-5"
        width="16"
        height="10"
        fill="#2f4f8a"
        stroke="#8cc8ff"
        strokeWidth="0.6"
      />
      <rect
        x="10"
        y="-5"
        width="16"
        height="10"
        fill="#2f4f8a"
        stroke="#8cc8ff"
        strokeWidth="0.6"
      />
      <path
        d="M-22 -5 v10 M-18 -5 v10 M-14 -5 v10 M14 -5 v10 M18 -5 v10 M22 -5 v10"
        stroke="#8cc8ff"
        strokeWidth="0.4"
        opacity="0.6"
      />
      <rect x="-10" y="-1" width="20" height="2" fill="#a3aabd" />
      <rect x="-6" y="-7" width="12" height="14" rx="1.5" fill="#d9a441" />
      <path d="M-6 -2 h12 M-6 3 h12" stroke="#a67a26" strokeWidth="0.6" />
      <path
        d="M-4 -7 Q0 -14 4 -7"
        fill="none"
        stroke="#e8eaf0"
        strokeWidth="1.2"
      />
      <line x1="0" y1="-11" x2="0" y2="-7" stroke="#e8eaf0" strokeWidth="0.8" />
    </g>
  );
}
