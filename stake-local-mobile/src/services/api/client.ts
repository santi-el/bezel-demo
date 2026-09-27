import { Offer, OfferStatus, OfferOutcome } from '../../models/Offer';
import { Bet } from '../../models/Bet';
import { User } from '../../models/User';
import { Transaction } from '../../models/Transaction';
import { authService } from '../auth/authService';

// Mock data
const mockUsers: User[] = [
  { id: '1', username: 'betmaster99', score: 1250 },
  { id: 'dev_user_1', username: 'betmaster99', score: 1250 }, // Current user
  { id: 'dev_user_2', username: 'BoxDaddy', score: 980 }, // Fake second user for testing
  { id: 'dev_user_3', username: 'TestUser', score: 750 }, // Admin test user
  { id: '2', username: 'luckybettor', score: 890 },
  { id: '3', username: 'wagerking', score: 2100 },
  { id: '4', username: 'betpro', score: 1560 },
  { id: '5', username: 'sportsfan22', score: 1100 },
  { id: '6', username: 'highroller', score: 3200 },
];

// Wallet state
let availableBalance = 1250.50;
let onHoldBalance = 350.00;

// Helper functions for Offer calculations
export const calculateGFD = (stake: number): number => {
  return Math.max(2, 0.2 * stake);
};

export const calculateCommission = (stake: number): number => {
  if (stake < 10) {
    return 0.279;
  }
  return Math.round(0.0279 * stake * 100) / 100; // Round to cents
};

export const calculateTotalHold = (stake: number): number => {
  const gfd = calculateGFD(stake);
  return stake + gfd; // Commission NOT included in totalHold
};

// AI verification (mocked)
export const verifyPostTitle = async (text: string): Promise<string> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  // Mock: return the text as-is (in production, would call AI service)
  return text;
};

// Generate postTitle from situation text (mocked AI)
export const generatePostTitle = async (situationText: string, isRaised: boolean = false): Promise<string> => {
  await new Promise(resolve => setTimeout(resolve, 400));
  // Mock: create a short headline from the situation text
  // In production, this would use AI to generate a clear, short headline
  const words = situationText.split(' ');
  const shortTitle = words.slice(0, 8).join(' '); // Take first 8 words
  return await verifyPostTitle(shortTitle);
};

// Mock Offers
const createOffer = (
  offerId: string,
  creatorUserId: string,
  propositionText: string,
  trueSituationText: string,
  falseSituationText: string,
  nullSituationText: string | undefined,
  postTitle: string,
  stakeCreator: number,
  stakeMatcherMax: number,
  distanceMeters: number,
  status: OfferStatus = 'OPEN',
  parentOfferId: string | null = null,
  oddsRatio: string = '1:1',
  stakeB?: number
): Offer => {
  const gfd = calculateGFD(stakeCreator);
  const commission = calculateCommission(stakeCreator);
  const totalHold = calculateTotalHold(stakeCreator);
  const calculatedStakeB = stakeB || stakeCreator; // Default to 1:1

  return {
    offerId,
    creatorUserId,
    propositionText,
    trueSituationText,
    falseSituationText,
    nullSituationText,
    postTitle,
    stakeCreator,
    stakeB: calculatedStakeB,
    oddsRatio,
    stakeMatcherMax,
    remainingStakeMatcher: stakeMatcherMax,
    status,
    parentOfferId,
    distanceMeters,
    createdAt: new Date().toISOString(),
    goodFaithDeposit: gfd,
    commission,
    totalHold,
    // Legacy compatibility
    id: offerId,
    title: postTitle,
    stakeAmount: stakeCreator,
    amount: stakeCreator,
    odds: 1, // 1:1 odds
    distance: distanceMeters,
    userId: creatorUserId,
  };
};

let mockOffers: Offer[] = [
  // =====================================================
  // SAMPLE OFFERS FOR TESTING - 5 diverse offers
  // =====================================================
  
  // Offer 1: dev_user_2, $10 stake, 1:1 odds, 50m, OPEN
  createOffer(
    'offer_sample_1',
    'dev_user_2',
    'Lakers win tonight',
    'Lakers win tonight',
    'Lakers lose tonight',
    'Game is cancelled',
    'Lakers lose tonight',
    10,
    10,
    50,
    'OPEN',
    null,
    '1:1',
    10
  ),
  
  // Offer 2: dev_user_3 (TestUser), $25 stake, 1:2 odds, 150m, OPEN
  createOffer(
    'offer_sample_2',
    'dev_user_3',
    'Bitcoin hits $100k this week',
    'Bitcoin hits $100k this week',
    'Bitcoin stays below $100k',
    undefined,
    'Bitcoin stays below $100k',
    25,
    50, // 1:2 odds - matcher stakes $50 to win $25
    150,
    'OPEN',
    null,
    '1:2',
    50
  ),
  
  // Offer 3: User 5 (sportsfan22), $50 stake, 2:1 odds, 300m, OPEN
  createOffer(
    'offer_sample_3',
    '5',
    'Chiefs win Super Bowl',
    'Chiefs win Super Bowl',
    'Chiefs do not win Super Bowl',
    'Super Bowl cancelled',
    'Chiefs do not win Super Bowl',
    50,
    25, // 2:1 odds - matcher stakes $25 to win $50
    300,
    'OPEN',
    null,
    '2:1',
    25
  ),
  
  // Offer 4: dev_user_2, $100 stake, 1.5:1 odds, 500m, OPEN
  createOffer(
    'offer_sample_4',
    'dev_user_2',
    'Argentina wins Copa America',
    'Argentina wins Copa America',
    'Argentina does not win Copa America',
    'Tournament cancelled',
    'Argentina does not win Copa America',
    100,
    67, // 1.5:1 odds
    500,
    'OPEN',
    null,
    '1.5:1',
    67
  ),
  
  // Offer 5: User 6 (highroller), $200 stake, 3:1 odds, 1000m, MATCHED (for testing)
  (() => {
    const offer = createOffer(
      'offer_sample_5',
      '6',
      'Djokovic wins Wimbledon',
      'Djokovic wins Wimbledon',
      'Djokovic does not win Wimbledon',
      undefined,
      'Djokovic does not win Wimbledon',
      200,
      67, // 3:1 odds
      1000,
      'MATCHED',
      null,
      '3:1',
      67
    );
    offer.matcherUserId = 'dev_user_1';
    offer.matchedAt = new Date().toISOString();
    return offer;
  })(),

  // =====================================================
  // EXISTING OFFERS (legacy)
  // =====================================================
  
  // Offers by dev_user_2 (BoxDaddy) - for testing matching
  createOffer(
    'offer_1',
    'dev_user_2',
    'Red fighter wins the match',
    'Red fighter wins the match',
    'Blue fighter wins the match',
    'The match ends in a draw',
    'Blue fighter wins the match',
    25,
    25,
    60,
    'OPEN'
  ),
  createOffer(
    'offer_2',
    'dev_user_2',
    'Tigers score more than 5 goals',
    'Tigers score more than 5 goals',
    'Tigers score 5 or fewer goals',
    undefined, // Tie disabled
    'Tigers score 5 or fewer goals',
    75,
    75,
    180,
    'OPEN'
  ),
  createOffer(
    'offer_3',
    'dev_user_2',
    'Team A wins by 10+ points',
    'Team A wins by 10+ points',
    'Team A wins by less than 10 or loses',
    'The game ends exactly tied',
    'Team A wins by less than 10 or loses',
    150,
    150,
    350,
    'OPEN'
  ),
  // Offers by dev_user_1 (current user) - for testing owner view
  createOffer(
    'offer_4',
    'dev_user_1',
    'Celtics win NBA Championship',
    'Celtics win NBA Championship',
    'Celtics do not win NBA Championship',
    'Season is cancelled',
    'Celtics do not win NBA Championship',
    200,
    200,
    450,
    'OPEN'
  ),
  createOffer(
    'offer_5',
    'dev_user_1',
    'Dodgers win World Series',
    'Dodgers win World Series',
    'Dodgers do not win World Series',
    undefined, // Tie disabled
    'Dodgers do not win World Series',
    100,
    100,
    240,
    'OPEN'
  ),
];

// Legacy Bet support (for backward compatibility)
const createBet = (
  id: string,
  title: string,
  stakeAmount: number,
  odds: number,
  distance: number,
  userId: string,
  status: Bet['status'],
  description?: string
): Bet => {
  const commission = stakeAmount * 0.05;
  const goodFaithDeposit = stakeAmount;
  const totalHold = stakeAmount + commission + goodFaithDeposit;

  return {
    id,
    title,
    stakeAmount,
    goodFaithDeposit,
    totalHold,
    commission,
    odds,
    distance,
    userId,
    status,
    description,
    createdAt: new Date().toISOString(),
    amount: stakeAmount,
  };
};

const mockBets: Bet[] = [
  createBet('1', 'Warriors vs Lakers - Warriors win', 50, 1.5, 250, '1', 'active', 'Betting on Warriors to win by at least 5 points'),
];

const mockTransactions: Transaction[] = [
  {
    id: '1',
    amount: 1250.50,
    type: 'deposit',
    status: 'completed',
    createdAt: new Date().toISOString(),
    description: 'Initial deposit',
    balanceBefore: 0,
    balanceAfter: 1250.50,
  },
];

// Notification types
export type NotificationType = 
  | 'offer_matched'
  | 'offer_accepted'
  | 'offer_posted'
  | 'offer_raised'
  | 'result_confirmed'
  | 'opponent_result'
  | 'match_rejected';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  offerId?: string;
  createdAt: string;
  read: boolean;
  color: 'green' | 'yellow' | 'red' | 'default';
}

// Mock notifications array
let mockNotifications: AppNotification[] = [];

// Notification counter for unique IDs
let notificationCounter = 0;

// Transaction counter for unique IDs
let transactionCounter = 0;

class ApiClient {
  private logTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>): void {
    transactionCounter++;
    mockTransactions.push({
      ...transaction,
      id: `tx_${Date.now()}_${transactionCounter}`,
      createdAt: new Date().toISOString(),
    });
  }

  private getUserGfdBalance(_userId: string): number {
    return mockTransactions.reduce((sum, tx) => sum + (tx.gfdDelta || 0), 0);
  }

  // Offer methods
  async getOffers(): Promise<Offer[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return [...mockOffers];
  }

  async getOfferById(offerId: string): Promise<Offer | null> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return mockOffers.find(offer => offer.offerId === offerId) || null;
  }

  async createOffer(offer: Omit<Offer, 'offerId' | 'createdAt' | 'goodFaithDeposit' | 'commission' | 'totalHold'>): Promise<Offer> {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const stake = offer.stakeCreator;
    const gfd = calculateGFD(stake);
    const commission = calculateCommission(stake);
    const totalHold = calculateTotalHold(stake);
    const chargedNow = totalHold + commission;

    // Check if user has sufficient balance (must cover hold + commission)
    if (availableBalance < chargedNow) {
      throw new Error('INSUFFICIENT_BALANCE');
    }

    const balanceBefore = availableBalance;
    const holdBefore = onHoldBalance;
    const userId = offer.creatorUserId;
    const gfdBefore = this.getUserGfdBalance(userId);

    // Charge commission immediately (not held)
    availableBalance -= chargedNow;
    // Only hold amount goes to onHoldBalance
    onHoldBalance += totalHold;

    const balanceAfter = availableBalance;
    const holdAfter = onHoldBalance;
    const gfdAfter = gfdBefore + gfd;

    // Record hold transaction
    this.logTransaction({
      amount: -totalHold,
      type: 'hold',
      status: 'completed',
      description: `Hold for creating offer`,
      balanceBefore,
      balanceAfter,
      holdBalanceBefore: holdBefore,
      holdBalanceAfter: holdAfter,
      holdDelta: totalHold,
      gfdBalanceBefore: gfdBefore,
      gfdBalanceAfter: gfdAfter,
      gfdDelta: gfd,
    });

    // Record commission as a fee transaction
    this.logTransaction({
      amount: -commission,
      type: 'fee',
      status: 'completed',
      description: `Commission for creating offer`,
      balanceBefore: balanceAfter + commission,
      balanceAfter,
      holdBalanceBefore: holdAfter,
      holdBalanceAfter: holdAfter,
    });

    // Record offer creation event
    this.logTransaction({
      amount: 0,
      type: 'offer',
      status: 'completed',
      description: `Offer created`,
      balanceBefore,
      balanceAfter,
      holdBalanceBefore: holdBefore,
      holdBalanceAfter: holdAfter,
    });

    const newOffer: Offer = {
      ...offer,
      offerId: `offer_${Date.now()}`,
      createdAt: new Date().toISOString(),
      goodFaithDeposit: gfd,
      commission,
      totalHold,
      remainingStakeMatcher: offer.stakeMatcherMax,
      status: 'OPEN',
      // Legacy compatibility
      id: `offer_${Date.now()}`,
      title: offer.postTitle,
      stakeAmount: stake,
      amount: stake,
      odds: 1,
      distance: offer.distanceMeters,
      userId: offer.creatorUserId,
    };

    mockOffers.push(newOffer);

    // Create notification for offer creation
    this.createNotification({
      type: 'offer_posted',
      title: 'Offer Posted',
      message: `Your offer "${newOffer.postTitle}" is now live`,
      offerId: newOffer.offerId,
      color: 'yellow',
    });

    return newOffer;
  }

  async matchOffer(offerId: string, matchAmount: number): Promise<{ matched: boolean; newOffer?: Offer }> {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const offer = mockOffers.find(o => o.offerId === offerId);
    if (!offer || offer.status !== 'OPEN') {
      throw new Error('Offer not available');
    }

    if (matchAmount > offer.remainingStakeMatcher) {
      throw new Error('Match amount exceeds remaining stake');
    }

    const gfd = calculateGFD(matchAmount);
    const commission = calculateCommission(matchAmount);
    const totalHold = calculateTotalHold(matchAmount);
    const totalDebitNow = totalHold + commission;

    if (availableBalance < totalDebitNow) {
      throw new Error('INSUFFICIENT_BALANCE');
    }

    const balanceBefore = availableBalance;
    const holdBefore = onHoldBalance;
    const userId = await this.getCurrentUserId();
    const gfdBefore = userId ? this.getUserGfdBalance(userId) : 0;

    // Debit totalDebitNow (includes commission charged immediately)
    availableBalance -= totalDebitNow;
    // Only hold totalHold (stake + GFD), commission is NOT held
    onHoldBalance += totalHold;

    const balanceAfter = availableBalance;
    const holdAfter = onHoldBalance;
    const gfdAfter = gfdBefore + gfd;

    // Record hold transaction
    this.logTransaction({
      amount: -totalHold,
      type: 'hold',
      status: 'completed',
      description: `Hold for matching offer ${offerId}`,
      balanceBefore,
      balanceAfter,
      holdBalanceBefore: holdBefore,
      holdBalanceAfter: holdAfter,
      holdDelta: totalHold,
      gfdBalanceBefore: gfdBefore,
      gfdBalanceAfter: gfdAfter,
      gfdDelta: gfd,
    });

    // Record commission as a fee transaction
    this.logTransaction({
      amount: -commission,
      type: 'fee',
      status: 'completed',
      description: `Commission for matching offer ${offerId}`,
      balanceBefore: balanceAfter + commission,
      balanceAfter,
      holdBalanceBefore: holdAfter,
      holdBalanceAfter: holdAfter,
    });

    // Record offer match event
    this.logTransaction({
      amount: 0,
      type: 'offer',
      status: 'completed',
      description: `Offer matched ${offerId}`,
      balanceBefore,
      balanceAfter,
      holdBalanceBefore: holdBefore,
      holdBalanceAfter: holdAfter,
    });

    const remaining = offer.remainingStakeMatcher - matchAmount;

    if (remaining > 0) {
      // Partial match - update current offer and create new one
      offer.remainingStakeMatcher = matchAmount;
      offer.status = 'MATCHED_PENDING_ACCEPT';
      offer.matchedAt = new Date().toISOString();
      offer.matcherUserId = userId || undefined;
      // Set 20-second deadline for creator to accept/reject
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + 20);
      offer.acceptRejectDeadline = deadline.toISOString();

      // Create new OPEN offer for remaining amount
      const newOffer: Offer = {
        ...offer,
        offerId: `offer_${Date.now()}`,
        stakeCreator: remaining,
        stakeMatcherMax: remaining,
        remainingStakeMatcher: remaining,
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        matchedAt: undefined,
        acceptRejectDeadline: undefined,
        matcherUserId: undefined,
        goodFaithDeposit: calculateGFD(remaining),
        commission: calculateCommission(remaining),
        totalHold: calculateTotalHold(remaining),
        // Legacy
        id: `offer_${Date.now()}`,
        stakeAmount: remaining,
        amount: remaining,
      };

      mockOffers.push(newOffer);
      return { matched: true, newOffer };
    } else {
      // Full match
      offer.remainingStakeMatcher = 0;
      offer.status = 'MATCHED_PENDING_ACCEPT';
      offer.matchedAt = new Date().toISOString();
      offer.matcherUserId = userId || undefined;
      // Set 20-second deadline for creator to accept/reject
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + 20);
      offer.acceptRejectDeadline = deadline.toISOString();
      return { matched: true };
    }
  }

  async matchAndRaise(offerId: string, matchAmount: number, raiseAmount: number): Promise<{ matchedOffer: Offer; raisedOffer: Offer }> {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const originalOffer = mockOffers.find(o => o.offerId === offerId);
    if (!originalOffer) {
      throw new Error('Offer not found');
    }

    // Match the original offer (or portion)
    await this.matchOffer(offerId, matchAmount);
    
    // Create raised offer with postTitle from TRUE situation
    const raisedPostTitle = await generatePostTitle(originalOffer.trueSituationText, true);
    
    const raiseGFD = calculateGFD(raiseAmount);
    const raiseTotalHold = calculateTotalHold(raiseAmount);
    const raiseCommission = calculateCommission(raiseAmount);
    const raiseTotalCharge = raiseTotalHold + raiseCommission;

    if (availableBalance < raiseTotalCharge) {
      throw new Error('INSUFFICIENT_BALANCE');
    }

    const raiseBalanceBefore = availableBalance;
    const raiseHoldBefore = onHoldBalance;
    const raiseUserId = await this.getCurrentUserId();
    const raiseGfdBefore = raiseUserId ? this.getUserGfdBalance(raiseUserId) : 0;

    // Charge commission immediately and hold funds for raised offer
    availableBalance -= raiseTotalCharge;
    onHoldBalance += raiseTotalHold;

    const raiseBalanceAfter = availableBalance;
    const raiseHoldAfter = onHoldBalance;
    const raiseGfdAfter = raiseGfdBefore + raiseGFD;

    // Record hold transaction for raised offer
    this.logTransaction({
      amount: -raiseTotalHold,
      type: 'hold',
      status: 'completed',
      description: `Hold for raised offer ${offerId}`,
      balanceBefore: raiseBalanceBefore,
      balanceAfter: raiseBalanceAfter,
      holdBalanceBefore: raiseHoldBefore,
      holdBalanceAfter: raiseHoldAfter,
      holdDelta: raiseTotalHold,
      gfdBalanceBefore: raiseGfdBefore,
      gfdBalanceAfter: raiseGfdAfter,
      gfdDelta: raiseGFD,
    });

    // Record commission for raised offer
    this.logTransaction({
      amount: -raiseCommission,
      type: 'fee',
      status: 'completed',
      description: `Commission for raised offer ${offerId}`,
      balanceBefore: raiseBalanceAfter + raiseCommission,
      balanceAfter: raiseBalanceAfter,
      holdBalanceBefore: raiseHoldAfter,
      holdBalanceAfter: raiseHoldAfter,
    });

    // Record offer raised event
    this.logTransaction({
      amount: 0,
      type: 'offer',
      status: 'completed',
      description: `Offer raised from ${offerId}`,
      balanceBefore: raiseBalanceBefore,
      balanceAfter: raiseBalanceAfter,
      holdBalanceBefore: raiseHoldBefore,
      holdBalanceAfter: raiseHoldAfter,
    });

    const raisedOffer: Offer = {
      ...originalOffer,
      offerId: `offer_${Date.now()}`,
      postTitle: raisedPostTitle,
      creatorUserId: raiseUserId || originalOffer.creatorUserId,
      stakeCreator: raiseAmount,
      stakeMatcherMax: raiseAmount,
      remainingStakeMatcher: raiseAmount,
      status: 'OPEN',
      parentOfferId: offerId,
      createdAt: new Date().toISOString(),
      goodFaithDeposit: raiseGFD,
      commission: raiseCommission,
      totalHold: raiseTotalHold,
      // Legacy
      id: `offer_${Date.now()}`,
      title: raisedPostTitle,
      stakeAmount: raiseAmount,
      amount: raiseAmount,
    };

    mockOffers.push(raisedOffer);
    return { matchedOffer: originalOffer, raisedOffer };
  }

  async betAgainst(offerId: string, stakeAmount: number): Promise<Offer> {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const originalOffer = mockOffers.find(o => o.offerId === offerId);
    if (!originalOffer) {
      throw new Error('Offer not found');
    }

    // Generate postTitle from TRUE situation (betting against means you want TRUE to happen)
    const postTitle = await generatePostTitle(originalOffer.trueSituationText, false);

    const gfd = calculateGFD(stakeAmount);
    const totalHold = calculateTotalHold(stakeAmount);
    const commission = calculateCommission(stakeAmount);
    const totalCharge = totalHold + commission;

    if (availableBalance < totalCharge) {
      throw new Error('INSUFFICIENT_BALANCE');
    }

    const balanceBefore = availableBalance;
    const holdBefore = onHoldBalance;
    const userId = await this.getCurrentUserId();
    const gfdBefore = userId ? this.getUserGfdBalance(userId) : 0;

    // Charge commission and hold funds
    availableBalance -= totalCharge;
    onHoldBalance += totalHold;

    const balanceAfter = availableBalance;
    const holdAfter = onHoldBalance;
    const gfdAfter = gfdBefore + gfd;

    // Record hold transaction
    this.logTransaction({
      amount: -totalHold,
      type: 'hold',
      status: 'completed',
      description: `Hold for bet against ${offerId}`,
      balanceBefore,
      balanceAfter,
      holdBalanceBefore: holdBefore,
      holdBalanceAfter: holdAfter,
      holdDelta: totalHold,
      gfdBalanceBefore: gfdBefore,
      gfdBalanceAfter: gfdAfter,
      gfdDelta: gfd,
    });

    // Record commission transaction
    this.logTransaction({
      amount: -commission,
      type: 'fee',
      status: 'completed',
      description: `Commission for bet against ${offerId}`,
      balanceBefore: balanceAfter + commission,
      balanceAfter,
      holdBalanceBefore: holdAfter,
      holdBalanceAfter: holdAfter,
    });

    // Record offer creation event
    this.logTransaction({
      amount: 0,
      type: 'offer',
      status: 'completed',
      description: `Offer created via bet against ${offerId}`,
      balanceBefore,
      balanceAfter,
      holdBalanceBefore: holdBefore,
      holdBalanceAfter: holdAfter,
    });

    const newOffer: Offer = {
      ...originalOffer,
      offerId: `offer_${Date.now()}`,
      postTitle,
      creatorUserId: userId || originalOffer.creatorUserId,
      stakeCreator: stakeAmount,
      stakeMatcherMax: stakeAmount,
      remainingStakeMatcher: stakeAmount,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      goodFaithDeposit: gfd,
      commission,
      totalHold,
      // Legacy
      id: `offer_${Date.now()}`,
      title: postTitle,
      stakeAmount,
      amount: stakeAmount,
    };

    mockOffers.push(newOffer);
    return newOffer;
  }

  async confirmResult(offerId: string, outcome: OfferOutcome, userId: string): Promise<Offer> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const offer = mockOffers.find(o => o.offerId === offerId);
    if (!offer) {
      throw new Error('Offer not found');
    }

    if (offer.status !== 'MATCHED') {
      throw new Error('Offer is not in matched state');
    }

    const isCreator = offer.creatorUserId === userId;
    const opponentUserId = isCreator ? offer.matcherUserId : offer.creatorUserId;

    // Set the outcome for the current user
    if (isCreator) {
      offer.creatorOutcome = outcome;
    } else {
      offer.matcherOutcome = outcome;
    }

    // Create notification for opponent
    this.createNotification({
      type: 'opponent_result',
      title: 'Opponent Confirmed Result',
      message: `Your opponent has confirmed a result for "${offer.postTitle}". Tap to verify.`,
      offerId: offer.offerId,
      color: 'yellow',
    });

    // Check if both parties have confirmed
    if (offer.creatorOutcome && offer.matcherOutcome) {
      if (offer.creatorOutcome === offer.matcherOutcome) {
        // Results match - settle the offer
        return this.settleOffer(offerId, outcome, userId);
      } else {
        // Results don't match - dispute
        offer.status = 'DISPUTED';
        
        this.createNotification({
          type: 'result_confirmed',
          title: 'Result Disputed',
          message: `Results don't match for "${offer.postTitle}". Please contact support.`,
          offerId: offer.offerId,
          color: 'red',
        });
      }
    }

    return offer;
  }

  async settleOffer(offerId: string, outcome: OfferOutcome, userId: string): Promise<Offer> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const offer = mockOffers.find(o => o.offerId === offerId);
    if (!offer) {
      throw new Error('Offer not found');
    }

    if (offer.creatorUserId === userId) {
      offer.creatorOutcome = outcome;
    } else {
      offer.matcherOutcome = outcome;
    }

    // If both parties have selected and they match, settle
    if (offer.creatorOutcome && offer.matcherOutcome) {
      if (offer.creatorOutcome === offer.matcherOutcome) {
        const balanceBefore = availableBalance;
        const holdBefore = onHoldBalance;
        const gfdBefore = this.getUserGfdBalance(userId);

        offer.settledOutcome = offer.creatorOutcome;
        offer.status = 'SETTLED';
        
        // Distribute funds (simplified - in production would handle winner/loser logic)
        // GFD refunded to both parties
        const gfd = offer.goodFaithDeposit;
        availableBalance += gfd * 2; // Refund both GFDs
        onHoldBalance -= gfd * 2;

        const balanceAfter = availableBalance;
        const holdAfter = onHoldBalance;
        const gfdAfter = Math.max(0, gfdBefore - gfd * 2);

        // Log GFD refund
        this.logTransaction({
          amount: gfd * 2,
          type: 'gfd_refund',
          status: 'completed',
          description: `Good-Faith Deposit refund for offer ${offerId}`,
          balanceBefore,
          balanceAfter,
          holdBalanceBefore: holdBefore,
          holdBalanceAfter: holdAfter,
          gfdBalanceBefore: gfdBefore,
          gfdBalanceAfter: gfdAfter,
          gfdDelta: -gfd * 2,
        });

        // Log offer settlement
        this.logTransaction({
          amount: 0,
          type: 'offer',
          status: 'completed',
          description: `Offer settled ${offerId}`,
          balanceBefore,
          balanceAfter,
          holdBalanceBefore: holdBefore,
          holdBalanceAfter: holdAfter,
          gfdBalanceBefore: gfdBefore,
          gfdBalanceAfter: gfdAfter,
        });

        // Create settlement notification
        this.createNotification({
          type: 'result_confirmed',
          title: 'Offer Settled!',
          message: `"${offer.postTitle}" has been settled. GFD has been refunded.`,
          offerId: offer.offerId,
          color: 'green',
        });
      } else {
        offer.status = 'DISPUTED';
      }
    }

    return offer;
  }

  // Legacy Bet methods (for backward compatibility)
  async getBets(): Promise<Bet[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return [...mockBets];
  }

  async getBetById(id: string): Promise<Bet | null> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return mockBets.find(bet => bet.id === id) || null;
  }

  async createBet(bet: Omit<Bet, 'id' | 'createdAt'>): Promise<Bet> {
    await new Promise(resolve => setTimeout(resolve, 400));
    const newBet: Bet = {
      ...bet,
      id: String(mockBets.length + 1),
      createdAt: new Date().toISOString(),
    };
    mockBets.push(newBet);
    return newBet;
  }

  // User methods
  async getUserById(id: string): Promise<User | null> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return mockUsers.find(user => user.id === id) || null;
  }

  async getUsers(): Promise<User[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return [...mockUsers];
  }

  // Transaction methods
  async getTransactions(): Promise<Transaction[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return [...mockTransactions];
  }

  async createTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction> {
    await new Promise(resolve => setTimeout(resolve, 400));
    const newTransaction: Transaction = {
      ...transaction,
      id: String(mockTransactions.length + 1),
      createdAt: new Date().toISOString(),
    };
    mockTransactions.push(newTransaction);
    return newTransaction;
  }

  // Notification methods
  private createNotification(notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): AppNotification {
    notificationCounter++;
    const newNotification: AppNotification = {
      ...notification,
      id: `notif_${Date.now()}_${notificationCounter}`,
      createdAt: new Date().toISOString(),
      read: false,
    };
    mockNotifications.unshift(newNotification); // Add to beginning (newest first)
    return newNotification;
  }

  async getNotifications(): Promise<AppNotification[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return [...mockNotifications];
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200));
    const notification = mockNotifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
    }
  }

  async markAllNotificationsRead(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200));
    mockNotifications.forEach(n => n.read = true);
  }

  // Wallet methods
  async getAvailableBalance(): Promise<number> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return availableBalance;
  }

  async getOnHoldBalance(): Promise<number> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return onHoldBalance;
  }

  async addFunds(amount: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    if (amount <= 0) {
      throw new Error('Invalid amount');
    }

    const balanceBefore = availableBalance;
    availableBalance += amount;
    const balanceAfter = availableBalance;

    this.logTransaction({
      amount,
      type: 'deposit',
      status: 'completed',
      description: `Funds added`,
      balanceBefore,
      balanceAfter,
      holdBalanceBefore: onHoldBalance,
      holdBalanceAfter: onHoldBalance,
    });
  }

  async withdrawFunds(amount: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    if (amount <= 0) {
      throw new Error('Invalid amount');
    }
    if (availableBalance < amount) {
      throw new Error('INSUFFICIENT_BALANCE');
    }

    const balanceBefore = availableBalance;
    availableBalance -= amount;
    const balanceAfter = availableBalance;

    this.logTransaction({
      amount: -amount,
      type: 'withdrawal',
      status: 'completed',
      description: `Funds withdrawn`,
      balanceBefore,
      balanceAfter,
      holdBalanceBefore: onHoldBalance,
      holdBalanceAfter: onHoldBalance,
    });
  }

  // Legacy balance methods
  async getBalance(): Promise<number> {
    return this.getAvailableBalance();
  }

  async getOnHold(): Promise<number> {
    return this.getOnHoldBalance();
  }

  async getGoodFaithDeposit(): Promise<number> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return mockTransactions.reduce((sum, tx) => sum + (tx.gfdDelta || 0), 0);
  }

  async getCurrentUserId(): Promise<string | null> {
    try {
      return await authService.getUserId();
    } catch (error) {
      return null;
    }
  }

  // Offer management methods
  async refundOffer(offerId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const offer = mockOffers.find(o => o.offerId === offerId);
    if (!offer) {
      throw new Error('Offer not found');
    }

    if (offer.status !== 'OPEN') {
      throw new Error('Can only refund OPEN offers');
    }

    const userId = offer.creatorUserId;
    const gfdBefore = this.getUserGfdBalance(userId);
    const balanceBefore = availableBalance;
    const holdBefore = onHoldBalance;

    // Refund stake + GFD (commission is NOT refunded)
    const refund = offer.totalHold; // stake + GFD
    availableBalance += refund;
    onHoldBalance -= refund;

    const balanceAfter = availableBalance;
    const holdAfter = onHoldBalance;
    const gfdAfter = gfdBefore - offer.goodFaithDeposit;

    // Log hold release
    this.logTransaction({
      amount: refund,
      type: 'hold',
      status: 'completed',
      description: `Hold released for offer ${offerId}`,
      balanceBefore,
      balanceAfter,
      holdBalanceBefore: holdBefore,
      holdBalanceAfter: holdAfter,
      holdDelta: -refund,
      gfdBalanceBefore: gfdBefore,
      gfdBalanceAfter: gfdAfter,
      gfdDelta: -offer.goodFaithDeposit,
    });

    // Log GFD refund
    this.logTransaction({
      amount: offer.goodFaithDeposit,
      type: 'gfd_refund',
      status: 'completed',
      description: `Good-Faith Deposit refund for offer ${offerId}`,
      balanceBefore,
      balanceAfter,
      holdBalanceBefore: holdAfter,
      holdBalanceAfter: holdAfter,
      gfdBalanceBefore: gfdBefore,
      gfdBalanceAfter: gfdAfter,
      gfdDelta: -offer.goodFaithDeposit,
    });

    // Log offer cancellation
    this.logTransaction({
      amount: 0,
      type: 'offer',
      status: 'completed',
      description: `Offer cancelled ${offerId}`,
      balanceBefore,
      balanceAfter,
      holdBalanceBefore: holdBefore,
      holdBalanceAfter: holdAfter,
    });

    // Remove offer
    mockOffers = mockOffers.filter(o => o.offerId !== offerId);
  }

  async updateOfferOdds(offerId: string, oddsRatio: string, stakeB: number): Promise<Offer> {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const offer = mockOffers.find(o => o.offerId === offerId);
    if (!offer) {
      throw new Error('Offer not found');
    }

    if (offer.status !== 'OPEN') {
      throw new Error('Can only update odds on OPEN offers');
    }

    offer.oddsRatio = oddsRatio;
    offer.stakeB = stakeB;

    return offer;
  }

  async raiseOfferAmount(offerId: string, newAmount: number): Promise<Offer> {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const offer = mockOffers.find(o => o.offerId === offerId);
    if (!offer) {
      throw new Error('Offer not found');
    }

    if (offer.status !== 'OPEN') {
      throw new Error('Can only raise amount on OPEN offers');
    }

    const additionalAmount = newAmount - offer.stakeCreator;
    const additionalGFD = calculateGFD(newAmount) - offer.goodFaithDeposit;
    const additionalHold = additionalAmount + additionalGFD;
    const additionalCommission = calculateCommission(newAmount) - offer.commission;

    if (availableBalance < additionalHold + additionalCommission) {
      throw new Error('INSUFFICIENT_BALANCE');
    }

    const balanceBefore = availableBalance;
    const holdBefore = onHoldBalance;
    const userId = offer.creatorUserId;
    const gfdBefore = this.getUserGfdBalance(userId);

    // Update offer
    offer.stakeCreator = newAmount;
    offer.stakeMatcherMax = newAmount;
    offer.remainingStakeMatcher = newAmount - (offer.stakeMatcherMax - offer.remainingStakeMatcher);
    offer.goodFaithDeposit = calculateGFD(newAmount);
    offer.commission = calculateCommission(newAmount);
    offer.totalHold = calculateTotalHold(newAmount);

    // Deduct additional funds
    availableBalance -= (additionalHold + additionalCommission);
    onHoldBalance += additionalHold;

    const balanceAfter = availableBalance;
    const holdAfter = onHoldBalance;
    const gfdAfter = gfdBefore + additionalGFD;

    // Log hold increase
    this.logTransaction({
      amount: -additionalHold,
      type: 'hold',
      status: 'completed',
      description: `Hold increase for raised offer ${offerId}`,
      balanceBefore,
      balanceAfter,
      holdBalanceBefore: holdBefore,
      holdBalanceAfter: holdAfter,
      holdDelta: additionalHold,
      gfdBalanceBefore: gfdBefore,
      gfdBalanceAfter: gfdAfter,
      gfdDelta: additionalGFD,
    });

    // Record commission as fee
    this.logTransaction({
      amount: -additionalCommission,
      type: 'fee',
      status: 'completed',
      description: `Additional commission for raising offer ${offerId}`,
      balanceBefore: balanceAfter + additionalCommission,
      balanceAfter,
      holdBalanceBefore: holdAfter,
      holdBalanceAfter: holdAfter,
    });

    // Log offer update
    this.logTransaction({
      amount: 0,
      type: 'offer',
      status: 'completed',
      description: `Offer amount raised ${offerId}`,
      balanceBefore,
      balanceAfter,
      holdBalanceBefore: holdBefore,
      holdBalanceAfter: holdAfter,
      gfdBalanceBefore: gfdBefore,
      gfdBalanceAfter: gfdAfter,
    });

    return offer;
  }

  async acceptMatch(offerId: string, autoAccept: boolean = false): Promise<Offer> {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const offer = mockOffers.find(o => o.offerId === offerId);
    if (!offer) {
      throw new Error('Offer not found');
    }

    if (offer.status !== 'MATCHED_PENDING_ACCEPT') {
      throw new Error('Offer is not in pending accept state');
    }

    // Check if deadline has passed - allow auto-acceptance if deadline passed and autoAccept flag is true
    if (offer.acceptRejectDeadline && new Date(offer.acceptRejectDeadline) < new Date()) {
      if (!autoAccept) {
        throw new Error('Accept deadline has passed');
      }
      // Auto-accept after deadline (if not rejected)
    }

    offer.status = 'MATCHED';
    offer.acceptRejectDeadline = undefined;

    // Log accept event
    this.logTransaction({
      amount: 0,
      type: 'offer',
      status: 'completed',
      description: `Match accepted for offer ${offerId}`,
      balanceBefore: availableBalance,
      balanceAfter: availableBalance,
      holdBalanceBefore: onHoldBalance,
      holdBalanceAfter: onHoldBalance,
    });

    // Create notification for creator (offer was matched and accepted)
    this.createNotification({
      type: 'offer_accepted',
      title: 'GAME ON!',
      message: `Your offer "${offer.postTitle}" has been matched! Game is ON!`,
      offerId: offer.offerId,
      color: 'green',
    });

    // Create notification for matcher
    this.createNotification({
      type: 'offer_matched',
      title: 'GAME ON! YOU MATCHED!',
      message: `You matched "${offer.postTitle}"! The creator has accepted. Game is ON!`,
      offerId: offer.offerId,
      color: 'green',
    });

    return offer;
  }

  async rejectMatch(offerId: string): Promise<Offer> {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const offer = mockOffers.find(o => o.offerId === offerId);
    if (!offer) {
      throw new Error('Offer not found');
    }

    if (offer.status !== 'MATCHED_PENDING_ACCEPT') {
      throw new Error('Offer is not in pending accept state');
    }

    // Check if deadline has passed
    if (offer.acceptRejectDeadline && new Date(offer.acceptRejectDeadline) < new Date()) {
      throw new Error('Reject deadline has passed');
    }

    // Calculate refund for matcher (their totalHold)
    const matcherGfd = offer.goodFaithDeposit;
    const matcherTotalHold = offer.totalHold;
    const matcherId = offer.matcherUserId;

    const balanceBefore = availableBalance;
    const holdBefore = onHoldBalance;
    const gfdBefore = matcherId ? this.getUserGfdBalance(matcherId) : 0;

    // Refund matcher's hold (stake + GFD)
    availableBalance += matcherTotalHold;
    onHoldBalance -= matcherTotalHold;

    const balanceAfter = availableBalance;
    const holdAfter = onHoldBalance;
    const gfdAfter = gfdBefore - matcherGfd;

    // Log refund to matcher
    this.logTransaction({
      amount: matcherTotalHold,
      type: 'hold',
      status: 'completed',
      description: `Match rejected - hold released for offer ${offerId}`,
      balanceBefore,
      balanceAfter,
      holdBalanceBefore: holdBefore,
      holdBalanceAfter: holdAfter,
      holdDelta: -matcherTotalHold,
      gfdBalanceBefore: gfdBefore,
      gfdBalanceAfter: gfdAfter,
      gfdDelta: -matcherGfd,
    });

    // Reopen offer
    offer.status = 'OPEN';
    offer.matchedAt = undefined;
    offer.acceptRejectDeadline = undefined;
    offer.matcherUserId = undefined;
    offer.remainingStakeMatcher = offer.stakeMatcherMax;

    // Log reject event
    this.logTransaction({
      amount: 0,
      type: 'offer',
      status: 'completed',
      description: `Match rejected for offer ${offerId}`,
      balanceBefore,
      balanceAfter,
      holdBalanceBefore: holdBefore,
      holdBalanceAfter: holdAfter,
    });

    // Create notification for matcher (match was rejected)
    this.createNotification({
      type: 'match_rejected',
      title: 'Match Rejected',
      message: `Your match for "${offer.postTitle}" was rejected by the creator. Your funds have been refunded.`,
      offerId: offer.offerId,
      color: 'red',
    });

    return offer;
  }

  // Legacy bet actions (mocked)
  async matchExact(betId: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 800));
    return true;
  }

  async matchForLess(betId: string, amount: number): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 800));
    return true;
  }

  async raiseBet(betId: string, amount: number): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 800));
    return true;
  }
}

export const apiClient = new ApiClient();
