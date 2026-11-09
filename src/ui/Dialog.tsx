import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { GameText } from "./GameText";

interface DialogProps {
  title: string;
  /** The button that closes the dialog without changing anything. Escape does the same. */
  cancelLabel: string;
  onClose: () => void;
  /** Any buttons to show before the cancel button. */
  actions?: ReactNode;
  /** A class for the dialog itself, such as the tutorial's own style. */
  className?: string;
  children?: ReactNode;
}

/**
 * A modal dialog, open for as long as it's rendered. Once it closes, focus goes back to whatever had it before it
 * opened, such as the button that opened it, so that a keyboard player carries on from there.
 */
export function Dialog({
  title,
  cancelLabel,
  onClose,
  actions,
  className,
  children,
}: DialogProps) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  // Taken as it first renders, before it moves focus to its cancel button.
  const [opener] = useState(() => document.activeElement);

  // As it closes rather than after, so that it can't take focus back from wherever the player has moved it since.
  useLayoutEffect(
    () => () => {
      // Not when what opened it has gone, as when a Load or a restart brings a new screen.
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    },
    [opener],
  );

  useEffect(() => {
    // Checked because React's development double-run of effects would otherwise open it twice, which throws.
    if (dialog.current?.open === false) dialog.current.showModal();
    // Otherwise the browser focuses the first game term, which would open its tooltip.
    cancel.current?.focus();
  }, []);

  return (
    <dialog
      ref={dialog}
      className={className}
      aria-labelledby={titleId}
      onClose={onClose}
    >
      <h2 id={titleId}>
        <GameText heading>{title}</GameText>
      </h2>
      {children}
      <div className="dialog-actions">
        {actions}
        <button ref={cancel} type="button" onClick={onClose}>
          {cancelLabel}
        </button>
      </div>
    </dialog>
  );
}
