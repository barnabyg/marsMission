// The craft, vehicles and people the event pictures show, drawn here like the rest of the scenery.

/** A capsule with its heat shield down, centred on (`x`, `y`). */
export function Capsule({
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
      <path d="M-5 -6 L5 -6 L9 4 L-9 4 Z" fill="#d6dae3" />
      <rect x="-3" y="-3" width="6" height="3" fill="#2d3448" />
      <path d="M-10 4 Q0 9 10 4 Z" fill="#7a3a22" />
    </g>
  );
}

/** A Mars lander on its legs, with its feet at `y`. */
export function Lander({
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
      <path
        d="M-10 -8 L-15 0 M10 -8 L15 0 M-4 -8 L-6 0 M4 -8 L6 0"
        stroke="#a3aabd"
        strokeWidth="1.4"
      />
      <path d="M-17 0 h5 M12 0 h5" stroke="#a3aabd" strokeWidth="1.6" />
      <path d="M-12 -8 L12 -8 L9 -16 L-9 -16 Z" fill="#d9a441" />
      <rect
        x="-24"
        y="-15"
        width="11"
        height="6"
        fill="#2f4f8a"
        stroke="#8cc8ff"
        strokeWidth="0.5"
      />
      <rect
        x="13"
        y="-15"
        width="11"
        height="6"
        fill="#2f4f8a"
        stroke="#8cc8ff"
        strokeWidth="0.5"
      />
      <line x1="4" y1="-16" x2="4" y2="-25" stroke="#e8eaf0" strokeWidth="1" />
      <rect x="1.5" y="-28" width="5" height="3" fill="#e8eaf0" />
      <path
        d="M-7 -16 Q-4 -22 -1 -16"
        fill="none"
        stroke="#e8eaf0"
        strokeWidth="1"
      />
    </g>
  );
}

/** A six-wheeled rover, with its wheels on `y`. */
export function Rover({
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
      <path
        d="M-14 -6 L-6 -10 L2 -6 M2 -6 L10 -10 L14 -6"
        fill="none"
        stroke="#59607a"
        strokeWidth="1.4"
      />
      <rect x="-13" y="-17" width="26" height="8" rx="1" fill="#e8eaf0" />
      <rect x="-13" y="-19" width="26" height="2" fill="#2f4f8a" />
      <line
        x1="8"
        y1="-19"
        x2="8"
        y2="-30"
        stroke="#a3aabd"
        strokeWidth="1.2"
      />
      <rect x="5" y="-33" width="7" height="4" rx="0.8" fill="#d6dae3" />
      <circle cx="-14" cy="-3" r="3" fill="#2d3448" />
      <circle cx="0" cy="-3" r="3" fill="#2d3448" />
      <circle cx="14" cy="-3" r="3" fill="#2d3448" />
    </g>
  );
}

/** An astronaut in a suit, standing with their feet at `y`. */
export function Astronaut({
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
      <rect x="-3.5" y="-9" width="3" height="9" rx="1.2" fill="#d6dae3" />
      <rect x="0.5" y="-9" width="3" height="9" rx="1.2" fill="#d6dae3" />
      <rect x="-5" y="-20" width="10" height="12" rx="3" fill="#eef0f5" />
      <rect x="-7" y="-19" width="3" height="8" rx="1.5" fill="#d6dae3" />
      <rect x="4" y="-19" width="3" height="8" rx="1.5" fill="#d6dae3" />
      <circle cx="0" cy="-24" r="5" fill="#eef0f5" />
      <path d="M-3.5 -25 h7 v2.5 a3.5 3 0 0 1 -7 0 Z" fill="#d9a441" />
    </g>
  );
}
