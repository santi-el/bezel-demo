const {
  test
} = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const Module = require('node:module');
const compiled = ts.transpileModule(fs.readFileSync('src/domain/demo.ts', 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const mod = new Module('demo');
mod._compile(compiled, 'demo.cjs');
const {
  DemoEngine,
  amount,
  quote,
  allocation,
  ODDS,
  stakeForOdds,
  wallet,
  reservations
} = mod.exports;
const A = 'dev_user_1',
  B = 'dev_user_2';
const draft = (extra = {}) => ({
  creatorStake: 2500,
  matcherStake: 5000,
  yes: 'Home wins',
  no: 'Away wins',
  tie: 'Cancelled',
  minutes: -1,
  ...extra
});
function harness() {
  let raw = null,
    now = 100000,
    fail = false;
  const storage = {
    load: async () => raw,
    save: async value => {
      if (fail) throw Error('disk full');
      raw = value;
    }
  };
  return {
    engine: new DemoEngine(storage, () => now),
    restart: () => new DemoEngine(storage, () => now),
    advance: ms => now += ms,
    fail: value => fail = value,
    raw: () => raw
  };
}
function conserved(s) {
  const sums = s.entries.reduce((a, e) => ({
    funds: a.funds + e.availableDelta + e.holdDelta + e.fee,
    available: a.available + e.availableDelta,
    hold: a.hold + e.holdDelta
  }), {
    funds: 0,
    available: 0,
    hold: 0
  });
  const external = s.entries.filter(e => !e.offerId).reduce((n, e) => n + e.availableDelta, 0);
  assert.equal(sums.funds, external);
  assert.equal(sums.available, s.accounts.reduce((n, a) => n + a.available, 0));
  for (const a of s.accounts) {
    const w = wallet(s, a.id);
    assert.ok(w.available >= 0);
    assert.ok(w.hold >= 0);
    assert.ok(w.deposit >= 0);
    assert.equal(w.hold, reservations(s, a.id).reduce((n, r) => n + r.hold, 0));
    for (const v of Object.values(w)) assert.ok(Number.isSafeInteger(v));
  }
}
async function match(h, extra = {}) {
  const o = await h.engine.createOffer(A, draft(extra));
  await h.engine.matchOffer(B, o.id, o.matcherStake);
  await h.engine.acceptMatch(A, o.id);
  return o;
}
test('money parsing rejects negatives, nonfinite, zero, excess decimals and unsafe values', () => {
  for (const v of ['-10', 'NaN', 'Infinity', '0', '1.234', '1e3', '1000001', '']) assert.throws(() => amount(v));
  assert.equal(amount('12.34'), 1234);
  assert.deepEqual(quote(1001), {
    stake: 1001,
    deposit: 200,
    fee: 28,
    hold: 1201,
    debit: 1229
  });
});
for (const odds of ODDS) test(`odds ${odds}: funded full match settles exactly`, async () => {
  const h = harness();
  const o = await match(h, {
    creatorStake: 3001,
    matcherStake: stakeForOdds(3001, odds)
  });
  await h.engine.confirm(A, o.id, 'TRUE');
  await h.engine.confirm(B, o.id, 'TRUE');
  const s = await h.engine.snapshot();
  assert.equal(reservations(s, A).find(r => r.offerId === o.id), undefined);
  assert.equal(reservations(s, B).find(r => r.offerId === o.id), undefined);
  conserved(s);
});
test('unequal full match debits advertised matcher stake and pays correct winner', async () => {
  const h = harness();
  const before = await h.engine.snapshot();
  const o = await match(h);
  await h.engine.confirm(A, o.id, 'FALSE');
  await h.engine.confirm(B, o.id, 'FALSE');
  const s = await h.engine.snapshot();
  assert.equal(wallet(s, A).available, wallet(before, A).available - 2500 - 70);
  assert.equal(wallet(s, B).available, wallet(before, B).available + 2500 - 140);
  conserved(s);
});
test('NULL refunds both stakes/deposits but never commissions', async () => {
  const h = harness();
  const before = await h.engine.snapshot();
  const o = await match(h);
  await h.engine.confirm(A, o.id, 'NULL');
  await h.engine.confirm(B, o.id, 'NULL');
  const s = await h.engine.snapshot();
  assert.equal(wallet(s, A).available, wallet(before, A).available - 70);
  assert.equal(wallet(s, B).available, wallet(before, B).available - 140);
  conserved(s);
});
test('partial matching transfers reservations, preserves original odds and releases all exposure', async () => {
  const h = harness();
  const o = await h.engine.createOffer(A, draft({
    creatorStake: 1001,
    matcherStake: 3000
  }));
  const first = await h.engine.matchOffer(B, o.id, 1000);
  const second = await h.engine.matchOffer(B, o.id, 1000);
  const final = await h.engine.matchOffer(B, o.id, 1000);
  assert.equal(first.creatorStake, 334);
  assert.equal(second.creatorStake, 334);
  assert.equal(final.creatorStake, 333);
  assert.equal(first.deposit + second.deposit + final.deposit, 200);
  for (const p of [first, second, final]) {
    await h.engine.acceptMatch(A, p.id);
    await h.engine.confirm(A, p.id, 'NULL');
    await h.engine.confirm(B, p.id, 'NULL');
  }
  conserved(await h.engine.snapshot());
});
test('invalid matcher amounts cannot change money', async () => {
  const h = harness();
  const o = await h.engine.createOffer(A, draft());
  const before = await h.engine.snapshot();
  for (const n of [-100, 0, NaN, Infinity, 1.3, 5001]) await assert.rejects(h.engine.matchOffer(B, o.id, n));
  assert.deepEqual(await h.engine.snapshot(), before);
});
test('match-and-raise is atomic on insufficient funds or invalid raise', async () => {
  const h = harness();
  const o = await h.engine.createOffer(A, draft());
  const before = await h.engine.snapshot();
  for (const stake of [10000000, -100]) await assert.rejects(h.engine.matchAndRaise(B, o.id, 5000, draft({
    creatorStake: stake
  })));
  assert.deepEqual(await h.engine.snapshot(), before);
});
test('match-and-raise preserves selected new-offer odds and opposing outcomes', async () => {
  const h = harness();
  const o = await h.engine.createOffer(A, draft());
  const {
    matched,
    raised
  } = await h.engine.matchAndRaise(B, o.id, 5000, draft({
    creatorStake: 2000,
    matcherStake: 9999
  }));
  assert.equal(matched.status, 'MATCHED_PENDING_ACCEPT');
  assert.equal(raised.matcherStake, 9999);
  assert.equal(raised.yes, o.no);
  assert.equal(raised.no, o.yes);
  conserved(await h.engine.snapshot());
});
test('opposing offer preserves source and inverse odds', async () => {
  const h = harness();
  const o = await h.engine.createOffer(A, draft());
  const r = await h.engine.betAgainst(B, o.id, 2000);
  assert.equal(r.matcherStake, 1000);
  assert.equal((await h.engine.snapshot()).offers.find(x => x.id === o.id).status, 'OPEN');
  conserved(await h.engine.snapshot());
});
test('unauthorized actions and self matching fail without state changes', async () => {
  const h = harness();
  const o = await h.engine.createOffer(A, draft());
  let before = await h.engine.snapshot();
  for (const op of [() => h.engine.matchOffer(A, o.id, 5000), () => h.engine.cancel(B, o.id), () => h.engine.edit(B, o.id, 3000, 6000), () => h.engine.matchOffer('missing', o.id, 5000)]) await assert.rejects(op());
  assert.deepEqual(await h.engine.snapshot(), before);
  await h.engine.matchOffer(B, o.id, 5000);
  before = await h.engine.snapshot();
  for (const op of [() => h.engine.acceptMatch(B, o.id), () => h.engine.rejectMatch(B, o.id), () => h.engine.confirm('missing', o.id, 'TRUE')]) await assert.rejects(op());
  assert.deepEqual(await h.engine.snapshot(), before);
});
test('repeated and concurrent submissions are idempotent with persistent operation keys', async () => {
  const h = harness();
  const [o, o2] = await Promise.all([h.engine.createOffer(A, draft(), 'create-1'), h.engine.createOffer(A, draft(), 'create-1')]);
  assert.equal(o.id, o2.id);
  const matches = await Promise.all([h.engine.matchOffer(B, o.id, 1000, 'tap'), h.engine.matchOffer(B, o.id, 1000, 'tap')]);
  assert.equal(matches[0].id, matches[1].id);
  const replay = await h.restart().matchOffer(B, o.id, 1000, 'tap');
  assert.equal(replay.id, matches[0].id);
  conserved(await h.engine.snapshot());
});
test('concurrent full matches reserve once', async () => {
  const h = harness();
  const o = await h.engine.createOffer(A, draft());
  const c = await h.engine.register('third_user');
  const results = await Promise.allSettled([h.engine.matchOffer(B, o.id, 5000), h.engine.matchOffer(c.id, o.id, 5000)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  conserved(await h.engine.snapshot());
});
test('settlement is idempotent including concurrent confirmations', async () => {
  const h = harness();
  const o = await match(h);
  await h.engine.confirm(A, o.id, 'TRUE');
  await Promise.all([h.engine.confirm(B, o.id, 'TRUE'), h.engine.confirm(B, o.id, 'TRUE')]);
  const before = await h.engine.snapshot();
  await h.restart().confirm(A, o.id, 'TRUE');
  assert.deepEqual(await h.restart().snapshot(), before);
  conserved(before);
});
test('rejection refunds exact matcher amount and deposit; cancellation counts deposit once', async () => {
  const h = harness();
  const o = await h.engine.createOffer(A, draft());
  const before = await h.engine.snapshot();
  const p = await h.engine.matchOffer(B, o.id, 1234);
  await h.engine.rejectMatch(A, p.id);
  const s = await h.engine.snapshot();
  assert.equal(wallet(s, B).available, wallet(before, B).available - quote(1234).fee);
  assert.equal(reservations(s, B).find(r => r.offerId === p.id), undefined);
  await h.engine.cancel(A, p.id);
  await h.engine.cancel(A, o.id);
  const after = await h.engine.snapshot();
  assert.equal(reservations(after, A).filter(r => [p.id, o.id].includes(r.offerId)).length, 0);
  conserved(after);
});
test('deadline survives restart; rejection at deadline cannot race acceptance', async () => {
  const h = harness();
  const o = await h.engine.createOffer(A, draft());
  await h.engine.matchOffer(B, o.id, 5000);
  h.advance(20000);
  const restarted = h.restart();
  await assert.rejects(restarted.rejectMatch(A, o.id));
  const s = await restarted.snapshot();
  assert.equal(s.offers.find(x => x.id === o.id).status, 'MATCHED');
  await restarted.acceptMatch(A, o.id);
  conserved(await restarted.snapshot());
});
test('rejection just before deadline wins and does not later accept', async () => {
  const h = harness();
  const o = await h.engine.createOffer(A, draft());
  await h.engine.matchOffer(B, o.id, 5000);
  h.advance(19999);
  await h.engine.rejectMatch(A, o.id);
  h.advance(1);
  assert.equal((await h.engine.snapshot()).offers.find(x => x.id === o.id).status, 'OPEN');
});
test('expiry releases unmatched funds and never expires a reserved match', async () => {
  const h = harness();
  const o = await h.engine.createOffer(A, draft({
    minutes: 1
  }));
  const p = await h.engine.matchOffer(B, o.id, 1000);
  h.advance(60000);
  const s = await h.restart().snapshot();
  assert.equal(s.offers.find(x => x.id === o.id).status, 'EXPIRED');
  assert.equal(s.offers.find(x => x.id === p.id).status, 'MATCHED');
  assert.equal(reservations(s, A).find(r => r.offerId === o.id), undefined);
  await assert.rejects(h.restart().matchOffer(B, o.id, 1000));
  conserved(s);
});
test('dispute holds funds; only participant can resolve; repeat cannot credit again', async () => {
  const h = harness();
  const o = await match(h);
  await h.engine.confirm(A, o.id, 'TRUE');
  const before = await h.engine.snapshot();
  await h.engine.confirm(B, o.id, 'FALSE');
  let s = await h.engine.snapshot();
  assert.equal(s.offers.find(x => x.id === o.id).status, 'DISPUTED');
  assert.equal(wallet(s, A).hold, wallet(before, A).hold);
  await assert.rejects(h.engine.resolve('missing', o.id, 'TRUE'));
  await h.engine.resolve(A, o.id, 'TRUE');
  s = await h.engine.snapshot();
  await assert.rejects(h.engine.resolve(B, o.id, 'FALSE'));
  assert.deepEqual(await h.engine.snapshot(), s);
  conserved(s);
});
test('accounts, session, notifications, preferences and reports persist and remain isolated', async () => {
  const h = harness();
  const a = await h.engine.register('new_demo');
  await h.engine.switchAccount(a.id);
  await h.engine.preferences(a.id, {
    notifications: false
  });
  const o = await h.engine.createOffer(a.id, draft());
  const r = await h.engine.report(a.id, 'support', 'Saved locally', o.id);
  const s = await h.restart().snapshot();
  assert.equal(s.sessionId, a.id);
  assert.equal(s.reports.find(x => x.id === r.id).text, 'Saved locally');
  assert.equal(s.notices.filter(n => n.userId === a.id).length, 0);
  const n = s.notices.find(n => n.userId === A);
  await assert.rejects(h.engine.readNotice(B, n.id));
  assert.equal(wallet(s, B).available, 121980);
  conserved(s);
});
test('failed persistence rolls back mutation and retry can succeed', async () => {
  const h = harness();
  const before = await h.engine.snapshot();
  h.fail(true);
  await assert.rejects(h.engine.createOffer(A, draft(), 'save'));
  h.fail(false);
  assert.deepEqual(await h.engine.snapshot(), before);
  await h.engine.createOffer(A, draft(), 'save');
  conserved(await h.engine.snapshot());
});
test('odds edits and increases only apply to open owner exposure', async () => {
  const h = harness();
  const o = await h.engine.createOffer(A, draft());
  await h.engine.edit(A, o.id, 2500, 7500);
  await h.engine.edit(A, o.id, 3000, 9000);
  await h.engine.matchOffer(B, o.id, 9000);
  await assert.rejects(h.engine.edit(A, o.id, 4000, 12000));
  conserved(await h.engine.snapshot());
});
test('tie disabled, changed confirmation, invalid outcome and empty draft are rejected', async () => {
  const h = harness();
  const o = await match(h, {
    tie: undefined
  });
  await assert.rejects(h.engine.confirm(A, o.id, 'NULL'));
  await assert.rejects(h.engine.confirm(A, o.id, 'BAD'));
  await h.engine.confirm(A, o.id, 'TRUE');
  await assert.rejects(h.engine.confirm(A, o.id, 'FALSE'));
  await assert.rejects(h.engine.createOffer(A, draft({
    yes: ' '
  })));
});
test('reset restores coherent seed balances, clears session, reports and operation keys', async () => {
  const h = harness();
  await h.engine.switchAccount(A);
  await h.engine.funds(A, 1000, false, 'fund');
  await h.engine.report(A, 'contact', 'hello');
  await h.engine.reset();
  const s = await h.restart().snapshot();
  assert.equal(s.sessionId, undefined);
  assert.equal(s.accounts.length, 5);
  assert.equal(s.reports.length, 0);
  assert.equal(s.operations, undefined);
  conserved(s);
});
test('insufficient create, match and withdrawal preserve exact ledger balances', async () => {
  const h=harness(); const o=await h.engine.createOffer(A,draft({matcherStake:1000000}));
  const before=await h.engine.snapshot();
  for(const work of [()=>h.engine.createOffer(B,draft({creatorStake:1000000})),()=>h.engine.matchOffer(B,o.id,1000000),()=>h.engine.funds(B,1000000,true)]) await assert.rejects(work());
  assert.deepEqual(await h.engine.snapshot(),before);
});
test('preferences cannot overwrite money and reject invalid types', async () => {
  const h=harness(); const before=wallet(await h.engine.snapshot(),A);
  await h.engine.preferences(A,{available:99999999});
  assert.deepEqual(wallet(await h.engine.snapshot(),A),before);
  await assert.rejects(h.engine.preferences(A,{notifications:'yes'}));
});
test('registration and selected account commit together, or neither on disk failure', async () => {
  const h=harness(); const before=await h.engine.snapshot(); h.fail(true);
  await assert.rejects(h.engine.register('atomic_account',true)); h.fail(false);
  assert.deepEqual(await h.engine.snapshot(),before);
  const account=await h.engine.register('atomic_account',true);
  assert.equal((await h.restart().snapshot()).sessionId,account.id);
});
