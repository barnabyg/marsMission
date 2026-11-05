import { Planet, Plume, Rocket, Scene, Spacecraft, Starfield } from "./scenery";
import { Capsule } from "./vehicles";

// The pictures of things that happen on the way to Mars and back, and in orbit there.

export function LaunchScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <rect width="320" height="110" fill={fill("dusk")} />
          <circle cx="250" cy="22" r="1" fill="#e8eaf0" />
          <circle cx="60" cy="14" r="0.8" fill="#e8eaf0" />
          <rect y="94" width="320" height="16" fill="#1b2236" />
          <path
            d="M142 94 V18 M150 94 V18 M142 18 h8"
            stroke="#59607a"
            strokeWidth="1.5"
          />
          <path
            d="M142 30 l8 8 M150 30 l-8 8 M142 50 l8 8 M150 50 l-8 8 M142 70 l8 8 M150 70 l-8 8"
            stroke="#59607a"
            strokeWidth="0.8"
          />
          <path d="M150 40 h10" stroke="#59607a" strokeWidth="1.2" />
          <Plume fill={fill} x={166} y={86} length={18} spread={12} />
          <Rocket x={166} y={86} boosters />
          <ellipse
            cx="150"
            cy="100"
            rx="42"
            ry="9"
            fill="#e8eaf0"
            opacity="0.55"
          />
          <ellipse
            cx="190"
            cy="98"
            rx="30"
            ry="7"
            fill="#c9ced9"
            opacity="0.5"
          />
          <ellipse
            cx="122"
            cy="99"
            rx="22"
            ry="6"
            fill="#d6dae3"
            opacity="0.5"
          />
        </>
      )}
    </Scene>
  );
}

export function TankerLaunchScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <Starfield fill={fill} />
          <Planet fill={fill} planet="earth" cx={160} cy={330} r={260} />
          <path
            d="M120 104 Q150 90 176 56"
            fill="none"
            stroke="#e8eaf0"
            strokeWidth="2.5"
            opacity="0.35"
          />
          <g transform="rotate(32 186 46)">
            <Plume fill={fill} x={186} y={46} length={16} spread={9} />
            <Rocket x={186} y={46} scale={0.7} />
          </g>
          <Spacecraft x={258} y={24} scale={0.55} angle={-12} />
        </>
      )}
    </Scene>
  );
}

export function RendezvousScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <Starfield fill={fill} />
          <Planet fill={fill} planet="earth" cx={160} cy={360} r={290} />
          <g transform="translate(112 46)">
            <rect x="-22" y="-7" width="40" height="14" rx="3" fill="#eef0f5" />
            <rect x="-10" y="-7" width="4" height="14" fill="#e2703a" />
            <rect x="18" y="-4" width="5" height="8" fill="#a3aabd" />
          </g>
          <path
            d="M136 46 H184"
            stroke="#ffb547"
            strokeWidth="1.6"
            strokeDasharray="4 3"
          />
          <Spacecraft x={210} y={46} scale={0.9} />
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

export function TransferBurnScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <Starfield fill={fill} />
          <Planet fill={fill} planet="earth" cx={34} cy={82} r={22} />
          <Planet fill={fill} planet="mars" cx={292} cy={30} r={11} />
          <path
            d="M56 74 Q170 104 280 38"
            fill="none"
            stroke="#a3aabd"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
          <Plume
            fill={fill}
            x={142}
            y={60}
            length={34}
            spread={10}
            angle={115}
          />
          <Spacecraft x={148} y={58} scale={0.9} angle={-20} />
        </>
      )}
    </Scene>
  );
}

export function OrbitInsertionScene() {
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
          <Plume fill={fill} x={74} y={64} length={22} spread={8} angle={-80} />
          <Spacecraft x={70} y={66} scale={0.75} angle={10} />
        </>
      )}
    </Scene>
  );
}

export function EntryDescentLandingScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <rect width="320" height="110" fill={fill("marsSky")} />
          <path
            d="M0 96 Q80 88 160 94 T320 92 V110 H0 Z"
            fill={fill("marsGround")}
          />
          <path
            d="M0 84 Q60 76 120 82 T240 80 T320 84 V96 H0 Z"
            fill="#8a4428"
            opacity="0.6"
          />
          <path d="M136 22 Q160 4 184 22 Z" fill="#eef0f5" />
          <path
            d="M136 22 Q148 16 160 22 Q172 16 184 22"
            fill="none"
            stroke="#e2703a"
            strokeWidth="1.2"
          />
          <path
            d="M138 22 L157 50 M182 22 L163 50 M160 22 V48"
            stroke="#e8eaf0"
            strokeWidth="0.6"
          />
          <Capsule x={160} y={56} scale={1.1} />
          <path
            d="M150 66 l-6 10 M170 66 l6 10"
            stroke="#ffb547"
            strokeWidth="1"
            opacity="0.6"
          />
        </>
      )}
    </Scene>
  );
}

export function SpacecraftScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <Starfield fill={fill} />
          <Spacecraft x={160} y={55} scale={1.4} angle={-8} />
        </>
      )}
    </Scene>
  );
}

export function MissionReturnedScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <Starfield fill={fill} />
          <Planet fill={fill} planet="earth" cx={226} cy={64} r={46} />
          <path
            d="M40 30 Q120 20 170 52"
            fill="none"
            stroke="#a3aabd"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
          <Spacecraft x={150} y={42} scale={0.7} angle={18} />
        </>
      )}
    </Scene>
  );
}

export function SolarParticleEventScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <Starfield fill={fill} />
          <circle cx="30" cy="55" r="70" fill={fill("sun")} />
          <circle cx="12" cy="55" r="30" fill="#fff4c2" />
          <path
            d="M44 30 Q70 18 60 40 M46 78 Q76 92 62 70"
            fill="none"
            stroke="#ffd77a"
            strokeWidth="2"
          />
          {[18, 32, 46, 60, 74, 88].map((y, index) => (
            <line
              key={y}
              x1={90 + index * 9}
              y1={y}
              x2={150 + index * 9}
              y2={y + (55 - y) * 0.3}
              stroke="#ffb547"
              strokeWidth="1"
              opacity="0.7"
              strokeDasharray="6 5"
            />
          ))}
          <Spacecraft x={244} y={55} scale={0.9} />
          <path
            d="M226 36 a28 28 0 0 0 0 38"
            fill="none"
            stroke="#8cc8ff"
            strokeWidth="1.4"
            opacity="0.7"
          />
        </>
      )}
    </Scene>
  );
}

export function SurveyScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <Starfield fill={fill} />
          <Planet fill={fill} planet="mars" cx={160} cy={210} r={150} />
          <path
            d="M160 40 L120 74 Q160 80 200 74 Z"
            fill="#8cc8ff"
            opacity="0.18"
          />
          <path
            d="M120 74 Q160 80 200 74"
            fill="none"
            stroke="#8cc8ff"
            strokeWidth="1"
          />
          <path
            d="M70 86 Q160 70 250 86"
            fill="none"
            stroke="#8cc8ff"
            strokeWidth="0.6"
            strokeDasharray="2 3"
          />
          <Spacecraft x={160} y={36} scale={0.7} />
        </>
      )}
    </Scene>
  );
}

export function FlightProvenScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <Starfield fill={fill} />
          <Spacecraft x={130} y={56} scale={1.2} angle={-6} />
          <g transform="translate(222 54)">
            <circle r="22" fill="none" stroke="#7fd18b" strokeWidth="2" />
            <circle
              r="17"
              fill="none"
              stroke="#7fd18b"
              strokeWidth="0.8"
              strokeDasharray="2 2"
            />
            <path
              d="M-8 0 l5 6 l11 -12"
              fill="none"
              stroke="#7fd18b"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </>
      )}
    </Scene>
  );
}

export function AssetFailedScene() {
  return (
    <Scene>
      {(fill) => (
        <>
          <Starfield fill={fill} />
          <g transform="translate(150 54) rotate(28)">
            <rect
              x="-6"
              y="-7"
              width="12"
              height="14"
              rx="1.5"
              fill="#8a6f3a"
            />
            <rect x="-24" y="-4" width="14" height="9" fill="#24365e" />
          </g>
          <g transform="translate(196 34) rotate(-40)">
            <rect x="-7" y="-4" width="14" height="9" fill="#24365e" />
          </g>
          <path
            d="M120 70 l-6 4 M178 62 l6 2 M168 76 l3 6 M134 40 l-4 -5"
            stroke="#a3aabd"
            strokeWidth="1.2"
          />
          <circle cx="208" cy="70" r="1.5" fill="#a3aabd" />
          <circle cx="110" cy="50" r="1.2" fill="#a3aabd" />
        </>
      )}
    </Scene>
  );
}
