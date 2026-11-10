/**
 * Why a control can't be used, for a screen reader: a visually hidden line that the control's `aria-describedby` points
 * at. The control shows the same words on hovering, as its `title`, so that nothing takes up room. `UnavailableButton`
 * renders its reason with it; a tick box or other control that can't be a button uses it directly, such as a greyed-out
 * Asset or Crew in Planning Mode.
 */
export function UnavailableReason({
  id,
  reason,
}: {
  /** What the control's `aria-describedby` points at. */
  id: string;
  reason: string | undefined;
}) {
  if (!reason) return null;
  return (
    <span id={id} className="visually-hidden" data-testid="unavailable-reason">
      {reason}
    </span>
  );
}
