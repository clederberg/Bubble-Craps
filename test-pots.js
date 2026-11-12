/* Purim Pots: the maths, checked. The return is the headline number, but the
   structural checks are what catch a broken bonus, since a return can come out
   right while a feature quietly pays the wrong thing. */
const S = require('./slots.js');
const P = require('./pots.js');
const assert = require('assert');
let n = 0;
const eq = (a, b, m) => { n++; assert.deepStrictEqual(a, b, m); };
const ok = (c, m) => { n++; assert.ok(c, m); };

const g = P.game();
const lineBet = 100, totalBet = g.lineCount * lineBet;
const seeds = [{ x: 0, y: 0 }, { x: 2, y: 1 }, { x: 4, y: 2 }];

/* ---- shape ---- */
eq(g.lines.length, 20, 'twenty lines');
eq(g.reels.length, 5, 'five reels');
eq(g.cols * g.rows, 15, 'a tray is fifteen cells');
ok(g.order.every(k => g.symbols[k] && g.pays[k]), 'every paying symbol has art and a pay table');
g.potSyms.forEach(k => ok(g.order.indexOf(k) < 0, k + ' is a pot, so it pays no lines'));
g.order.forEach(k => ok(g.pays[k][5] > g.pays[k][4] && g.pays[k][4] > g.pays[k][3], k + ' pays more for more of them'));
for (let i = 1; i < g.order.length; i++) {
  ok(g.pays[g.order[i - 1]][5] >= g.pays[g.order[i]][5], g.order[i - 1] + ' pays at least ' + g.order[i]);
}
eq(g.pots.map(p => p.key), ['poppy', 'apricot', 'chocolate'], 'three pots');
eq(g.pots.map(p => p.effect), ['spin', 'twin', 'boost'], 'an extra respin, a second tray, and the drop');

/* ---- closing a pot ---- */
{
  /* three of one pot closes it; two does not */
  const grid = [['POPPY', 'MEM', 'MEM'], ['POPPY', 'MEM', 'MEM'], ['MEM', 'MEM', 'MEM'], ['MEM', 'MEM', 'MEM'], ['MEM', 'MEM', 'MEM']];
  eq(P.potsOn(g, grid).keys, [], 'two of a pot closes nothing');
  grid[2][0] = 'POPPY';
  const p3 = P.potsOn(g, grid);
  eq(p3.keys, ['poppy'], 'three of a pot closes it');
  eq(p3.spots.length, 3, 'and all three go on to the tray');
  eq(p3.seen.poppy, 3, 'the strip reports how many landed');
  /* two pots at once close together */
  grid[3][0] = 'APRICOT'; grid[3][1] = 'APRICOT'; grid[4][0] = 'APRICOT';
  eq(P.potsOn(g, grid).keys.sort(), ['apricot', 'poppy'], 'two pots can close on one spin');
}

/* ---- what each pot does ---- */
{
  const plain = P.holdRound(g, totalBet, { mods: ['chocolate'], seeds }, null);
  eq(plain.respinBase, g.hold.respins, 'the base is three respins');
  eq(P.holdRound(g, totalBet, { mods: ['poppy'], seeds }, null).respinBase, g.hold.respins + 1,
    'the poppy pot adds one');
  eq(P.holdRound(g, totalBet, { mods: ['apricot'], seeds }, null).trays, 2, 'the apricot pot opens a second tray');
  eq(P.holdRound(g, totalBet, { mods: ['poppy'], seeds }, null).trays, 1, 'the others play one');
  /* The chocolate drop carries a value and adds it to everything already on
     the tray. Only steps where the drop was the one thing that happened are
     compared, since anything landing after it is not "already there". */
  let seenDrop = 0;
  for (let i = 0; i < 4000 && seenDrop < 60; i++) {
    const r = P.holdRound(g, totalBet, { mods: ['chocolate'], seeds }, null);
    r.steps.forEach((st, k) => {
      const drops = (st.drops || []).filter(d => d.drizzle);
      if (drops.length !== 1 || (st.drops || []).length !== 1 || (st.orders || []).length) return;
      const d = drops[0];
      const before = r.steps[k - 1].trays[d.tray].cells;
      const after = st.trays[d.tray].cells;
      const add = d.value.amount;
      let lifted = 0;
      before.forEach((v, idx) => {
        if (!v || v.jackpot || !after[idx]) return;
        eq(after[idx].amount, v.amount + add, 'the drop adds its own value to every hamantasch already there');
        lifted++;
      });
      if (lifted) seenDrop++;
    });
  }
  ok(seenDrop > 0, 'the chocolate drop turns up');
}

/* ---- the collect ---- */
{
  /* Every order up has to be a column that really was full, has to empty it,
     and has to pay exactly what was in it. */
  let checked = 0;
  for (let i = 0; i < 1500 && checked < 200; i++) {
    const r = P.holdRound(g, totalBet, { mods: ['poppy'], seeds }, null);
    r.steps.forEach((st, k) => {
      (st.orders || []).forEach(o => {
        checked++;
        const after = st.trays[o.tray].cells;
        for (let row = 0; row < g.rows; row++) {
          eq(after[o.col * g.rows + row], null, 'the column is empty once it is collected');
        }
        ok(o.amount > 0, 'and it paid something');
      });
    });
  }
  ok(checked > 0, 'columns do get collected');
}
/* A letter lights the first time its own column goes, and only then. */
{
  let twice = 0;
  for (let i = 0; i < 4000 && twice < 30; i++) {
    const r = P.holdRound(g, totalBet, { mods: ['poppy'], seeds }, null);
    const seen = {};
    r.steps.forEach(st => (st.orders || []).forEach(o => {
      const key = o.tray + ':' + o.col;
      if (seen[key]) { twice++; eq(o.letter, null, 'a column collected again lights no new letter'); }
      else { seen[key] = 1; ok(!!o.letter, 'the first collect on a column lights its letter'); }
    }));
  }
  ok(twice > 0, 'a column can be filled more than once in a round');
}

/* ---- the money adds up ---- */
{
  /* collected columns + whatever is left on the trays + any Grand, and nothing
     else. If this drifts, a prize is being paid twice or dropped. */
  for (let i = 0; i < 4000; i++) {
    const mods = [['poppy'], ['apricot'], ['chocolate'], ['poppy', 'apricot', 'chocolate']][i % 4];
    const r = P.holdRound(g, totalBet, { mods, seeds }, null);
    const collected = r.steps.reduce((a, st) => a + (st.orders || []).reduce((x, o) => x + o.amount, 0), 0);
    eq(r.total, collected + r.left + r.grand, 'the round pays its orders, its leftovers and its Grand, and nothing else');
  }
}
/* Leftovers really are paid: a round that completes no column still pays. */
{
  let none = 0, paid = 0;
  for (let i = 0; i < 6000; i++) {
    const r = P.holdRound(g, totalBet, { mods: ['chocolate'], seeds }, null);
    if (r.orders === 0) { none++; if (r.total > 0) paid++; }
  }
  ok(none > 0, 'some rounds finish no column at all');
  eq(none, paid, 'and every one of them still pays what was left on the tray');
}
/* The Grand needs all five letters. */
{
  let grands = 0, rounds = 0;
  for (let i = 0; i < 40000; i++) {
    const r = P.holdRound(g, totalBet, { mods: ['poppy'], seeds }, null);
    rounds++;
    if (r.grand) { grands++; ok(Math.max.apply(null, r.lit) === 5, 'a Grand means a tray lit all five letters'); }
  }
  ok(grands > 0 && grands < rounds / 80, 'the Grand is reachable and rare (1 in ' + Math.round(rounds / grands) + ' rounds)');
}

/* ---- buying one ---- */
{
  g.buy.forEach(b => {
    const r = P.buyFeature(g, b.key, lineBet, null);
    ok(!!r.hold, 'buying ' + b.key + ' runs a bonus');
    ok(r.pots.keys.length > 0, 'off a board that really shows a closed pot');
    if (b.key !== 'any') ok(r.hold.mods.indexOf(b.key) >= 0, 'and the pot that was bought is in play');
    ok(r.total >= r.lineTotal, 'the trigger board still pays its own lines');
  });
}

/* ---- the long run ---- */
{
  const N = 400000;
  let bet = 0, won = 0, sq = 0, hits = 0, zero = 0;
  const closed = { poppy: 0, apricot: 0, chocolate: 0 };
  for (let i = 0; i < N; i++) {
    const r = P.play(g, lineBet, null);
    bet += totalBet; won += r.total; sq += (r.total / totalBet) ** 2;
    if (r.hold) {
      hits++;
      if (!r.hold.total) zero++;
      r.hold.mods.forEach(k => closed[k]++);
    }
  }
  const rtp = won / bet, se = Math.sqrt(sq / N - rtp * rtp) / Math.sqrt(N);
  ok(rtp > 0.92 && rtp < 0.98, 'the game returns about 95% at the seed jackpots (got '
    + (100 * rtp).toFixed(2) + '% +/- ' + (100 * se).toFixed(2) + ')');
  const rate = N / hits;
  ok(rate > 60 && rate < 95, 'the bonus comes about every 77 spins (got ' + Math.round(rate) + ')');
  eq(zero, 0, 'and no bonus pays nothing, because the leftovers are paid');
  /* the three pots should close at about the same rate as each other */
  const lo = Math.min(closed.poppy, closed.apricot, closed.chocolate);
  const hi = Math.max(closed.poppy, closed.apricot, closed.chocolate);
  ok(hi / lo < 1.15, 'the three pots close about equally often');
  console.log('  return ' + (100 * rtp).toFixed(2) + '% over ' + N.toLocaleString() + ' spins'
    + ' | bonus 1 in ' + Math.round(rate) + ' spins');
}

/* ---- buying is priced honestly ---- */
{
  g.buy.forEach(b => {
    const M = b.key === 'any' ? 4000 : 1800;
    let tot = 0;
    for (let i = 0; i < M; i++) tot += P.buyFeature(g, b.key, lineBet, null).total;
    const ev = tot / M / totalBet;
    ok(ev / b.price > 0.82 && ev / b.price < 1.08,
      'buying the ' + b.key + ' bonus returns about what waiting for it does (got '
      + (100 * ev / b.price).toFixed(0) + '%)');
  });
}

console.log('all passed', n, 'asserts');
