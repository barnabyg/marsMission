import type { TutorialStatus } from "../tutorial/tutorial";
import { Dialog } from "../ui/Dialog";
import { GameText } from "../ui/GameText";

/** How the tutorial ended: at its goal, or once it couldn't recover. */
export type TutorialEnd = Exclude<TutorialStatus, { kind: "inProgress" }>;

interface TutorialEndingProps {
  ending: TutorialEnd;
  onClose: () => void;
}

/** How the tutorial ended, shown once, on the Planning session where it did. The Program carries on. */
export function TutorialEnding({ ending, onClose }: TutorialEndingProps) {
  return ending.kind === "goalReached" ? (
    <Dialog
      title="Tutorial complete"
      cancelLabel="Keep playing"
      onClose={onClose}
    >
      <div data-testid="tutorial-ending">
        <p>
          <GameText>
            Crew have landed at a Base, with a fuel plant, a habitat and a Mars
            lab working beside them. That was the tutorial's goal, so Tutorial
            mode ends here and the Program carries on without advice.
          </GameText>
        </p>
        <p>
          <GameText>On the way you learnt:</GameText>
        </p>
        <ul>
          {ending.learnt.map((lesson) => (
            <li key={lesson}>
              <GameText>{lesson}</GameText>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  ) : (
    <Dialog title="Tutorial ended" cancelLabel="Keep playing" onClose={onClose}>
      <div data-testid="tutorial-ending">
        <p>
          <GameText>{ending.reason}</GameText>
        </p>
        <p>
          <GameText>
            A Base is now out of reach, so Tutorial mode ends here. The Program
            carries on, and you can keep playing without advice.
          </GameText>
        </p>
      </div>
    </Dialog>
  );
}
