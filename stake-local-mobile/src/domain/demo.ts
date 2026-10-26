export type Outcome = 'TRUE' | 'FALSE' | 'NULL';
export type Status = 'OPEN' | 'MATCHED_PENDING_ACCEPT' | 'MATCHED' | 'SETTLED' | 'DISPUTED' | 'CANCELLED' | 'EXPIRED';
export interface Account {
  id: string;
  username: string;
  available: number;
  notifications: boolean;
  location: boolean;
}
export interface Offer {
  id: string;
  creatorId: string;
  title: string;
  postTitle?: string;
  oddsRatio?: string;
  yes: string;
  no: string;
  tie?: string;
  creatorStake: number;
  matcherStake: number;
  deposit: number;
  fee: number;
  status: Status;
  created: number;
  expires?: number;
  parentId?: string;
  location: string;
  distance: number;
  matchId?: string;
  ratioCreator?: number;
  ratioMatcher?: number;
}
export interface Match {
  id: string;
  offerId: string;
  creatorId: string;
  matcherId: string;
  creatorStake: number;
  matcherStake: number;
  creatorDeposit: number;
  matcherDeposit: number;
  deadline: number;
  status: Status;
  creatorOutcome?: Outcome;
  matcherOutcome?: Outcome;
  outcome?: Outcome;
}
export interface Entry {
  id: string;
  userId: string;
  offerId?: string;
  matchId?: string;
  at: number;
  availableDelta: number;
  holdDelta: number;
  depositDelta: number;
  fee: number;
  description: string;
  balanceAfter: number;
}
export interface Notice {
  kind?: 'posted' | 'raised';
  actorId?: string;
  sourceOfferId?: string;
  offerTitle?: string;
  actorName?: string;
  creatorStake?: number;
  matcherStake?: number;
  id: string;
  userId: string;
  offerId: string;
  text: string;
  read: boolean;
  at: number;
}
export interface Report {
  id: string;
  userId: string;
  offerId?: string;
  kind: string;
  text: string;
  at: number;
}
export interface State {
  version: 1;
  ecosystemVersion?: number;
  sessionId?: string;
  operations?: Record<string, unknown>;
  sequence: number;
  accounts: Account[];
  offers: Offer[];
  matches: Match[];
  entries: Entry[];
  notices: Notice[];
  reports: Report[];
}
export interface Storage {
  load(): Promise<string | null>;
  save(value: string): Promise<void>;
}
export interface Draft {
  postTitle?: string;
  oddsRatio?: string;
  creatorStake: number;
  matcherStake: number;
  yes: string;
  no: string;
  tie?: string;
  minutes: number;
  parentId?: string;
  location?: string;
}
export const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
export function amount(text: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(text.trim())) throw Error('Enter a positive amount with at most two decimals');
  const n = Math.round(Number(text) * 100);
  positive(n);
  return n;
}
export function positive(n: number) {
  if (!Number.isSafeInteger(n) || n <= 0 || n > 100000000) throw Error('Invalid amount (maximum $1,000,000)');
}
// Rational arithmetic avoids floating-point drift at half-cent boundaries.
function roundRatio(value: number, numerator: number, denominator: number) {
  return Number((2n * BigInt(value) * BigInt(numerator) + BigInt(denominator)) / (2n * BigInt(denominator)));
}
export const deposit = (stake: number) => Math.max(200, roundRatio(stake, 1, 5));
export const commission = (stake: number) => Math.max(28, roundRatio(stake, 279, 10000));
export const quote = (stake: number) => {
  positive(stake);
  return {
    stake,
    deposit: deposit(stake),
    fee: commission(stake),
    hold: stake + deposit(stake),
    debit: stake + deposit(stake) + commission(stake)
  };
};
export function allocation(o: Offer, matcherStake: number) {
  positive(matcherStake);
  if (matcherStake > o.matcherStake) throw Error('Amount exceeds available stake');
  const creatorStake = matcherStake === o.matcherStake ? o.creatorStake : roundRatio(matcherStake, o.ratioCreator ?? o.creatorStake, o.ratioMatcher ?? o.matcherStake);
  if (!creatorStake || matcherStake < o.matcherStake && creatorStake >= o.creatorStake) throw Error('Partial amount is too small or leaves less than one cent');
  const creatorDeposit = matcherStake === o.matcherStake ? o.deposit : roundRatio(o.deposit, creatorStake, o.creatorStake);
  return {
    creatorStake,
    creatorDeposit,
    matcherStake,
    matcherDeposit: deposit(matcherStake),
    fee: commission(matcherStake)
  };
}
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
export class DemoEngine {
  private state?: State;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private storage: Storage, private clock: () => number = Date.now) {}
  private id(s: State, prefix: string) {
    return `${prefix}_${++s.sequence}`;
  }
  private account(s: State, id: string) {
    const a = s.accounts.find(a => a.id === id);
    if (!a) throw Error('Please sign in');
    return a;
  }
  private offer(s: State, id: string) {
    const o = s.offers.find(o => o.id === id);
    if (!o) throw Error('Offer unavailable');
    return o;
  }
  private entry(s: State, userId: string, availableDelta: number, holdDelta: number, depositDelta: number, description: string, offerId?: string, matchId?: string, fee = 0) {
    const a = this.account(s, userId);
    if (!Number.isSafeInteger(a.available + availableDelta)) throw Error('Balance exceeds the demo limit');
    if (a.available + availableDelta < 0) throw Error('INSUFFICIENT_BALANCE');
    a.available += availableDelta;
    s.entries.push({
      id: this.id(s, 'tx'),
      userId,
      offerId,
      matchId,
      at: this.clock(),
      availableDelta,
      holdDelta,
      depositDelta,
      description,
      fee,
      balanceAfter: a.available
    });
  }
  private notice(s: State, userId: string, offerId: string, text: string, details: Partial<Notice> = {}) {
    if (!this.account(s, userId).notifications) return;
    s.notices.unshift({
      id: this.id(s, 'notice'),
      userId,
      offerId,
      text,
      read: false,
      at: this.clock(),
      ...details
    });
  }
  private offerEvent(s: State, o: Offer, actor: string, kind: 'posted' | 'raised', sourceId = o.id) {
    const details = {kind, actorId: actor, actorName: this.account(s, actor).username,
      sourceOfferId: sourceId, offerTitle: o.postTitle || o.title,
      creatorStake: o.creatorStake, matcherStake: o.matcherStake};
    const recipients = new Set<string>([actor]);
    if (kind === 'raised') {
      const source = this.offer(s, sourceId);
      recipients.add(source.creatorId);
      for (const m of s.matches.filter(m => m.offerId === sourceId || this.offer(s, m.offerId).parentId === sourceId)) {
        recipients.add(m.creatorId); recipients.add(m.matcherId);
      }
      recipients.delete(actor);
    }
    for (const recipient of recipients) this.notice(s, recipient, o.id, kind === 'raised' ? 'Offer raised' : 'Offer posted', details);
  }
  private seedEcosystem(s: State) {
    if ((s.ecosystemVersion ?? 0) >= 1) return;
    const names = ['MadridFan', 'CourtSide', 'LocalChallenger'];
    names.forEach((username, i) => {
      const id = `ecosystem_${i + 1}`;
      if (!s.accounts.some(a => a.id === id)) {
        s.accounts.push({id, username, available: 0, notifications: true, location: true});
        this.entry(s, id, 125050, 0, 0, 'Demo starting funds');
      }
    });
    const samples = [
      ['Real Madrid vs. Barcelona', 'Real Madrid wins the demo match', 'Barcelona wins the demo match', 2500, 2500],
      ['Lakers vs. Celtics', 'Lakers win the demo game', 'Celtics win the demo game', 2000, 2000],
      ['Sunday tennis challenge', 'Alex wins the demo tennis match', 'Sam wins the demo tennis match', 1000, 2000],
      ['Weekend weather', 'It rains during the demo picnic', 'It stays dry during the demo picnic', 1000, 1000],
      ['Community 5K', 'Alex finishes the demo 5K under 25 minutes', 'Alex takes 25 minutes or more', 1500, 1500],
      ['Free throw challenge', 'Sam makes at least 7 of 10 demo free throws', 'Sam makes fewer than 7', 1000, 1500],
    ] as const;
    samples.forEach(([postTitle, yes, no, creatorStake, matcherStake], i) => {
      const o = this.create(s, `ecosystem_${i % 3 + 1}`, {postTitle, yes, no, tie: 'Event drawn, cancelled or not completed', creatorStake, matcherStake, minutes: -1, location: 'Demo neighborhood'});
      o.distance = [150, 300, 450, 650, 800, 1200][i];
    });
    s.ecosystemVersion = 1;
  }
  private seed(): State {
    const s: State = {
      version: 1,
      sequence: 0,
      accounts: [],
      offers: [],
      matches: [],
      entries: [],
      notices: [],
      reports: []
    };
    for (const [id, username] of [['dev_user_1', 'betmaster99'], ['dev_user_2', 'BoxDaddy']]) {
      s.accounts.push({
        id,
        username,
        available: 0,
        notifications: true,
        location: true
      });
      this.entry(s, id, 125050, 0, 0, 'Demo starting funds');
    }
    this.create(s, 'dev_user_2', {
      creatorStake: 2500,
      matcherStake: 5000,
      yes: 'The home team wins',
      no: 'The away team wins',
      tie: 'The game is cancelled',
      minutes: -1
    });
    this.create(s, 'dev_user_1', {
      creatorStake: 1000,
      matcherStake: 1000,
      yes: 'It rains tomorrow',
      no: 'It does not rain tomorrow',
      minutes: -1
    });
    this.seedEcosystem(s);
    return s;
  }
  private async run<T>(fn: (s: State) => T, key?: string): Promise<T> {
    const task = this.queue.then(async () => {
      if (!this.state) {
        const raw = await this.storage.load();
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.version !== 1 || !['accounts', 'entries', 'offers', 'matches', 'notices', 'reports'].every(key => Array.isArray(parsed[key])) || parsed.sessionId && !parsed.accounts.some((a: Account) => a.id === parsed.sessionId)) throw Error('Unsupported demo data. Reset demo from Settings.');
          this.state = parsed;
        } else {
          const seeded = this.seed();
          await this.storage.save(JSON.stringify(seeded));
          this.state = seeded;
        }
      }
      // Deadline transitions commit independently, even if the requested action is now stale.
      const next = clone(this.state!);
      this.seedEcosystem(next);
      this.deadlines(next);
      if (JSON.stringify(next) !== JSON.stringify(this.state)) {
        await this.storage.save(JSON.stringify(next));
        this.state = clone(next);
      }
      if (key && Object.prototype.hasOwnProperty.call(next.operations || {}, key)) return clone(next.operations![key]) as T;
      // A failed operation or storage write never publishes its draft to readers.
      const value = fn(next);
      this.deadlines(next);
      if (key) {
        next.operations ??= {};
        next.operations[key] = value ?? null;
      }
      const serialized = JSON.stringify(next);
      if (serialized !== JSON.stringify(this.state)) await this.storage.save(serialized);
      this.state = next;
      return value === undefined ? value : clone(value);
    });
    this.queue = task.catch(() => {});
    return task;
  }
  switchAccount(id?: string) {
    return this.run(s => {
      if (id) this.account(s, id);
      s.sessionId = id;
    });
  }
  snapshot() {
    return this.run(s => s);
  }
  async reset() {
    const task = this.queue.then(async () => {
      const s = this.seed();
      await this.storage.save(JSON.stringify(s));
      this.state = s;
    });
    this.queue = task.catch(() => {});
    return task;
  }
  register(username: string, signIn = false) {
    return this.run(s => {
      username = username.trim();
      if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) throw Error('Use 3–24 letters, numbers or underscores');
      if (s.accounts.some(a => a.username.toLowerCase() === username.toLowerCase())) throw Error('Username already exists');
      const id = this.id(s, 'user');
      const a: Account = {
        id,
        username,
        available: 0,
        notifications: true,
        location: true
      };
      s.accounts.push(a);
      this.entry(s, id, 125050, 0, 0, 'Demo starting funds');
      if (signIn) s.sessionId = id;
      return a;
    });
  }
  private create(s: State, actor: string, d: Draft) {
    this.account(s, actor);
    positive(d.creatorStake);
    positive(d.matcherStake);
    if (!d.yes.trim() || !d.no.trim() || d.yes.trim() === d.no.trim()) throw Error('Enter two distinct outcomes');
    if (d.minutes !== -1 && (!Number.isInteger(d.minutes) || d.minutes <= 0)) throw Error('Invalid expiry');
    const q = quote(d.creatorStake);
    const o: Offer = {
      id: this.id(s, 'offer'),
      creatorId: actor,
      title: d.yes.trim().slice(0, 80),
      postTitle: d.postTitle?.trim(),
      oddsRatio: d.oddsRatio,
      yes: d.yes.trim(),
      no: d.no.trim(),
      tie: d.tie?.trim() || undefined,
      creatorStake: d.creatorStake,
      matcherStake: d.matcherStake,
      ratioCreator: d.creatorStake,
      ratioMatcher: d.matcherStake,
      deposit: q.deposit,
      fee: q.fee,
      status: 'OPEN',
      created: this.clock(),
      expires: d.minutes === -1 ? undefined : this.clock() + d.minutes * 60000,
      parentId: d.parentId,
      location: d.location || 'Demo Central Plaza',
      distance: 150
    };
    this.entry(s, actor, -q.hold, q.hold, q.deposit, 'Offer funds held', o.id);
    this.entry(s, actor, -q.fee, 0, 0, 'Nonrefundable commission', o.id, undefined, q.fee);
    s.offers.push(o);
    this.offerEvent(s, o, actor, 'posted');
    return o;
  }
  createOffer(actor: string, d: Draft, key?: string) {
    return this.run(s => this.create(s, actor, d), key && `${actor}:create:${key}`);
  }
  private match(s: State, actor: string, id: string, stake: number) {
    this.account(s, actor);
    const original = this.offer(s, id);
    if (original.creatorId === actor) throw Error('You cannot match your own offer');
    if (original.status !== 'OPEN') throw Error('Offer is no longer open');
    const q = allocation(original, stake);
    let o = original;
    if (stake < original.matcherStake) {
      o = {
        ...original,
        id: this.id(s, 'offer'),
        creatorStake: q.creatorStake,
        matcherStake: stake,
        deposit: q.creatorDeposit,
        fee: 0,
        parentId: original.id
      };
      original.creatorStake -= q.creatorStake;
      original.matcherStake -= stake;
      original.deposit -= q.creatorDeposit;
      s.offers.push(o); // Transfer the creator reservation to the matched slice, without debiting again.
      this.entry(s, original.creatorId, 0, -q.creatorStake - q.creatorDeposit, -q.creatorDeposit, 'Reservation allocated to partial match', original.id);
      this.entry(s, original.creatorId, 0, q.creatorStake + q.creatorDeposit, q.creatorDeposit, 'Partial match reservation', o.id);
    }
    const m: Match = {
      id: this.id(s, 'match'),
      offerId: o.id,
      creatorId: o.creatorId,
      matcherId: actor,
      creatorStake: q.creatorStake,
      matcherStake: stake,
      creatorDeposit: q.creatorDeposit,
      matcherDeposit: q.matcherDeposit,
      deadline: this.clock() + 20000,
      status: 'MATCHED_PENDING_ACCEPT'
    };
    this.entry(s, actor, -stake - q.matcherDeposit, stake + q.matcherDeposit, q.matcherDeposit, 'Match funds held', o.id, m.id);
    this.entry(s, actor, -q.fee, 0, 0, 'Nonrefundable match commission', o.id, m.id, q.fee);
    o.status = m.status;
    o.matchId = m.id;
    s.matches.push(m);
    this.notice(s, o.creatorId, o.id, 'Match requested: accept or reject within 20 seconds');
    this.notice(s, actor, o.id, 'Match pending; automatically accepted after 20 seconds');
    return o;
  }
  matchOffer(actor: string, id: string, stake: number, key?: string) {
    return this.run(s => this.match(s, actor, id, stake), key && `${actor}:match:${key}`);
  }
  matchAndRaise(actor: string, id: string, stake: number, d: Draft, key?: string) {
    return this.run(s => {
      const source = clone(this.offer(s, id));
      const matched = this.match(s, actor, id, stake);
      const raised = this.create(s, actor, {
        ...d,

        yes: source.no,
        no: source.yes,
        tie: source.tie,
        parentId: id
      });
      this.offerEvent(s, raised, actor, 'raised', id);
      return {
        matched,
        raised
      };
    }, key && `${actor}:raise:${key}`);
  }
  raiseActive(actor: string, id: string, d: Draft, key?: string) {
    return this.run(s => {
      const {o,m} = this.getMatch(s,id);
      if (m.status !== 'MATCHED' || (actor !== m.creatorId && actor !== m.matcherId)) throw Error('Only a participant can raise an active wager');
      const creator = actor === m.creatorId;
      const raised = this.create(s, actor, {...d, yes: creator ? o.yes : o.no, no: creator ? o.no : o.yes, tie:o.tie, parentId:id});
      this.offerEvent(s, raised, actor, 'raised', id);
      return raised;
    }, key && `${actor}:active-raise:${key}`);
  }
  betAgainst(actor: string, id: string, stake: number, key?: string) {
    return this.run(s => {
      const o = this.offer(s, id);
      if (o.status !== 'OPEN') throw Error('Choose an open offer');
      positive(stake);
      return this.create(s, actor, {
        creatorStake: stake,
        matcherStake: opposingStake(o, stake),
        yes: o.no,
        no: o.yes,
        tie: o.tie,
        minutes: -1,
        parentId: id
      });
    }, key && `${actor}:against:${key}`);
  }
  private getMatch(s: State, id: string) {
    const o = this.offer(s, id);
    const m = s.matches.find(m => m.id === o.matchId);
    if (!m) throw Error('No match for this offer');
    return {
      o,
      m
    };
  }
  private accept(s: State, o: Offer, m: Match) {
    m.status = o.status = 'MATCHED';
    for (const id of [m.creatorId, m.matcherId]) this.notice(s, id, o.id, 'Match accepted. Game on!');
  }
  acceptMatch(actor: string, id: string) {
    return this.run(s => {
      const {
        o,
        m
      } = this.getMatch(s, id);
      if (actor !== m.creatorId) throw Error('Only the creator can accept');
      if (m.status === 'MATCHED') return o;
      if (m.status !== 'MATCHED_PENDING_ACCEPT') throw Error('Match is not pending');
      this.accept(s, o, m);
      return o;
    });
  }
  rejectMatch(actor: string, id: string) {
    return this.run(s => {
      const {
        o,
        m
      } = this.getMatch(s, id);
      if (actor !== m.creatorId || m.status !== 'MATCHED_PENDING_ACCEPT') throw Error('Only the creator can reject a pending match before its deadline');
      this.entry(s, m.matcherId, m.matcherStake + m.matcherDeposit, -m.matcherStake - m.matcherDeposit, -m.matcherDeposit, 'Rejected match refund', o.id, m.id);
      m.status = 'CANCELLED';
      o.status = 'OPEN';
      o.matchId = undefined;
      this.notice(s, m.matcherId, o.id, 'Match rejected; held funds returned. Commission remains charged.');
      return o;
    });
  }
  private release(s: State, o: Offer, status: 'CANCELLED' | 'EXPIRED') {
    this.entry(s, o.creatorId, o.creatorStake + o.deposit, -o.creatorStake - o.deposit, -o.deposit, 'Offer reservation released', o.id);
    o.status = status;
    this.notice(s, o.creatorId, o.id, status === 'EXPIRED' ? 'Offer expired; funds released' : 'Offer cancelled; funds released');
  }
  cancel(actor: string, id: string) {
    return this.run(s => {
      const o = this.offer(s, id);
      if (o.creatorId !== actor || o.status !== 'OPEN') throw Error('Only the owner can cancel an open offer');
      this.release(s, o, 'CANCELLED');
    });
  }
  edit(actor: string, id: string, creatorStake: number, matcherStake: number, oddsRatio?: string) {
    return this.run(s => {
      const o = this.offer(s, id);
      if (o.creatorId !== actor || o.status !== 'OPEN') throw Error('Only the owner can edit an open offer');
      positive(creatorStake);
      positive(matcherStake);
      if (creatorStake < o.creatorStake) throw Error('Stake can only increase');
      const increased = creatorStake > o.creatorStake;
      const next = quote(creatorStake);
      if (creatorStake === o.creatorStake) next.deposit = o.deposit;
      const hold = creatorStake + next.deposit - o.creatorStake - o.deposit;
      const fee = creatorStake === o.creatorStake ? 0 : Math.max(0, next.fee - o.fee);
      this.entry(s, actor, -hold, hold, next.deposit - o.deposit, 'Offer reservation updated', id);
      if (fee) this.entry(s, actor, -fee, 0, 0, 'Additional nonrefundable commission', id, undefined, fee);
      o.creatorStake = creatorStake;
      o.matcherStake = matcherStake;
      o.ratioCreator = creatorStake;
      o.ratioMatcher = matcherStake;
      o.oddsRatio = oddsRatio;
      o.deposit = next.deposit;
      o.fee += fee;
      if (increased) this.offerEvent(s, o, actor, 'raised');
      return o;
    });
  }
  private settle(s: State, o: Offer, m: Match, outcome: Outcome) {
    if (m.status === 'SETTLED') return;
    if (outcome === 'NULL' && !o.tie) throw Error('Tie is not enabled');
    for (const [user, stake, gfd, wins] of [[m.creatorId, m.creatorStake, m.creatorDeposit, outcome === 'TRUE'], [m.matcherId, m.matcherStake, m.matcherDeposit, outcome === 'FALSE']] as const) {
      const payout = gfd + (outcome === 'NULL' ? stake : wins ? m.creatorStake + m.matcherStake : 0);
      this.entry(s, user, payout, -stake - gfd, -gfd, `Settlement: ${outcome}`, o.id, m.id);
      this.notice(s, user, o.id, `Offer settled: ${outcome}. Credited ${dollars(payout)}.`);
    }
    m.status = o.status = 'SETTLED';
    m.outcome = outcome;
  }
  confirm(actor: string, id: string, outcome: Outcome) {
    return this.run(s => {
      const {
        o,
        m
      } = this.getMatch(s, id);
      if (actor !== m.creatorId && actor !== m.matcherId) throw Error('Only participants may confirm');
      if (!['TRUE', 'FALSE', 'NULL'].includes(outcome) || outcome === 'NULL' && !o.tie) throw Error('Invalid outcome');
      if (m.status === 'SETTLED') return o;
      if (m.status !== 'MATCHED') throw Error('Match cannot accept results');
      const key = actor === m.creatorId ? 'creatorOutcome' : 'matcherOutcome';
      if (m[key] && m[key] !== outcome) throw Error('Result already submitted');
      m[key] = outcome;
      if (m.creatorOutcome && m.matcherOutcome) {
        if (m.creatorOutcome === m.matcherOutcome) this.settle(s, o, m, outcome);else {
          m.status = o.status = 'DISPUTED';
          for (const user of [m.creatorId, m.matcherId]) this.notice(s, user, id, 'Disputed: funds remain held. Open local demo resolution.');
        }
      } else this.notice(s, actor === m.creatorId ? m.matcherId : m.creatorId, id, 'Opponent submitted a result. Please confirm.');
      return o;
    });
  }
  resolve(actor: string, id: string, outcome: Outcome) {
    return this.run(s => {
      const {
        o,
        m
      } = this.getMatch(s, id);
      if (actor !== m.creatorId && actor !== m.matcherId) throw Error('Only participants can resolve this demo');
      if (m.status !== 'DISPUTED') throw Error('Offer is not disputed');
      if (!['TRUE', 'FALSE', 'NULL'].includes(outcome)) throw Error('Invalid outcome');
      this.settle(s, o, m, outcome);
      return o;
    });
  }
  private deadlines(s: State) {
    for (const m of s.matches) if (m.status === 'MATCHED_PENDING_ACCEPT' && m.deadline <= this.clock()) this.accept(s, this.offer(s, m.offerId), m);
    for (const o of s.offers) if (o.status === 'OPEN' && o.expires !== undefined && o.expires <= this.clock()) this.release(s, o, 'EXPIRED');
  }
  funds(actor: string, value: number, withdraw = false, key?: string) {
    return this.run(s => {
      positive(value);
      this.entry(s, actor, withdraw ? -value : value, 0, 0, withdraw ? 'Simulated withdrawal' : 'Simulated deposit');
    }, key && `${actor}:funds:${key}`);
  }
  preferences(actor: string, values: Partial<Pick<Account, 'notifications' | 'location'>>) {
    return this.run(s => {
      const a = this.account(s, actor);
      for (const key of ['notifications', 'location'] as const) {
        if (values[key] !== undefined) {
          if (typeof values[key] !== 'boolean') throw Error('Invalid preference');
          a[key] = values[key];
        }
      }
    });
  }
  readNotice(actor: string, id: string) {
    return this.run(s => {
      const n = s.notices.find(n => n.id === id && n.userId === actor);
      if (!n) throw Error('Notification unavailable');
      n.read = true;
    });
  }
  report(actor: string, kind: string, text: string, offerId?: string) {
    return this.run(s => {
      this.account(s, actor);
      if (!text.trim()) throw Error('Enter a description');
      if (offerId) this.offer(s, offerId);
      const r: Report = {
        id: this.id(s, 'report'),
        userId: actor,
        kind,
        text: text.trim(),
        offerId,
        at: this.clock()
      };
      s.reports.push(r);
      return r;
    });
  }
}
export function wallet(s: State, userId: string) {
  const a = s.accounts.find(a => a.id === userId);
  const es = s.entries.filter(e => e.userId === userId);
  return {
    available: a?.available || 0,
    hold: es.reduce((n, e) => n + e.holdDelta, 0),
    deposit: es.reduce((n, e) => n + e.depositDelta, 0)
  };
}
export const ODDS = ['1:1', '1:2', '2:1', '1.5:1', '1:1.5', '3:1', '1:3'] as const;
export function stakeForOdds(stake: number, odds: string) {
  positive(stake);
  if (!(ODDS as readonly string[]).includes(odds)) throw Error('Invalid odds');
  const [a, b] = odds.split(':').map(Number);
  const result = roundRatio(stake, b * 10, a * 10);
  positive(result);
  return result;
}
export function opposingStake(o: Offer, stake: number) {
  positive(stake);
  const n = roundRatio(stake, o.ratioCreator ?? o.creatorStake, o.ratioMatcher ?? o.matcherStake);
  positive(n);
  return n;
}
export function positions(s: State, userId: string) {
  return s.offers.filter(o => o.creatorId === userId || s.matches.some(m => m.offerId === o.id && m.matcherId === userId));
}
export function reservations(s: State, userId: string) {
  const groups = new Map<string, {
    offerId: string;
    hold: number;
    deposit: number;
  }>();
  for (const e of s.entries.filter(e => e.userId === userId && e.offerId)) {
    const g = groups.get(e.offerId!) || {
      offerId: e.offerId!,
      hold: 0,
      deposit: 0
    };
    g.hold += e.holdDelta;
    g.deposit += e.depositDelta;
    groups.set(g.offerId, g);
  }
  return [...groups.values()].filter(g => g.hold !== 0);
}
