export type OfferStatus = 'OPEN' | 'MATCHED' | 'MATCHED_PENDING_ACCEPT' | 'SETTLED' | 'DISPUTED' | 'CANCELLED';
export type OfferOutcome = 'TRUE' | 'FALSE' | 'NULL';

export interface Offer {
  offerId: string;
  creatorUserId: string;
  propositionText: string;
  trueSituationText: string;
  falseSituationText: string;
  nullSituationText?: string; // Optional if tie disabled
  postTitle: string; // AI-generated from situation text
  stakeCreator: number; // Amount creator risks (Stake A)
  stakeB?: number; // Payout amount (to win amount)
  oddsRatio?: string; // e.g., "1:1", "1:2", "2:1", etc.
  stakeMatcherMax: number; // Maximum amount others can match
  remainingStakeMatcher: number; // Remaining amount available to match
  status: OfferStatus;
  parentOfferId?: string | null; // For raised offers
  distanceMeters: number;
  createdAt: string;
  expiryDate?: string; // ISO string for when offer expires
  matchedAt?: string; // ISO string for when offer was matched
  acceptRejectDeadline?: string; // ISO string for when creator must accept/reject (20 seconds after match)
  matcherUserId?: string; // User who matched the offer
  // Settlement
  creatorOutcome?: OfferOutcome;
  matcherOutcome?: OfferOutcome;
  settledOutcome?: OfferOutcome;
  // Computed fields
  goodFaithDeposit: number;
  commission: number;
  totalHold: number;
  // Legacy compatibility
  id?: string;
  title?: string;
  stakeAmount?: number;
  amount?: number;
  odds?: number;
  distance?: number;
  userId?: string;
  description?: string;
}

