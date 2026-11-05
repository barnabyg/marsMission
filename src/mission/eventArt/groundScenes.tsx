import { MarsSurface, Planet, Scene, Starfield } from "./scenery";
import { Astronaut, Lander, Rover } from "./vehicles";

// The pictures of things that happen on Mars's surface, and of the Program's own achievements.

export function FirstLandingScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <MarsSurface fill={fill} />
          <Lander x={160} y={88} scale={1.4} />
          <ellipse
            cx="140"
            cy="90"
            rx="12"
            ry="3"
            fill="#d9a77a"
            opacity="0.6"
          />
          <ellipse
            cx="184"
            cy="91"
            rx="10"
            ry="2.5"
            fill="#d9a77a"
            opacity="0.6"
          />
          <path d="M226 88 V64" stroke="#e8eaf0" strokeWidth="1" />
          <circle cx="226" cy="62" r="2.5" fill="#7fd18b" />
          <circle
            cx="226"
            cy="62"
            r="6"
            fill="none"
            stroke="#7fd18b"
            strokeWidth="0.6"
            opacity="0.7"
          />
        </>
      )}
    </Scene>
  );
}

export function DustStormScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <MarsSurface fill={fill} />
          <circle cx="250" cy="24" r="8" fill="#f3e6dc" opacity="0.35" />
          <Lander x={96} y={90} scale={1.1} />
          <path
            d="M0 40 Q80 20 160 44 T320 36 V110 H0 Z"
            fill="#a8683f"
            opacity="0.55"
          />
          <path
            d="M0 62 Q90 44 180 66 T320 58 V110 H0 Z"
            fill="#c07a4a"
            opacity="0.5"
          />
          <path
            d="M20 54 q30 -10 60 0 M150 78 q34 -12 70 0 M230 50 q26 -8 52 0"
            fill="none"
            stroke="#e5b48a"
            strokeWidth="1.6"
            opacity="0.7"
          />
        </>
      )}
    </Scene>
  );
}

export function CrewArrivedScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <MarsSurface fill={fill} horizon={70} />
          <path d="M40 92 a46 34 0 0 1 92 0 Z" fill="#e8eaf0" />
          <path
            d="M52 92 a34 24 0 0 1 68 0"
            fill="none"
            stroke="#c9ced9"
            strokeWidth="1"
          />
          <rect x="78" y="80" width="16" height="12" rx="2" fill="#59607a" />
          <circle cx="68" cy="74" r="3" fill="#ffd77a" />
          <circle cx="104" cy="74" r="3" fill="#ffd77a" />
          <Astronaut x={176} y={94} />
          <Astronaut x={200} y={96} scale={1.05} />
          <Astronaut x={226} y={94} />
        </>
      )}
    </Scene>
  );
}

export function CrewLostScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <MarsSurface fill={fill} horizon={70} sky="dusk" />
          <path d="M40 92 a46 34 0 0 1 92 0 Z" fill="#a3aabd" />
          <rect x="78" y="80" width="16" height="12" rx="2" fill="#2d3448" />
          <path d="M188 96 V76 a12 10 0 0 1 24 0 V96 Z" fill="#59607a" />
          <path d="M194 82 h12 M194 87 h12" stroke="#a3aabd" strokeWidth="1" />
          <circle cx="200" cy="40" r="2" fill="#e8eaf0" />
          <circle
            cx="200"
            cy="40"
            r="6"
            fill="none"
            stroke="#e8eaf0"
            strokeWidth="0.6"
            opacity="0.6"
          />
        </>
      )}
    </Scene>
  );
}

export function SuppliesOutScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <MarsSurface fill={fill} horizon={66} />
          <g transform="translate(96 96)">
            <rect x="-26" y="-22" width="52" height="22" fill="#59607a" />
            <path
              d="M-26 -22 l-8 -10 h52 l8 10"
              fill="none"
              stroke="#a3aabd"
              strokeWidth="1.2"
            />
            <rect x="-22" y="-18" width="44" height="16" fill="#1b2236" />
          </g>
          <g transform="translate(176 96)">
            <rect x="-14" y="-16" width="28" height="16" fill="#8a6f3a" />
            <path d="M-14 -8 h28 M0 -16 v16" stroke="#59401a" strokeWidth="1" />
          </g>
          <g transform="translate(222 96) rotate(-8)">
            <rect
              x="-12"
              y="-12"
              width="24"
              height="12"
              fill="none"
              stroke="#8a6f3a"
              strokeWidth="1.4"
              strokeDasharray="3 2"
            />
          </g>
        </>
      )}
    </Scene>
  );
}

export function AssetEndedScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <MarsSurface fill={fill} sky="dusk" />
          <circle cx="262" cy="70" r="7" fill="#cfe0ff" opacity="0.8" />
          <path
            d="M40 98 q40 -6 80 -2 t80 -6"
            fill="none"
            stroke="#5a2414"
            strokeWidth="1.4"
            strokeDasharray="2 3"
            opacity="0.8"
          />
          <Rover x={210} y={92} scale={1.3} />
        </>
      )}
    </Scene>
  );
}

export function MilestoneScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <Starfield fill={fill} />
          <Planet fill={fill} planet="mars" cx={60} cy={92} r={46} />
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(
            (angle) => (
              <line
                key={angle}
                x1="0"
                y1="-26"
                x2="0"
                y2="-38"
                stroke="#ffd77a"
                strokeWidth="1.4"
                opacity="0.6"
                transform={`translate(208 52) rotate(${angle})`}
              />
            ),
          )}
          <path
            d="M196 70 l-6 22 l10 -5 l6 9 l4 -24 Z M220 70 l6 22 l-10 -5 l-6 9 l-4 -24 Z"
            fill="#e2703a"
          />
          <circle cx="208" cy="52" r="20" fill="#d9a441" />
          <circle
            cx="208"
            cy="52"
            r="15"
            fill="none"
            stroke="#fff4c2"
            strokeWidth="1.2"
          />
          <path
            d="M208 42 l3 6.5 l7 0.6 l-5.3 4.6 l1.6 6.9 l-6.3 -3.7 l-6.3 3.7 l1.6 -6.9 l-5.3 -4.6 l7 -0.6 Z"
            fill="#fff4c2"
          />
        </>
      )}
    </Scene>
  );
}

export function FundingThresholdScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <Starfield fill={fill} />
          <Planet fill={fill} planet="earth" cx={268} cy={96} r={56} />
          {[18, 30, 44, 62].map((barHeight, index) => (
            <rect
              key={barHeight}
              x={70 + index * 26}
              y={96 - barHeight}
              width="16"
              height={barHeight}
              rx="1.5"
              fill={index === 3 ? "#7fd18b" : "#4d5b80"}
            />
          ))}
          <path
            d="M66 80 L104 70 L130 60 L170 30"
            fill="none"
            stroke="#7fd18b"
            strokeWidth="2"
          />
          <path
            d="M162 28 h10 v10"
            fill="none"
            stroke="#7fd18b"
            strokeWidth="2"
          />
          <line
            x1="60"
            y1="96"
            x2="186"
            y2="96"
            stroke="#a3aabd"
            strokeWidth="1"
          />
        </>
      )}
    </Scene>
  );
}
