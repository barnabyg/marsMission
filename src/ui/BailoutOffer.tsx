import { formatMoney } from "../simulation/simulation";
import { GameText } from "./GameText";

export interface BailoutTerms {
  millions: number;
  repaymentMillions: number;
  repaymentTurns: number;
}

/**
 * The Bailout on offer for a lost Mission: what it refunds now, how it is repaid, and the button that takes it. The
 * Turn summary and Planning Mode both show it, until the next Turn is played.
 */
export function BailoutOffer({
  offer,
  onTake,
}: {
  offer: BailoutTerms;
  onTake: () => void;
}) {
  return (
    <>
      <p>
        <GameText>
          {`The Bailout refunds ${formatMoney(offer.millions)} for what was lost. It is repaid at ${formatMoney(offer.repaymentMillions)} as each of the next ${String(offer.repaymentTurns)} Turns ends, even if that takes Money below zero. It can be taken only once in a Program.`}
        </GameText>
      </p>
      <button type="button" className="small" onClick={onTake}>
        {`Take the Bailout: +${formatMoney(offer.millions)}`}
      </button>
    </>
  );
}

/** The Bailout once taken, in place of the offer. */
export function BailoutTaken({ offer }: { offer: BailoutTerms }) {
  return (
    <p role="status">
      <GameText>
        {`Bailout taken: ${formatMoney(offer.millions)} added to Money, repaid at ${formatMoney(offer.repaymentMillions)} as each of the next ${String(offer.repaymentTurns)} Turns ends.`}
      </GameText>
    </p>
  );
}
