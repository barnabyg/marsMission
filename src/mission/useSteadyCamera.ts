import { useState, useSyncExternalStore } from "react";

const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
const key = "marsMission.steadyCamera";

function listen(change: () => void) {
  motion.addEventListener("change", change);
  return () => {
    motion.removeEventListener("change", change);
  };
}

/** Follow system motion settings until the player picks a camera preference. */
export function useSteadyCamera(): readonly [boolean, () => void] {
  const reduced = useSyncExternalStore(listen, () => motion.matches);
  const [choice, setChoice] = useState<boolean | null>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved === null ? null : saved === "true";
    } catch {
      return null;
    }
  });
  const steady = choice ?? reduced;
  return [
    steady,
    () => {
      setChoice(!steady);
      try {
        localStorage.setItem(key, String(!steady));
      } catch {
        // The current camera selection also works when browser storage is unavailable.
      }
    },
  ];
}
