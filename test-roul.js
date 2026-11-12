/* Roulette: the wheels, the bet table, the payouts and the edge.
   Run with: node test-roul.js */
global.crypto = require('crypto').webcrypto;
const C = require('./common.js'), R = require('./roul.js'), assert = require('assert');
let n = 0;
const eq = (a, b, m) => { n++; assert.deepStrictEqual(a, b, m); };
const ok = (a, m) => { n++; assert.ok(a, m); };
const near = (a, b, tol, m) => { n++; assert.ok(Math.abs(a - b) <= tol, (m || '') + ' got ' + a + ' want ' + b + ' +-' + tol); };

/* ---------------- the wheels ---------------- */
['euro', 'american'].forEach(mode => {
  const w = R.wheel(mode);
  eq(w.length, mode === 'euro' ? 37 : 38, mode + ' pocket count');
  eq(new Set(w).size, w.length, mode + ' every pocket once');
  for (let i = 1; i <= 36; i++) ok(w.indexOf(i) >= 0, mode + ' has ' + i);
  ok(w.indexOf(0) >= 0, mode + ' has 0');
  eq(w.indexOf('00') >= 0, mode === 'american', mode + ' double zero');
  /* a real wheel alternates colour around the rim, and puts each pair of
     consecutive numbers opposite each other */
  const nums = w.filter(x => !R.isZero(x));
  let alt = 0;
  for (let i = 0; i < w.length; i++) {
    const a = w[i], b = w[(i + 1) % w.length];
    if (R.isZero(a) || R.isZero(b)) continue;
    if (R.colour(a) !== R.colour(b)) alt++;
  }
  eq(alt, mode === 'euro' ? 35 : 34, mode + ' colours alternate around the rim');
  eq(nums.filter(R.isRed).length, 18, mode + ' eighteen reds');
});
/* high and low numbers are spread evenly: no half of the European wheel holds
   more than ten of the eighteen high numbers */
{
  const w = R.wheel('euro');
  let worst = 0;
  for (let i = 0; i < w.length; i++) {
    let c = 0;
    for (let j = 0; j < 18; j++) { const v = w[(i + j) % w.length]; if (!R.isZero(v) && v > 18) c++; }
    worst = Math.max(worst, c);
  }
  ok(worst <= 10, 'high numbers spread around the wheel, worst half held ' + worst);
}

/* ---------------- the bet table ---------------- */
eq(R.odds(1), 35, 'straight pays 35');
eq(R.odds(2), 17, 'split pays 17');
eq(R.odds(3), 11, 'street pays 11');
eq(R.odds(4), 8, 'corner pays 8');
eq(R.odds(5), 6, 'five numbers pay 6');
eq(R.odds(6), 5, 'six line pays 5');
eq(R.odds(12), 2, 'dozen pays 2');
eq(R.odds(18), 1, 'even money pays 1');

{
  const t = R.table('euro'), keys = Object.keys(t);
  const by = k => keys.filter(x => t[x].kind === k).length;
  eq(by('straight'), 37, 'euro straights: 37');
  /* 2 x 12 down the streets, 3 x 11 across them, and three off the zero */
  eq(by('split'), 24 + 33 + 3, 'euro splits');
  eq(by('street'), 12 + 2, 'euro streets and trios');
  eq(by('corner'), 22 + 1, 'euro corners and the first four');
  eq(by('line'), 11, 'euro six lines');
  eq(by('column'), 3); eq(by('dozen'), 3); eq(by('even'), 6);
}
{
  const t = R.table('american'), keys = Object.keys(t);
  const by = k => keys.filter(x => t[x].kind === k).length;
  eq(by('straight'), 38, 'american straights: 38');
  eq(by('split'), 24 + 33 + 5, 'american splits incl. 0-00');
  eq(by('street'), 12 + 2, 'american streets and trios');
  eq(by('corner'), 22, 'american corners');
  eq(by('line'), 11 + 1, 'american six lines plus the top line');
  eq(t['basket'].nums.length, 5, 'american top line covers five');
  eq(t['basket'].odds, 6, 'american top line pays 6');
}

/* every bet covers only pockets that exist on its wheel, and no number twice */
['euro', 'american'].forEach(mode => {
  const t = R.table(mode), w = R.wheel(mode);
  Object.keys(t).forEach(k => {
    const b = t[k];
    eq(new Set(b.nums).size, b.nums.length, mode + ' ' + k + ' has no repeats');
    b.nums.forEach(x => ok(w.indexOf(x) >= 0, mode + ' ' + k + ' covers a real pocket: ' + x));
  });
});
/* the layout's own geometry: a corner really is a 2x2 block */
{
  const t = R.table('euro');
  ok(t['c:1-2-4-5'], 'corner 1/2/4/5 exists');
  ok(t['c:2-3-5-6'], 'corner 2/3/5/6 exists');
  ok(!t['c:1-3-4-6'], 'numbers that do not touch are not a corner');
  ok(t['p:1-2'] && t['p:2-3'] && t['p:1-4'], 'splits down and across');
  ok(!t['p:1-3'], '1 and 3 do not touch');
  ok(t['l:1-2-3-4-5-6'], 'first six line');
  eq(t['col:1'].nums[0], 1); eq(t['col:1'].nums[11], 34, 'first column tops out at 34');
  eq(t['doz:2'].nums[0], 13); eq(t['doz:2'].nums[11], 24, 'second dozen is 13 to 24');
}

/* ---------------- payouts, exhaustively ---------------- */
['euro', 'american'].forEach(mode => {
  const t = R.table(mode), w = R.wheel(mode);
  Object.keys(t).forEach(k => {
    const b = t[k];
    let back = 0, hits = 0;
    w.forEach(pocket => {
      const got = R.payout(mode, k, 10000, pocket);
      if (b.nums.indexOf(pocket) >= 0) { hits++; eq(got, 10000 * (b.odds + 1), mode + ' ' + k + ' pays on ' + pocket); }
      else eq(got, 0, mode + ' ' + k + ' pays nothing on ' + pocket);
      back += got;
    });
    eq(hits, b.nums.length, mode + ' ' + k + ' hits exactly its own numbers');
    /* the edge is the greens, nothing else */
    const want = mode === 'euro' ? 1 / 37 : (k === 'basket' ? 3 / 38 : 2 / 38);
    near(R.edge(mode, k), want, 1e-12, mode + ' ' + k + ' edge');
    near(back / (w.length * 10000), 1 - want, 1e-12, mode + ' ' + k + ' return');
  });
});

/* ---------------- placing, removing, settling ---------------- */
{
  const G = R.newGame('euro');
  eq(R.place(G, 's:17', 5000, 100000).added, 5000);
  eq(R.place(G, 's:17', 5000, 100000).added, 5000);
  eq(R.staked(G), 10000, 'two chips on 17');
  eq(R.place(G, 's:17', 99999999, 100000).added, 100000 - 0 > 0 ? Math.min(R.LIMITS.straight - 10000, 100000) : 0, 'capped by bankroll');
  const G2 = R.newGame('euro');
  eq(R.place(G2, 's:17', 99999999, 99999999).added, R.LIMITS.straight, 'capped by the table limit');
  eq(R.place(G2, 's:17', 100, 99999999).added, 0, 'no room left');
  eq(R.place(G2, 'nonsense', 100, 99999999).added, 0, 'unknown bet refused');
  eq(R.remove(G2, 's:17', 500000).removed, 500000);
  eq(R.staked(G2), 0, 'taken down');
}
{
  /* a straight and the red it sits on, settled against that number */
  const G = R.newGame('euro');
  R.place(G, 's:7', 10000, 1e9);
  R.place(G, 'red', 10000, 1e9);
  R.place(G, 'black', 10000, 1e9);
  const res = R.settle(G, { n: 7, colour: 'red', idx: 0 });
  eq(res.staked, 30000);
  eq(res.returned, 10000 * 36 + 20000, 'straight pays 35 and red pays even');
  eq(res.net, 360000 + 20000 - 30000);
  eq(res.ev.filter(l => l.won).map(l => l.key).sort(), ['red', 's:7']);
  eq(G.history[0].n, 7, 'the board remembers');
}
{
  /* zero takes the outside and leaves the trio standing */
  const G = R.newGame('euro');
  R.place(G, 'red', 10000, 1e9);
  R.place(G, 'odd', 10000, 1e9);
  R.place(G, 'low', 10000, 1e9);
  R.place(G, 't:0-1-2', 10000, 1e9);
  const res = R.settle(G, { n: 0, colour: 'green', idx: 0 });
  eq(res.returned, 10000 * 12, 'only the trio pays');
  eq(res.net, 120000 - 40000);
}
{
  /* the American five-number bet is the worst seat in the house */
  const G = R.newGame('american');
  R.place(G, 'basket', 10000, 1e9);
  eq(R.settle(G, { n: '00', colour: 'green', idx: 19 }).returned, 70000, 'top line pays 6 on 00');
  const G2 = R.newGame('american');
  R.place(G2, 'basket', 10000, 1e9);
  eq(R.settle(G2, { n: 4, colour: 'black', idx: 0 }).returned, 0, 'top line misses 4');
}

/* ---------------- the spin is fair ---------------- */
['euro', 'american'].forEach(mode => {
  const G = R.newGame(mode), w = R.wheel(mode), counts = {};
  const N = 200000;
  for (let i = 0; i < N; i++) {
    const s = R.spin(G);
    counts[s.n] = (counts[s.n] || 0) + 1;
    if (i === 0) eq(s.colour, R.colour(s.n), 'the spin knows its colour');
  }
  eq(Object.keys(counts).length, w.length, mode + ' every pocket came up');
  const want = N / w.length, tol = 5 * Math.sqrt(want);
  w.forEach(p => near(counts[p], want, tol, mode + ' pocket ' + p + ' frequency'));
});

/* ---------------- the edge shows up in play ---------------- */
['euro', 'american'].forEach(mode => {
  const want = mode === 'euro' ? 1 / 37 : 2 / 38;
  ['red', 'doz:1', 's:17', 'c:1-2-4-5'].forEach(key => {
    const G = R.newGame(mode);
    let staked = 0, back = 0;
    const N = 300000;
    for (let i = 0; i < N; i++) {
      R.place(G, key, 10000, 1e9);
      staked += 10000;
      back += R.settle(G, R.spin(G)).returned;
      G.bets = {};
    }
    const seen = 1 - back / staked;
    near(seen, want, 0.02, mode + ' ' + key + ' edge over ' + N + ' spins');
  });
});

console.log('roulette: ' + n + ' checks passed');
