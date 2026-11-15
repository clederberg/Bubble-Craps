/* The 3D cloth's geometry: can you reach every bet by clicking the felt, and
   does every click land on a bet the engine knows?
   Run with: node test-rlayout.js */
global.crypto = require('crypto').webcrypto;
const R = require('./roul.js');
const assert = require('assert');
const fs = require('fs');

/* rlayout.js is an ES module for the bundle; load it here without a build */
const src = fs.readFileSync('./floor/src/rlayout.js', 'utf8')
  .replace(/^export /gm, '');
const mod = new Function(src + '; return { GEO, numberUV, anchorUV, keyAt };')();
const { GEO, numberUV, anchorUV, keyAt } = mod;

let n = 0;
const eq = (a, b, m) => { n++; assert.deepStrictEqual(a, b, m); };
const ok = (a, m) => { n++; assert.ok(a, m); };

for (const mode of ['euro', 'american']) {
  const american = mode === 'american';
  const table = R.table(mode);
  const keys = Object.keys(table);

  /* ---- every point you can click lands on a bet that exists ---- */
  const seen = new Set();
  let samples = 0, nulls = 0;
  for (let i = 0; i <= 900; i += 2) {
    for (let j = 0; j <= 1800; j += 2) {
      const k = keyAt(i / GEO.W, j / GEO.H, american);
      if (k === null) { nulls++; continue; }
      samples++;
      if (!table[k]) assert.fail(mode + ': click at ' + i + ',' + j + ' gave ' + k + ', which is not a bet');
      seen.add(k);
    }
  }
  ok(samples > 100000, mode + ' sampled the cloth: ' + samples + ' points on it');
  n++;

  /* ---- and every bet on the layout can be reached ---- */
  const missing = keys.filter(k => !seen.has(k));
  eq(missing, [], mode + ' every bet is reachable by clicking');

  /* ---- the middle of a number is that number ---- */
  for (let v = 1; v <= 36; v++) {
    const uv = numberUV(v, american);
    eq(keyAt(uv[0], uv[1], american), 's:' + v, mode + ' centre of ' + v);
  }
  eq(keyAt(...numberUV(0, american), american), 's:0', mode + ' centre of 0');
  if (american) eq(keyAt(...numberUV('00', true), true), 's:00', 'centre of 00');

  /* ---- a bet's own anchor picks that bet back up ---- */
  /* (a chip sits where you would put it, so clicking it again adds to it) */
  let anchorHits = 0, anchorMiss = [];
  keys.forEach(k => {
    const uv = anchorUV(k, american);
    const got = keyAt(uv[0], uv[1], american);
    if (got === k) anchorHits++; else anchorMiss.push(k + ' -> ' + got);
  });
  eq(anchorMiss, [], mode + ' every chip sits on its own bet');
  eq(anchorHits, keys.length);

  /* ---- the lines are where they should be ---- */
  const px = (x, y) => keyAt(x / GEO.W, y / GEO.H, american);
  const L = GEO.left, C = GEO.cw, TOP = GEO.top;
  eq(px(L + C * 0.5, TOP + C * 0.5), 's:1', mode + ' first cell is 1');
  eq(px(L + C * 1.5, TOP + C * 0.5), 's:2');
  eq(px(L + C * 2.5, TOP + C * 0.5), 's:3');
  eq(px(L + C * 0.5, TOP + C * 1.5), 's:4', mode + ' second row starts at 4');
  eq(px(L + C, TOP + C * 0.5), 'p:1-2', mode + ' the line between 1 and 2');
  eq(px(L + C * 0.5, TOP + C), 'p:1-4', mode + ' the line between 1 and 4');
  eq(px(L + C, TOP + C), 'c:1-2-4-5', mode + ' the corner of 1 2 4 5');
  eq(px(L, TOP + C * 0.5), 't:1-2-3', mode + ' the street line beside 1');
  eq(px(L, TOP + C), 'l:1-2-3-4-5-6', mode + ' the six line');
  eq(px(L, TOP), 'basket', mode + ' the corner off the zero');
  eq(px(L + C * 1.5, TOP + C * 11.5), 's:35', mode + ' last row');
  eq(px(L + C * 3.5, TOP + C * 2), 'doz:1', mode + ' first dozen');
  eq(px(L + C * 3.5, TOP + C * 6), 'doz:2');
  eq(px(L + C * 3.5, TOP + C * 10), 'doz:3');
  eq(px(L + C * 4.5, TOP + C), 'low', mode + ' 1 to 18');
  eq(px(L + C * 4.5, TOP + C * 11), 'high');
  eq(px(L + C * 0.5, TOP + C * 12.4), 'col:1', mode + ' the 2 to 1 boxes');
  eq(px(L + C * 2.5, TOP + C * 12.4), 'col:3');
  eq(px(1, 1), null, mode + ' off the cloth is nothing');
}

/* the two wheels differ only where they touch a green */
{
  const L = GEO.left, C = GEO.cw, TOP = GEO.top;
  const e = (x, y) => keyAt(x / GEO.W, y / GEO.H, false);
  const a = (x, y) => keyAt(x / GEO.W, y / GEO.H, true);
  eq(e(L + C * 1.5, TOP - 70), 's:0', 'euro has one green cell');
  eq(a(L + C * 0.6, TOP - 70), 's:0', 'american 0 is the near half');
  eq(a(L + C * 2.4, TOP - 70), 's:00', 'american 00 is the far half');
  eq(a(L + C * 1.5, TOP - 70), 'p:0-00', 'the line between them');
  eq(e(L + C * 2.5, TOP), 'p:0-3', 'euro 0-3 split');
  eq(a(L + C * 2.5, TOP), 'p:3-00', 'american 3 touches 00, not 0');
  eq(a(L + C * 1.35, TOP), 'p:0-2', 'american 2 touches 0 on its near side');
  eq(a(L + C * 1.65, TOP), 'p:2-00', 'and 00 on its far side');
  eq(e(L + C * 2, TOP), 't:0-2-3', 'euro second trio');
  eq(a(L + C * 2, TOP), 't:2-3-00', 'american second trio');
}

console.log('roulette cloth: ' + n + ' checks passed');
