import { expect, test } from "@playwright/test";
import {
  createBrowserGame,
  hideTutorialOffer,
} from "../src/blindPlay/browserGame";
import type { GameScreen } from "../src/blindPlay/game";
import { missionViewport } from "./helpers";

// The blind player's view of the real game (src/blindPlay): the screen as text, the controls as actions, and what an
// action changes. The play loop's own tests are in src/blindPlay and call no browser.
test.use({ viewport: missionViewport });

function action(screen: GameScreen, label: string) {
  const found = screen.actions.find((offered) => offered.label === label);
  if (!found) throw new Error(`${label} is not offered`);
  return found;
}

test("blind play reads the screen as a player sees it and acts on it", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  await hideTutorialOffer(page);
  const game = createBrowserGame(page, { waitMs: 2_000 });

  const planning = await game.read();
  expect(planning).toMatchObject({
    name: "Planning Mode",
    turn: 1,
    ended: null,
  });
  expect(planning.text).toContain('heading "New Mission"');
  const labels = planning.actions.map((offered) => offered.label);
  expect(labels).toContain('Tick "Pathfinder Orbiter"');
  expect(labels).toContain('Set "Trajectory" to "Fast ($40M)"');
  expect(labels).toContain('Hover over "Public Support" to read its tooltip');
  // Tutorial mode's offer is off the page, and nothing that can't be used is offered.
  expect(planning.text).not.toContain("Tutorial mode");
  expect(labels).not.toContain('Press "Turn on Tutorial mode"');
  expect(labels).not.toContain('Press "Launch Mission"');
  expect(labels).not.toContain("Wait and watch what happens");

  expect(
    await game.act(
      action(planning, 'Hover over "Public Support" to read its tooltip'),
    ),
  ).toMatch(/^The tooltip says: Public Support: Points of public/);

  const ticked = await game.act(action(planning, 'Tick "Pathfinder Orbiter"'));
  expect(ticked).toContain('checkbox "Pathfinder Orbiter" [checked]');
  const plan = await game.read();
  // An Activity's select is a game term as well as a control, and works as both.
  expect(
    await game.act(
      action(
        plan,
        'Set "Activity for Pathfinder Orbiter" to "Orbital research"',
      ),
    ),
  ).toContain('option "Orbital research" [selected]');
  expect(plan.actions.map((offered) => offered.label)).toContain(
    'Untick "Pathfinder Orbiter"',
  );

  await game.act(action(plan, 'Press "Glossary"'));
  const glossary = await game.read();
  expect(glossary.name).toBe("Glossary");
  // Only the dialog, which is all a player can use while it is open.
  expect(glossary.actions.map((offered) => offered.label)).not.toContain(
    'Untick "Pathfinder Orbiter"',
  );
  await page.keyboard.press("Escape");

  const launched = await game.act(
    action(await game.read(), 'Press "Launch Mission"'),
  );
  expect(launched).toContain('The screen is now "Mission Mode".');
  const mission = await game.read();
  expect(mission.turn).toBeNull();
  expect(mission.actions.map((offered) => offered.label)).toContain(
    "Wait and watch what happens",
  );
});
