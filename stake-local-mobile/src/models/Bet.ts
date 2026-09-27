export type BetStatus = 'active' | 'matched' | 'completed' | 'cancelled';

export interface Bet {
  id: string;
  title: string;
  stakeAmount: number; // The bet amount
  goodFaithDeposit: number; // Good-faith deposit required
  totalHold: number; // Total amount held (stakeAmount + commission + goodFaithDeposit)
  commission: number; // Commission fee
  odds: number;
  distance: number; // in meters
  userId: string;
  status: BetStatus;
  description?: string;
  createdAt: string;
  // Legacy field for backward compatibility (will be removed)
  amount?: number;
}

