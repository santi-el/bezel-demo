import { getOfferPerspective } from '../../models/OfferUtils';
import { DemoEngine, State, Offer as DomainOffer, Draft, amount, allocation, commission, deposit, quote, wallet, reservations, stakeForOdds, opposingStake } from '../../domain/demo';
import { Offer, OfferOutcome } from '../../models/Offer';
import { Transaction } from '../../models/Transaction';
import { Bet } from '../../models/Bet';

// The existing screens speak dollars; the domain only accepts integer cents.
export const toCents = (value: number) => amount(String(value));
function preview(value: number, fn: (cents: number) => number) {
  try {
    return fn(toCents(value)) / 100;
  } catch {
    return 0;
  }
}
export const calculateGFD = (value: number) => preview(value, deposit);
export const calculateCommission = (value: number) => preview(value, commission);
export const calculateTotalHold = (value: number) => preview(value, cents => quote(cents).hold);
export const calculateOddsStake = (value: number, odds: string) => stakeForOdds(toCents(value), odds) / 100;
export const verifyPostTitle = async (text: string) => text.trim();
export const generatePostTitle = async (text: string, _raised = false) => text.trim().split(/\s+/).slice(0, 8).join(' ');
export function projectOffer(s: State, o: DomainOffer, userId?: string): Offer {
  const m = s.matches.find(m => m.id === o.matchId);
  const owner = o.creatorId === userId;
  const own = reservations(s, userId || '').find(r => r.offerId === o.id);
  const viewerStake = owner ? o.creatorStake : m && m.matcherId === userId ? m.matcherStake : o.matcherStake;
  const viewerDeposit = owner ? o.deposit : m && m.matcherId === userId ? m.matcherDeposit : deposit(o.matcherStake);
  const creatorRatio = o.ratioCreator ?? o.creatorStake,
    matcherRatio = o.ratioMatcher ?? o.matcherStake;
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
  const divisor = gcd(creatorRatio, matcherRatio);
  const ownFee = s.entries.filter(e => e.userId === userId && e.offerId === o.id).reduce((n, e) => n + e.fee, 0);
  return {
    offerId: o.id,
    creatorUserId: o.creatorId,
    creatorName: s.accounts.find(a => a.id === o.creatorId)?.username,
    isSample: o.creatorId.startsWith('ecosystem_'),
    propositionText: o.yes,
    trueSituationText: o.yes,
    falseSituationText: o.no,
    nullSituationText: o.tie,
    postTitle: o.postTitle || o.no.split(/\s+/).slice(0, 8).join(' '),
    stakeCreator: o.creatorStake / 100,
    stakeB: o.matcherStake / 100,
    oddsRatio: o.oddsRatio || `${creatorRatio / divisor}:${matcherRatio / divisor}`,
    stakeMatcherMax: o.matcherStake / 100,
    remainingStakeMatcher: o.matcherStake / 100,
    status: o.status,
    parentOfferId: o.parentId,
    distanceMeters: o.distance,
    createdAt: new Date(o.created).toISOString(),
    expiryDate: o.expires === undefined ? undefined : new Date(o.expires).toISOString(),
    matchedAt: m ? new Date(m.deadline - 20000).toISOString() : undefined,
    acceptRejectDeadline: m ? new Date(m.deadline).toISOString() : undefined,
    matcherUserId: m?.matcherId,
    creatorOutcome: m?.creatorOutcome,
    matcherOutcome: m?.matcherOutcome,
    settledOutcome: m?.outcome,
    goodFaithDeposit: o.deposit / 100,
    commission: o.fee / 100,
    totalHold: (o.creatorStake + o.deposit) / 100,
    viewerStake: viewerStake / 100,
    viewerDeposit: viewerDeposit / 100,
    viewerHold: (own?.hold || 0) / 100,
    viewerCommission: ownFee / 100,
    participantUserIds: [o.creatorId, ...s.matches.filter(m => m.offerId === o.id).map(m => m.matcherId)],
    ratioCreator: creatorRatio,
    ratioMatcher: matcherRatio
  };
}
export function matchQuote(o: Offer, stake: number) {
  const q = allocation({
    creatorStake: toCents(o.stakeCreator),
    matcherStake: toCents(o.remainingStakeMatcher),
    deposit: Math.round(o.goodFaithDeposit * 100),
    ratioCreator: o.ratioCreator,
    ratioMatcher: o.ratioMatcher
  } as DomainOffer, toCents(stake));
  return {
    creatorStake: q.creatorStake / 100,
    matcherStake: q.matcherStake / 100,
    prize: (q.creatorStake + q.matcherStake) / 100
  };
}
// Preview mode changes presentation only; authorization always uses the signed-in account.
export function offerPreview(o: Offer, userId: string | null, publicPreview = false) {
  const ownsOffer = userId === o.creatorUserId;
  const showOwner = ownsOffer && !publicPreview;
  const perspective = getOfferPerspective(o, showOwner ? userId : null);
  const q = matchQuote(o, o.remainingStakeMatcher);
  return {
    ...perspective,
    ownsOffer,
    receive: q.prize,
    lose: showOwner ? q.creatorStake : q.matcherStake,
    canMatch: !!userId && !ownsOffer && o.status === 'OPEN',
  };
}

export function opposingOfferQuote(o: Offer, stake: number) {
  const other = opposingStake({
    creatorStake: toCents(o.stakeCreator),
    matcherStake: toCents(o.remainingStakeMatcher),
    ratioCreator: o.ratioCreator,
    ratioMatcher: o.ratioMatcher
  } as DomainOffer, toCents(stake)) / 100;
  return {
    opponentStake: other,
    prize: stake + other
  };
}
export function projectTransactions(s: State, userId: string): Transaction[] {
  let hold = 0,
    gfd = 0;
  return s.entries.filter(e => e.userId === userId).map(e => {
    const beforeHold = hold,
      beforeGfd = gfd;
    hold += e.holdDelta;
    gfd += e.depositDelta;
    return {
      id: e.id,
      userId: e.userId,
      offerId: e.offerId,
      matchId: e.matchId,
      amount: e.availableDelta / 100,
      type: e.fee ? 'fee' : !e.offerId ? e.availableDelta < 0 ? 'withdrawal' : 'deposit' : e.holdDelta > 0 ? 'hold' : e.availableDelta > 0 ? 'payout' : 'offer',
      status: 'completed',
      createdAt: new Date(e.at).toISOString(),
      description: e.description,
      balanceBefore: (e.balanceAfter - e.availableDelta) / 100,
      balanceAfter: e.balanceAfter / 100,
      holdBalanceBefore: beforeHold / 100,
      holdBalanceAfter: hold / 100,
      holdDelta: e.holdDelta / 100,
      gfdBalanceBefore: beforeGfd / 100,
      gfdBalanceAfter: gfd / 100,
      gfdDelta: e.depositDelta / 100,
      stakeAmount: Math.abs(e.holdDelta - e.depositDelta) / 100,
      depositAmount: Math.abs(e.depositDelta) / 100,
      commissionAmount: e.fee / 100
    } as Transaction;
  });
}
export type NotificationType = 'offer_matched' | 'offer_accepted' | 'offer_posted' | 'offer_raised' | 'result_confirmed' | 'opponent_result' | 'match_rejected';
export interface AppNotification {
  id: string;
  type: NotificationType;
  canMatch?: boolean;
  offerStatus?: string;
  title: string;
  message: string;
  offerId?: string;
  createdAt: string;
  read: boolean;
  color: 'green' | 'yellow' | 'red' | 'default';
}
type NewOffer = Omit<Offer, 'offerId' | 'createdAt' | 'goodFaithDeposit' | 'commission' | 'totalHold'>;
export class ApiClient {
  private pending = new Map<string, Promise<unknown>>();
  constructor(private engine: DemoEngine) {}
  private async context() {
    const s = await this.engine.snapshot();
    if (!s.sessionId) throw Error('Please sign in');
    return {
      s,
      user: s.sessionId
    };
  }
  private mutation<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.pending.get(name);
    if (previous) return previous as Promise<T>;
    const task = operation().finally(() => this.pending.delete(name));
    this.pending.set(name, task);
    return task;
  }
  async getOffers() {
    const {
      s,
      user
    } = await this.context();
    return s.offers.map(o => projectOffer(s, o, user));
  }
  async getOfferById(id: string) {
    return (await this.getOffers()).find(o => o.offerId === id) || null;
  }
  async getReservationOffers() {
    return (await this.getOffers()).filter(o => (o.viewerHold || 0) > 0);
  }
  async createOffer(input: NewOffer, key?: string) {
    return this.mutation(`create:${key || JSON.stringify(input)}`, async () => {
      const {
        user
      } = await this.context();
      if (input.creatorUserId !== user) throw Error('Only the signed-in user can create an offer');
      const expires = input.expiryDate ? Date.parse(input.expiryDate) : undefined;
      if (expires !== undefined && (!Number.isFinite(expires) || expires <= Date.now())) throw Error('Expiry must be in the future');
      const draft: Draft = {
        creatorStake: toCents(input.stakeCreator),
        matcherStake: toCents(input.stakeB ?? input.stakeMatcherMax),
        yes: input.trueSituationText,
        no: input.falseSituationText,
        tie: input.nullSituationText,
        minutes: expires === undefined ? -1 : Math.max(1, Math.ceil((expires - Date.now()) / 60000)),
        parentId: input.parentOfferId || undefined,
        postTitle: input.postTitle,
        oddsRatio: input.oddsRatio
      };
      const o = await this.engine.createOffer(user, draft, key);
      return (await this.getOfferById(o.id))!;
    });
  }
  async matchOffer(id: string, value: number, key?: string) {
    return this.mutation(`match:${id}:${key || value}`, async () => {
      const {
        user
      } = await this.context();
      const o = await this.engine.matchOffer(user, id, toCents(value), key);
      return {
        matched: true,
        newOffer: undefined,
        matchedOffer: (await this.getOfferById(o.id))!
      };
    });
  }
  async matchAndRaise(id: string, value: number, raise: number, stakeB = raise, oddsRatio = '1:1', key?: string, active = false) {
    return this.mutation(`raise:${id}:${key || `${value}:${raise}:${stakeB}`}`, async () => {
      const {
        user
      } = await this.context();
      const source = await this.getOfferById(id);
      if (!source) throw Error('Offer unavailable');
      const draft: Draft = {
        creatorStake: toCents(raise),
        matcherStake: toCents(stakeB),
        yes: source.falseSituationText,
        no: source.trueSituationText,
        tie: source.nullSituationText,
        minutes: -1,
        oddsRatio
      };
      const result = active ? {
        raised: await this.engine.raiseActive(user, id, draft, key),
        matched: {
          id
        }
      } : await this.engine.matchAndRaise(user, id, toCents(value), draft, key);
      return {
        matchedOffer: (await this.getOfferById(result.matched.id))!,
        raisedOffer: (await this.getOfferById(result.raised.id))!
      };
    });
  }
  async betAgainst(id: string, value: number, key?: string) {
    const {
      user
    } = await this.context();
    const o = await this.engine.betAgainst(user, id, toCents(value), key);
    return (await this.getOfferById(o.id))!;
  }
  async confirmResult(id: string, outcome: OfferOutcome, userId: string) {
    const {
      user
    } = await this.context();
    if (user !== userId) throw Error('Only the signed-in participant can confirm');
    await this.engine.confirm(user, id, outcome);
    return (await this.getOfferById(id))!;
  }
  async settleOffer(id: string, outcome: OfferOutcome, userId: string) {
    const {
      user
    } = await this.context();
    if (user !== userId) throw Error('Only the signed-in participant can resolve');
    await this.engine.resolve(user, id, outcome);
    return (await this.getOfferById(id))!;
  }
  async refundOffer(id: string) {
    const {
      user
    } = await this.context();
    await this.engine.cancel(user, id);
  }
  async updateOfferOdds(id: string, odds: string, stakeB: number) {
    const {
      user
    } = await this.context();
    const o = await this.getOfferById(id);
    if (!o) throw Error('Offer unavailable');
    await this.engine.edit(user, id, toCents(o.stakeCreator), toCents(stakeB), odds);
    return (await this.getOfferById(id))!;
  }
  async raiseOfferAmount(id: string, value: number) {
    const {
      user
    } = await this.context();
    const o = await this.getOfferById(id);
    if (!o) throw Error('Offer unavailable');
    const a = toCents(value);
    const b = Math.round(a * (o.ratioMatcher ?? toCents(o.remainingStakeMatcher)) / (o.ratioCreator ?? toCents(o.stakeCreator)));
    await this.engine.edit(user, id, a, b, o.oddsRatio);
    return (await this.getOfferById(id))!;
  }
  async acceptMatch(id: string, auto = false) {
    const {
      user
    } = await this.context();
    if (auto) {
      const o = await this.getOfferById(id);
      if (o?.status !== 'MATCHED') throw Error('Match is not accepted or was rejected');
      return o;
    }
    await this.engine.acceptMatch(user, id);
    return (await this.getOfferById(id))!;
  }
  async rejectMatch(id: string) {
    const {
      user
    } = await this.context();
    await this.engine.rejectMatch(user, id);
    return (await this.getOfferById(id))!;
  }
  async getUsers() {
    const s = await this.engine.snapshot();
    return s.accounts.map(a => ({
      id: a.id,
      username: a.username,
      score: 100
    }));
  }
  async getUserById(id: string) {
    return (await this.getUsers()).find(a => a.id === id) || null;
  }
  async getTransactions() {
    const {
      s,
      user
    } = await this.context();
    return projectTransactions(s, user).reverse();
  }
  async getNotifications(): Promise<AppNotification[]> {
    const {
      s,
      user
    } = await this.context();
    return s.notices.filter(n => n.userId === user).map(n => {
      const t = n.text;
      const type: NotificationType = n.kind === 'raised' ? 'offer_raised' : t.startsWith('Match requested') ? 'offer_matched' : t.startsWith('Match accepted') ? 'offer_accepted' : t.startsWith('Opponent submitted') ? 'opponent_result' : t.startsWith('Match rejected') ? 'match_rejected' : t.includes('settled') || t.startsWith('Disputed') ? 'result_confirmed' : 'offer_posted';
      const offer = s.offers.find(o => o.id === n.offerId);
      const title = n.offerTitle || offer?.postTitle || offer?.title || 'Offer unavailable';
      const actor = n.actorName || s.accounts.find(a => a.id === (n.actorId || offer?.creatorId))?.username || 'Someone';
      const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
      const divisor = gcd(n.creatorStake || 1, n.matcherStake || 1);
      const event = n.kind === 'raised' ? 'raised' : 'posted';
      const specific = n.kind === 'raised' || n.kind === 'posted' || t === 'Offer posted';
      return {
        id: n.id,
        canMatch: n.kind === 'raised' && !!offer && offer.status === 'OPEN' && offer.creatorId !== user,
        offerStatus: offer?.status || 'UNAVAILABLE',
        type,
        title: specific ? `${actor} ${event} an offer` : t.split('.')[0],
        message: specific ? `${title}${n.creatorStake !== undefined && n.matcherStake !== undefined ? ` · $${(n.creatorStake / 100).toFixed(2)} vs $${(n.matcherStake / 100).toFixed(2)} · Odds ${n.creatorStake / divisor}:${n.matcherStake / divisor}` : ''}` : `${title}\n${t}`,
        offerId: n.offerId,
        createdAt: new Date(n.at).toISOString(),
        read: n.read,
        color: t.startsWith('Disputed') || type === 'match_rejected' ? 'red' : type === 'offer_accepted' || t.includes('settled') ? 'green' : 'yellow'
      };
    });
  }
  async getNotificationMatch(id: string) {
    const notice = (await this.getNotifications()).find(n => n.id === id);
    if (!notice?.canMatch || !notice.offerId) throw Error('This offer is no longer available to match.');
    return notice.offerId;
  }
  async markNotificationRead(id: string) {
    const {
      user
    } = await this.context();
    await this.engine.readNotice(user, id);
  }
  async markAllNotificationsRead() {
    for (const n of await this.getNotifications()) if (!n.read) await this.markNotificationRead(n.id);
  }
  private async balances() {
    const {
      s,
      user
    } = await this.context();
    return wallet(s, user);
  }
  async getAvailableBalance() {
    return (await this.balances()).available / 100;
  }
  async getOnHoldBalance() {
    return (await this.balances()).hold / 100;
  }
  async getGoodFaithDeposit() {
    return (await this.balances()).deposit / 100;
  }
  getBalance() {
    return this.getAvailableBalance();
  }
  getOnHold() {
    return this.getOnHoldBalance();
  }
  async addFunds(value: number, key?: string) {
    return this.mutation(`deposit:${key || value}`, async () => {
      const {
        user
      } = await this.context();
      await this.engine.funds(user, toCents(value), false, key);
    });
  }
  async withdrawFunds(value: number, key?: string) {
    return this.mutation(`withdraw:${key || value}`, async () => {
      const {
        user
      } = await this.context();
      await this.engine.funds(user, toCents(value), true, key);
    });
  }
  async getCurrentUserId() {
    return (await this.engine.snapshot()).sessionId || null;
  }
  async saveReport(kind: string, text: string, offerId?: string) {
    return this.mutation(`report:${kind}:${offerId}:${text}`, async () => {
      const {
        user
      } = await this.context();
      return this.engine.report(user, kind, text, offerId);
    });
  }
  // Legacy entry points project into the canonical offer store, never a second balance store.
  async getBets(): Promise<Bet[]> {
    return [];
  }
  async getBetById(id: string): Promise<Bet | null> {
    const o = await this.getOfferById(id);
    return o ? {
      id: o.offerId,
      title: o.postTitle,
      stakeAmount: o.stakeCreator,
      goodFaithDeposit: o.goodFaithDeposit,
      totalHold: o.totalHold,
      commission: o.commission,
      odds: (o.stakeB || o.stakeCreator) / o.stakeCreator,
      distance: o.distanceMeters,
      userId: o.creatorUserId,
      status: o.status === 'OPEN' ? 'active' : o.status === 'SETTLED' ? 'completed' : o.status === 'CANCELLED' || o.status === 'EXPIRED' ? 'cancelled' : 'matched',
      createdAt: o.createdAt
    } : null;
  }
  async createBet(b: Omit<Bet, 'id' | 'createdAt'>) {
    const {
      user
    } = await this.context();
    const o = await this.createOffer({
      creatorUserId: user,
      propositionText: b.title,
      trueSituationText: b.title,
      falseSituationText: `Not: ${b.title}`,
      postTitle: b.title,
      stakeCreator: b.stakeAmount,
      stakeB: Math.round(b.stakeAmount * b.odds * 100) / 100,
      stakeMatcherMax: b.stakeAmount,
      remainingStakeMatcher: b.stakeAmount,
      status: 'OPEN',
      distanceMeters: 150
    });
    return (await this.getBetById(o.offerId))!;
  }
  async matchExact(id: string) {
    const o = await this.getOfferById(id);
    if (!o) throw Error('Offer unavailable');
    await this.matchOffer(id, o.remainingStakeMatcher);
    return true;
  }
  async matchForLess(id: string, value: number) {
    await this.matchOffer(id, value);
    return true;
  }
  async raiseBet(id: string, value: number) {
    await this.matchAndRaise(id, 0, value, value, '1:1', undefined, true);
    return true;
  }
}
