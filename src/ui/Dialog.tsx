import { useEffect, useId, useRef, type ReactNode } from "react";
import { GameText } from "./GameText";

interface DialogProps {
  title: string;
  /** The button that closes the dialog without changing anything. Escape does the same. */
  cancelLabel: string;
  onClose: () => void;
  /** Any buttons to show before the cancel button. */
  actions?: ReactNode;
  children?: ReactNode;
}

/** A modal dialog, open for as long as it's rendered. */
export function Dialog({
  title,
  cancelLabel,
  onClose,
  actions,
  children,
}: DialogProps) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Checked because React's development double-run of effects would otherwise open it twice, which throws.
    if (dialog.current?.open === false) dialog.current.showModal();
    // Otherwise the browser focuses the first game term, which would open its tooltip.
    cancel.current?.focus();
  }, []);

  return (
    <dialog ref={dialog} aria-labelledby={titleId} onClose={onClose}>
      <h2 id={titleId}>
        <GameText>{title}</GameText>
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
