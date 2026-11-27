/**
 * What the blind player plays: the game as a screen of text and a list of things it can do. The browser adapter
 * (browserGame.ts) reads these from the real game; the tests use a game of their own.
 */

/** One thing the player can do on the screen as it stands. */
export interface GameAction {
  /** What the player is told, such as `Tick "Pathfinder Orbiter"`. Unique on the screen it is offered on. */
  label: string;
  kind: "click" | "tick" | "untick" | "choose" | "hover" | "wait";
}

export interface GameScreen {
  /** The screen's heading, such as "Planning Mode", or a dialog's name while one is open. */
  name: string;
  /** The Turn the status bar shows, or null on a screen that doesn't show one. */
  turn: number | null;
  /** The screen as a screen reader reads it, as indented lines. */
  text: string;
  actions: readonly GameAction[];
  /** Set once the Program has ended, with how, such as "The Program has been cancelled." */
  ended: string | null;
}

export interface Game {
  read(): Promise<GameScreen>;
  /** Does one of the actions the last read offered, and says what changed on screen. */
  act(action: GameAction): Promise<string>;
}
