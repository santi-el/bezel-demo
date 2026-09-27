import { Offer } from './Offer';

export type OfferPerspective = {
  viewerTitle: string;
  viewerWinText: string;
  viewerLoseText: string;
  viewerNullText?: string;
  isOwner: boolean;
};

/**
 * Get the correct perspective for viewing an offer based on whether the viewer is the creator
 * 
 * @param offer - The offer to get perspective for
 * @param viewerUserId - The user ID of the person viewing the offer
 * @returns Perspective object with correct titles and texts for the viewer
 * 
 * Logic:
 * - Owner view: sees their win situation (trueSituationText) as the title and win condition
 * - Public view: sees creator's lose situation (falseSituationText) as the title and win condition
 */
export function getOfferPerspective(offer: Offer, viewerUserId: string | null | undefined): OfferPerspective {
  const isOwner = viewerUserId === offer.creatorUserId;
  
  const winSituation = offer.trueSituationText; // Creator wins
  const loseSituation = offer.falseSituationText; // Creator loses
  
  if (isOwner) {
    // Owner sees their own perspective
    return {
      viewerTitle: winSituation,
      viewerWinText: winSituation,
      viewerLoseText: loseSituation,
      viewerNullText: offer.nullSituationText,
      isOwner: true,
    };
  } else {
    // Public sees opposite perspective (they win when creator loses)
    return {
      viewerTitle: loseSituation,
      viewerWinText: loseSituation,
      viewerLoseText: winSituation,
      viewerNullText: offer.nullSituationText,
      isOwner: false,
    };
  }
}


