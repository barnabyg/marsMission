/**
 * Why a greyed-out Asset or Crew can't be ticked, for a screen reader. The card shows the same words on hovering, as
 * its `title`, so that nothing takes up room on it.
 */
export function UnavailableReason({
  id,
  reason,
}: {
  /** What the tick box's `aria-describedby` points at. */
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
