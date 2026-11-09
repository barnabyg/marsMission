import { useId, type ButtonHTMLAttributes } from "react";

interface UnavailableButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "disabled" | "type"
> {
  /** Why it can't be used now, or undefined while it can. */
  unavailable: string | undefined;
}

/**
 * A button that says why it can't be used. While it can't, it's marked `aria-disabled` rather than disabled, so that the
 * keyboard still reaches it, does nothing when pressed, and is described by the reason, which a screen reader reads
 * from a visually hidden line beside it and the pointer finds on hovering, as its `title`. Styled as disabled by
 * `[aria-disabled="true"]` in styles.css.
 */
export function UnavailableButton({
  unavailable,
  title,
  onClick,
  children,
  ...button
}: UnavailableButtonProps) {
  const reasonId = useId();
  return (
    <>
      <button
        type="button"
        {...button}
        aria-disabled={unavailable === undefined ? undefined : true}
        aria-describedby={unavailable === undefined ? undefined : reasonId}
        title={unavailable ?? title}
        onClick={unavailable === undefined ? onClick : undefined}
      >
        {children}
      </button>
      {unavailable !== undefined && (
        <span
          id={reasonId}
          className="visually-hidden"
          data-testid="unavailable-reason"
        >
          {unavailable}
        </span>
      )}
    </>
  );
}
