const {
  test
} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, path) => module._compile(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  }
}).outputText, path);
const {
  DemoEngine,
  wallet
} = require('../src/domain/demo.ts');
const {
  ApiClient,
  toCents,
  matchQuote,
  opposingOfferQuote,
  projectOffer,
  projectTransactions
} = require('../src/services/api/adapter.ts');
const {
  getOfferPerspective
} = require('../src/models/OfferUtils.ts');
const A = 'dev_user_1',
  B = 'dev_user_2';
function setup() {
  let raw = null,
    now = Date.now();
  const store = {
    load: async () => raw,
    save: async v => raw = v
  };
  const engine = new DemoEngine(store, () => now);
  return {
    engine,
    api: new ApiClient(engine),
    restart: () => new DemoEngine(store, () => now),
    advance: ms => now += ms
  };
}
const draft = (extra = {}) => ({
  creatorUserId: A,
  propositionText: 'Home wins',
  trueSituationText: 'Home wins',
  falseSituationText: 'Away wins',
  nullSituationText: 'Cancelled',
  postTitle: 'My crafted title',
  stakeCreator: 25,
  stakeB: 50,
  oddsRatio: '1:2',
  stakeMatcherMax: 50,
  remainingStakeMatcher: 50,
  status: 'OPEN',
  distanceMeters: 150,
  ...extra
});
async function create(h, extra = {}) {
  await h.engine.switchAccount(A);
  return h.api.createOffer(draft(extra));
}
test('adapter rejects nonfinite, fractional-cent and negative inputs without minting funds', async () => {
  for (const value of [-1, NaN, Infinity, 1.001, 0]) assert.throws(() => toCents(value));
  assert.equal(toCents(10.01), 1001);
  const h = setup();
  await h.engine.switchAccount(A);
  const before = await h.engine.snapshot();
  await assert.rejects(h.api.addFunds(-10));
  await assert.rejects(h.api.createOffer(draft({
    stakeCreator: 1.001
  })));
  assert.deepEqual(await h.engine.snapshot(), before);
});
test('original offer fields, selected odds and crafted title persist through restart', async () => {
  const h = setup();
  const o = await create(h, {
    stakeCreator: 10.01,
    stakeB: 3.34,
    oddsRatio: 'CUSTOM'
  });
  const restored = new ApiClient(h.restart());
  const p = await restored.getOfferById(o.offerId);
  assert.equal(p.postTitle, 'My crafted title');
  assert.equal(p.oddsRatio, 'CUSTOM');
  assert.equal(p.stakeCreator, 10.01);
  assert.equal(p.stakeB, 3.34);
  assert.equal(p.goodFaithDeposit, 2);
});
test('existing v1 snapshot without presentation metadata is readable without resetting money or history', async () => {
  const h = setup();
  await h.engine.switchAccount(A);
  const before = await h.engine.snapshot();
  const api = new ApiClient(h.restart());
  const offers = await api.getOffers();
  assert.equal(offers.length, before.offers.length);
  assert.equal(offers.find(o => o.creatorUserId === B).oddsRatio, '1:2');
  assert.deepEqual(await h.restart().snapshot(), before);
});
test('full and partial quotes agree with committed unequal allocations and perspectives', async () => {
  const h = setup();
  const o = await create(h);
  assert.equal(matchQuote(o, 50).prize, 75);
  assert.equal(matchQuote(o, 10).creatorStake, 5);
  assert.equal(getOfferPerspective(o, A).viewerWinText, 'Home wins');
  assert.equal(getOfferPerspective(o, B).viewerWinText, 'Away wins');
  await h.engine.switchAccount(B);
  const {
    matchedOffer
  } = await h.api.matchOffer(o.offerId, 10, 'partial');
  assert.equal(matchedOffer.stakeCreator, 5);
  assert.equal(matchedOffer.viewerStake, 10);
  assert.equal(matchedOffer.viewerDeposit, 2);
  assert.equal(matchedOffer.viewerHold, 12);
  assert.equal(matchedOffer.viewerCommission, .28);
});
test('wallet breakdowns include both participants and disputed holds, then show zero on resolution', async () => {
  const h = setup();
  const o = await create(h);
  await h.engine.switchAccount(B);
  await h.api.matchOffer(o.offerId, 50);
  await h.engine.switchAccount(A);
  await h.api.acceptMatch(o.offerId);
  await h.api.confirmResult(o.offerId, 'TRUE', A);
  await h.engine.switchAccount(B);
  await h.api.confirmResult(o.offerId, 'FALSE', B);
  assert.equal((await h.api.getReservationOffers()).find(x => x.offerId === o.offerId).viewerHold, 60);
  await h.api.settleOffer(o.offerId, 'FALSE', B);
  assert.equal((await h.api.getReservationOffers()).find(x => x.offerId === o.offerId), undefined);
  await h.engine.switchAccount(A);
  assert.equal((await h.api.getReservationOffers()).find(x => x.offerId === o.offerId), undefined);
});
test('ledger rows use exact offer and match references even when timestamps coincide', async () => {
  const h = setup();
  const first = await create(h);
  const second = await h.api.createOffer(draft({
    postTitle: 'Second'
  }));
  const rows = await h.api.getTransactions();
  const holds = rows.filter(t => t.type === 'hold' && [first.offerId, second.offerId].includes(t.offerId));
  assert.equal(holds.length, 2);
  assert.equal(new Set(holds.map(t => t.offerId)).size, 2);
  for (const t of holds) {
    assert.equal(t.userId, A);
    assert.equal(t.stakeAmount, 25);
    assert.equal(t.depositAmount, 5);
    assert.equal(t.holdDelta, 30);
  }
  await h.engine.switchAccount(B);
  await h.api.matchOffer(first.offerId, 50);
  const own = (await h.api.getTransactions()).find(t => t.offerId === first.offerId && t.type === 'hold');
  assert.ok(own.matchId);
  assert.equal(own.stakeAmount, 50);
  assert.equal(own.depositAmount, 10);
});
test('open match-and-raise honors custom odds atomically and repeated request does not create another offer', async () => {
  const h = setup();
  const o = await create(h);
  await h.engine.switchAccount(B);
  const r = await h.api.matchAndRaise(o.offerId, 50, 10, 37.51, 'CUSTOM', 'once');
  assert.equal(r.raisedOffer.stakeB, 37.51);
  assert.equal(r.raisedOffer.oddsRatio, 'CUSTOM');
  h.advance(20000);
  await h.engine.snapshot();
  const before = await h.engine.snapshot();
  const replay = await h.api.matchAndRaise(o.offerId, 50, 10, 37.51, 'CUSTOM', 'once');
  assert.equal(replay.raisedOffer.offerId, r.raisedOffer.offerId);
  assert.deepEqual(await h.engine.snapshot(), before);
});
for (const actor of [A, B]) test(`active Raise creates separate funded offer on ${actor}'s side`, async () => {
  const h = setup();
  const o = await create(h);
  await h.engine.switchAccount(B);
  await h.api.matchOffer(o.offerId, 50);
  await h.engine.switchAccount(A);
  await h.api.acceptMatch(o.offerId);
  await h.engine.switchAccount(actor);
  const before = await h.engine.snapshot();
  const r = await h.api.matchAndRaise(o.offerId, 0, 10, 30, '1:3', 'raise', true);
  const after = await h.engine.snapshot();
  assert.deepEqual(after.matches, before.matches);
  assert.deepEqual(after.offers.find(x => x.id === o.offerId), before.offers.find(x => x.id === o.offerId));
  assert.equal(r.raisedOffer.trueSituationText, actor === A ? 'Home wins' : 'Away wins');
  assert.equal(r.raisedOffer.falseSituationText, actor === A ? 'Away wins' : 'Home wins');
  assert.equal(r.raisedOffer.parentOfferId, o.offerId);
  assert.equal(wallet(before, actor).available - wallet(after, actor).available, 1228);
  const replay = await h.api.matchAndRaise(o.offerId, 0, 10, 30, '1:3', 'raise', true);
  assert.equal(replay.raisedOffer.offerId, r.raisedOffer.offerId);
});
test('failed linked raise leaves original wager and ledger unchanged; outsider cannot raise it', async () => {
  const h = setup();
  const o = await create(h);
  await h.engine.switchAccount(B);
  await h.api.matchOffer(o.offerId, 50);
  await h.engine.switchAccount(A);
  await h.api.acceptMatch(o.offerId);
  const before = await h.engine.snapshot();
  await assert.rejects(h.api.matchAndRaise(o.offerId, 0, 1000000, 1000000, '1:1', 'bad', true));
  assert.deepEqual(await h.engine.snapshot(), before);
  const outsider = await h.engine.register('outsider', true);
  await assert.rejects(h.api.matchAndRaise(o.offerId, 0, 10, 10, '1:1', 'other', true));
});
test('bet against preview and committed stakes agree', async () => {
  const h = setup();
  const o = await create(h);
  assert.equal(opposingOfferQuote(o, 10).opponentStake, 5);
  await h.engine.switchAccount(B);
  const r = await h.api.betAgainst(o.offerId, 10);
  assert.equal(r.stakeB, 5);
  assert.equal(r.trueSituationText, o.falseSituationText);
});
test('account transaction and notification feeds remain isolated', async () => {
  const h = setup();
  const o = await create(h);
  await h.engine.switchAccount(B);
  assert.ok((await h.api.getTransactions()).every(t => t.userId === B));
  assert.equal((await h.api.getNotifications()).some(n => n.offerId === o.offerId), false);
  await h.api.matchOffer(o.offerId, 50);
  await h.engine.switchAccount(A);
  assert.ok((await h.api.getNotifications()).some(n => n.offerId === o.offerId && n.type === 'offer_matched'));
  await assert.rejects(h.api.confirmResult(o.offerId, 'TRUE', B));
});
test('odds-only edits preserve an allocated deposit and never double-charge it', async () => {
  const h = setup();
  const o = await create(h);
  await h.engine.switchAccount(B);
  const p = (await h.api.matchOffer(o.offerId, 10)).matchedOffer;
  await h.engine.switchAccount(A);
  await h.api.rejectMatch(p.offerId);
  const before = wallet(await h.engine.snapshot(), A);
  await h.api.updateOfferOdds(p.offerId, 'CUSTOM', 20);
  assert.deepEqual(wallet(await h.engine.snapshot(), A), before);
});
test('support/contact saved by original form adapter persist with reference IDs', async () => {
  const h = setup();
  await h.engine.switchAccount(A);
  const r = await h.api.saveReport('contact', 'A message');
  const s = await h.restart().snapshot();
  assert.equal(s.reports.find(x => x.id === r.id).text, 'A message');
});

test('ecosystem migration appends funded samples once and preserves existing accounts and history', async () => {
  const h = setup();
  const fresh = await h.engine.snapshot();
  const old = structuredClone(fresh);
  old.accounts = old.accounts.filter(a => !a.id.startsWith('ecosystem_'));
  const sampleIds = old.offers.filter(o => o.creatorId.startsWith('ecosystem_')).map(o => o.id);
  old.offers = old.offers.filter(o => !sampleIds.includes(o.id));
  old.entries = old.entries.filter(e => !e.userId.startsWith('ecosystem_'));
  old.notices = old.notices.filter(n => !n.userId.startsWith('ecosystem_'));
  delete old.ecosystemVersion;
  let raw = JSON.stringify(old);
  const store = {load: async () => raw, save: async value => { raw = value; }};
  const engine = new DemoEngine(store);
  const next = await engine.snapshot();
  assert.deepEqual(next.accounts.slice(0, old.accounts.length), old.accounts);
  assert.deepEqual(next.offers.slice(0, old.offers.length), old.offers);
  assert.deepEqual(next.entries.slice(0, old.entries.length), old.entries);
  assert.equal(next.offers.filter(o => o.creatorId.startsWith('ecosystem_')).length, 6);
  for (const account of next.accounts.filter(a => a.id.startsWith('ecosystem_'))) {
    assert.equal(next.entries.filter(e => e.userId === account.id).reduce((sum,e) => sum+e.availableDelta,0), account.available);
    assert.equal(next.offers.filter(o => o.creatorId === account.id).length, 2);
  }
  assert.deepEqual(await new DemoEngine(store).snapshot(), next);
});

test('unlimited offers survive time passing while a selected finite expiry refunds holds', async () => {
  const h = setup();
  const forever = await create(h);
  const finite = await h.api.createOffer(draft({expiryDate: new Date(Date.now()+1200000).toISOString()}));
  h.advance(1201000);
  const s = await h.engine.snapshot();
  assert.equal(s.offers.find(o=>o.id===forever.offerId).status, 'OPEN');
  assert.equal(s.offers.find(o=>o.id===finite.offerId).status, 'EXPIRED');
});

test('all six ecosystem offers are manually matchable and settle with exact ledger reconciliation', async () => {
  const h=setup();
  await h.engine.switchAccount(A);
  const samples=(await h.api.getOffers()).filter(o=>o.isSample);
  assert.equal(samples.length,6);
  for (const o of samples) {
    assert.ok(o.creatorName);
    await h.engine.switchAccount(A);
    await h.api.matchOffer(o.offerId,o.remainingStakeMatcher);
    await h.engine.switchAccount(o.creatorUserId);
    await h.api.acceptMatch(o.offerId);
    await h.api.confirmResult(o.offerId,'FALSE',o.creatorUserId);
    await h.engine.switchAccount(A);
    await h.api.confirmResult(o.offerId,'FALSE',A);
    assert.equal((await h.api.getOfferById(o.offerId)).status,'SETTLED');
    assert.ok(!(await h.api.getReservationOffers()).some(r=>r.offerId===o.offerId));
  }
  const s=await h.restart().snapshot();
  for (const a of s.accounts) assert.equal(a.available,s.entries.filter(e=>e.userId===a.id).reduce((n,e)=>n+e.availableDelta,0));
});

test('remaining feed quote after partial matching uses only remaining exposure', async () => {
  const h=setup();
  const o=await create(h);
  await h.engine.switchAccount(B);
  await h.api.matchOffer(o.offerId,10,'partial');
  const remaining=await h.api.getOfferById(o.offerId);
  assert.equal(remaining.remainingStakeMatcher,40);
  assert.equal(matchQuote(remaining,remaining.remainingStakeMatcher).creatorStake,20);
});

const { offerPreview } = require('../src/services/api/adapter.ts');
for (const opponentStake of [100, 200]) test(`Owner/Public preview keeps identity and reverses outcomes for $100 versus $${opponentStake}`, async () => {
  const h = setup();
  const o = await create(h, {stakeCreator:100, stakeB:opponentStake, stakeMatcherMax:opponentStake, remainingStakeMatcher:opponentStake, oddsRatio:opponentStake===100?'1:1':'1:2', trueSituationText:'Blue wins',falseSituationText:'Red wins'});
  const before = await h.engine.snapshot();
  for (const publicMode of [false,true,false,true,false]) {
    const p=offerPreview(o,A,publicMode);
    assert.equal(p.ownsOffer,true);
    assert.equal(p.isOwner,!publicMode);
    assert.equal(p.receive,100+opponentStake);
    assert.equal(p.lose,publicMode?opponentStake:100);
    assert.equal(p.viewerWinText,publicMode?'Red wins':'Blue wins');
    assert.equal(p.viewerLoseText,publicMode?'Blue wins':'Red wins');
    assert.equal(p.canMatch,false);
  }
  const publicView=offerPreview(o,B);
  assert.equal(publicView.isOwner,false);
  assert.equal(publicView.canMatch,true);
  assert.equal(publicView.lose,opponentStake);
  assert.equal(publicView.viewerWinText,'Red wins');
  assert.equal(offerPreview(o,B,true).isOwner,false);
  assert.equal(offerPreview(o,null).canMatch,false);
  assert.deepEqual(await h.engine.snapshot(),before);
  await assert.rejects(h.api.matchOffer(o.offerId,opponentStake));
  assert.deepEqual(await h.engine.snapshot(),before);
});

test('Owner/Public preview after a partial match quotes the remaining allocation', async () => {
  const h=setup();
  const o=await create(h);
  await h.engine.switchAccount(B);
  await h.api.matchOffer(o.offerId,10,'partial');
  const remaining=await h.api.getOfferById(o.offerId);
  const owner=offerPreview(remaining,A);
  const viewer=offerPreview(remaining,A,true);
  assert.equal(owner.receive,60);
  assert.equal(viewer.receive,60);
  assert.equal(owner.lose,20);
  assert.equal(viewer.lose,40);
});

for (const active of [false,true]) test(`${active?'active Raise':'Match & Raise'} notifies related participants once and matches the linked offer`, async () => {
  const h=setup(); const o=await create(h);
  await h.engine.switchAccount(B);
  if(active){await h.api.matchOffer(o.offerId,50);await h.engine.switchAccount(A);await h.api.acceptMatch(o.offerId);await h.engine.switchAccount(B);}
  const r=await h.api.matchAndRaise(o.offerId,active?0:50,10,20,'1:2','notify-once',active);
  const snapshot=await h.engine.snapshot();
  const events=snapshot.notices.filter(n=>n.kind==='raised');
  assert.equal(events.length,1);assert.equal(events[0].userId,A);
  assert.equal(events[0].offerId,r.raisedOffer.offerId);assert.equal(events[0].sourceOfferId,o.offerId);
  await h.api.matchAndRaise(o.offerId,active?0:50,10,20,'1:2','notify-once',active);
  assert.deepEqual(await h.engine.snapshot(),snapshot);
  await h.engine.switchAccount(A);
  const notice=(await h.api.getNotifications()).find(n=>n.id===events[0].id);
  assert.equal(notice.type,'offer_raised');assert.match(notice.title,/BoxDaddy raised/);
  assert.match(notice.message,/Odds 1:2/);assert.equal(notice.canMatch,true);
  assert.equal(await h.api.getNotificationMatch(notice.id),r.raisedOffer.offerId);
  await h.engine.switchAccount(B);await assert.rejects(h.api.getNotificationMatch(notice.id));
  await h.api.refundOffer(r.raisedOffer.offerId);
  await h.engine.switchAccount(A);
  assert.equal((await h.api.getNotifications()).find(n=>n.id===notice.id).canMatch,false);
  await assert.rejects(h.api.getNotificationMatch(notice.id));
});

test('open increase notifies partial-match participants without duplicates or unrelated accounts', async () => {
  const h=setup();const o=await create(h);
  await h.engine.switchAccount(B);await h.api.matchOffer(o.offerId,10,'slice-one');await h.api.matchOffer(o.offerId,10,'slice-two');
  await h.engine.switchAccount(A);await h.api.raiseOfferAmount(o.offerId,30);
  let events=(await h.engine.snapshot()).notices.filter(n=>n.kind==='raised');
  assert.equal(events.length,1);assert.equal(events[0].userId,B);assert.equal(events[0].offerId,o.offerId);
  await h.api.raiseOfferAmount(o.offerId,30);
  assert.equal((await h.engine.snapshot()).notices.filter(n=>n.kind==='raised').length,1);
  await h.api.updateOfferOdds(o.offerId,'1:1',30);
  assert.equal((await h.engine.snapshot()).notices.filter(n=>n.kind==='raised').length,1);
  const before=await h.engine.snapshot();
  await assert.rejects(h.api.raiseOfferAmount(o.offerId,999999));
  assert.deepEqual(await h.engine.snapshot(),before);
});

test('posted notices identify their offer; Bet Against stays distinct; old notices remain readable', async () => {
  const h=setup();const o=await create(h);
  const posted=(await h.api.getNotifications()).find(n=>n.offerId===o.offerId);
  assert.match(posted.message,/My crafted title/);assert.ok(Date.parse(posted.createdAt));
  await h.engine.switchAccount(B);await h.api.betAgainst(o.offerId,10);
  assert.equal((await h.engine.snapshot()).notices.some(n=>n.kind==='raised'),false);
  const old=await h.engine.snapshot();
  old.notices=old.notices.map(({kind,actorId,sourceOfferId,offerTitle,actorName,creatorStake,matcherStake,...n})=>n);
  const engine=new DemoEngine({load:async()=>JSON.stringify(old),save:async()=>{}});
  const notices=await new ApiClient(engine).getNotifications();
  assert.ok(notices.length);assert.ok(notices.every(n=>n.message && n.createdAt));
  assert.deepEqual((await engine.snapshot()).entries,old.entries);
});
