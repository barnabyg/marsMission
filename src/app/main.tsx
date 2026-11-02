import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { fetchCatalogue } from "./fetchCatalogue";
import { knownSeed } from "./knownSeed";
import { openingScreen, type GameServices } from "./screens";
import { createSaveStore } from "../save/saveStore";
import { createSimulation } from "../simulation/simulation";
import { TooltipLayer } from "../ui/TooltipLayer";
// In cascade order: where two rules are equally specific, the one in a later file wins.
import "./styles.css";
import "../planning/planning.css";
import "../ui/dialog.css";
import "../save/saveSlots.css";
import "../mission/mission.css";
import "./summaryScreens.css";
import "../ui/tooltips.css";

const container = document.getElementById("root");
if (!container) throw new Error("The page has no #root element");
const root = createRoot(container);

try {
  const simulation = createSimulation(await fetchCatalogue());
  const services: GameServices = {
    simulation,
    saveStore: createSaveStore(
      {
        // Reached through calls, because just reading localStorage throws where the browser blocks it.
        getItem: (key) => localStorage.getItem(key),
        setItem: (key, value) => {
          localStorage.setItem(key, value);
        },
        removeItem: (key) => {
          localStorage.removeItem(key);
        },
      },
      simulation,
    ),
    newSeed: () => knownSeed(window.location.search) ?? Date.now(),
  };
  root.render(
    <StrictMode>
      <App services={services} firstScreen={openingScreen(services)} />
      <TooltipLayer />
    </StrictMode>,
  );
} catch (error) {
  root.render(
    <main className="load-error" role="alert">
      <h1>The game's data files are invalid</h1>
      <pre>{error instanceof Error ? error.message : String(error)}</pre>
    </main>,
  );
}
