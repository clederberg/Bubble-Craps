global.crypto = require('crypto').webcrypto;
const U = require('./uth.js');
const assert = require('assert');
let n = 0; const eq = (a, b, m) => { n++; assert.deepStrictEqual(a, b, m); };

const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const deck = [];
RANKS.forEach(r => SUITS.forEach(s => deck.push({ r, s })));
eq(deck.length, 52, 'a deck is 52 cards');

/* ---- a brute force oracle -------------------------------------------------
   Scores a hand by trying all 21 five-card subsets with a scorer written from
   scratch, deliberately in a different shape from the one that ships. If the
   two ever disagree on a hand, one of them is wrong. */
function score5(cs) {
  const v = cs.map(c => U.val(c.r)).sort((a, b) => b - a);
  const flush = cs.every(c => c.s === cs[0].s);
  const uniq = [...new Set(v)];
  let straight = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straight = uniq[0];
    else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) straight = 5;  // the wheel
  }
  const cnt = {};
  v.forEach(x => cnt[x] = (cnt[x] || 0) + 1);
  const by = Object.keys(cnt).map(Number).sort((a, b) => cnt[b] - cnt[a] || b - a);
  const shape = by.map(k => cnt[k]).join('');
  if (straight && flush) return [8, straight];
  if (shape.startsWith('4')) return [7, by[0], by[1]];
  if (shape === '32') return [6, by[0], by[1]];
  if (flush) return [5, ...v];
  if (straight) return [4, straight];
  if (shape.startsWith('3')) return [3, by[0], by[1], by[2]];
  if (shape.startsWith('22')) return [2, by[0], by[1], by[2]];
  if (shape.startsWith('2')) return [1, by[0], by[1], by[2], by[3]];
  return [0, ...v];
}
function oracle(cards) {
  let best = null;
  for (let a = 0; a < cards.length; a++)
    for (let b = a + 1; b < cards.length; b++)
      for (let c = b + 1; c < cards.length; c++)
        for (let d = c + 1; d < cards.length; d++)
          for (let e = d + 1; e < cards.length; e++) {
            const s = score5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || U.compare(s, best) > 0) best = s;
          }
  return best;
}

/* ---- the evaluator against the oracle ---- */
{
  let rng = 12345;
  const rnd = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const hand = () => {
    const d = deck.slice();
    for (let i = d.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; }
    return d.slice(0, 7);
  };
  let mismatches = 0, catSeen = {};
  const N = 120000;
  for (let i = 0; i < N; i++) {
    const h = hand();
    const fast = U.score(h), slow = oracle(h);
    catSeen[fast[0]] = (catSeen[fast[0]] || 0) + 1;
    if (U.compare(fast, slow) !== 0) {
      mismatches++;
      if (mismatches < 3) console.log('  MISMATCH', JSON.stringify(h), 'fast', fast, 'slow', slow);
    }
  }
  eq(mismatches, 0, N.toLocaleString() + ' random hands scored the same as the brute force oracle');
  // and the sample actually exercised every category, so the check means something
  for (let c = 0; c <= 8; c++) eq(catSeen[c] > 0, true, 'the sample contained a ' + U.CAT_NAME[c].toLowerCase());
}

/* ---- ordering, including the awkward cases ---- */
{
  const C = (str) => str.split(' ').map(t => ({ r: t.slice(0, -1), s: t.slice(-1) }));
  const better = (a, b, why) => eq(U.compare(U.score(C(a)), U.score(C(b))) > 0, true, why);
  const same = (a, b, why) => eq(U.compare(U.score(C(a)), U.score(C(b))), 0, why);

  better('AS KS QS JS 10S 2H 3D', 'KS QS JS 10S 9S 2H 3D', 'a royal beats a king-high straight flush');
  better('9S 9H 9D 9C 2S 3H 4D', 'AS AH AD KC KS 2H 3D', 'quads beat a full house');
  better('AS 2S 3S 4S 5S KH QD', 'AS AH AD KC QS 2H 3D', 'the wheel straight flush beats trips');
  better('AS KH QD JC 10S 2H 3D', '9S 8H 7D 6C 5S 2H 3D', 'a broadway straight beats a nine-high one');
  better('AS AH KD KC QS 2H 3D', 'AS AH QD QC KS 2H 3D', 'two pair is read by the higher pair first');
  better('AS AH KD QC JS 2H 3D', 'AS AH KD QC 10S 2H 3D', 'a pair is split by the third kicker');
  same('AS AH KD QC JS 2H 3D', 'AD AC KS QH JD 2S 3C', 'suits never break a tie');
  // a board that plays itself: both hands are the board, so it is a push
  same('2H 3D AS KS QS JS 10S', '4H 5D AS KS QS JS 10S', 'when the board is the best hand both players tie');
}

/* ---- settlement --------------------------------------------------------- */
{
  const C = (str) => str.split(' ').map(t => ({ r: t.slice(0, -1), s: t.slice(-1) }));
  const hand = (hole, dealer, board) => ({ hole: C(hole), dealer: C(dealer), board: C(board) });
  const B = { ante: 500, blind: 500, trips: 0 };

  // dealer misses a pair and the player wins: the ante pushes rather than paying
  let h = hand('9S 8H', '2C 7D', '10D JC QS 3H 4S');
  let r = U.settle(B, 1, false, h);
  eq([r.dealerQualifies, r.ante, r.playNet, r.blind], [false, 0, 500, 500],
    'dealer under a pair: ante pushes, play pays, blind pays the straight');

  // dealer misses a pair and still wins: the ante pushes all the same
  h = hand('3S 4D', 'AS QD', '2H 5D 9C JS KH');
  r = U.settle(B, 1, false, h);
  eq([r.dealerQualifies, r.result, r.ante, r.playNet, r.blind], [false, 'lose', 0, -500, -500],
    'dealer under a pair and winning: ante still pushes, the rest loses');

  // a win with less than a straight pushes the blind, with a dealer that does open
  h = hand('AS KD', '3D 2C', '3H 8S JC AD 5C');
  r = U.settle(B, 1, false, h);
  eq([r.dealerQualifies, r.result, r.ante, r.blind],
    [true, 'win', 500, 0], 'beating a qualifying dealer with only a pair pays the ante and pushes the blind');

  // a tie pushes everything
  h = hand('2H 3D', '4H 5D', 'AS KS QS JS 10S');
  r = U.settle(B, 2, false, h);
  eq([r.result, r.ante, r.blind, r.playNet], ['push', 0, 0, 0], 'a shared board pushes all three');

  // folding forfeits ante and blind, and makes no play bet
  h = hand('2H 7D', 'AS AD', '3S 8C JH KD 5C');
  r = U.settle(B, 0, true, h);
  eq([r.ante, r.blind, r.playNet, r.play], [-500, -500, 0, 0], 'a fold loses ante and blind only');

  // trips is settled even on a fold
  r = U.settle({ ante: 500, blind: 500, trips: 100 }, 0, true,
    hand('9S 9D', '2C 3D', '9H KS 4C 7D 8S'));
  eq([r.folded, r.trips], [true, 300], 'trips still pays its 3 to 1 after a fold');

  // every rung of the blind paytable, on a hand the player wins
  const blindCase = (hole, board, expect, why) => {
    const res = U.settle({ ante: 100, blind: 100, trips: 0 }, 1, false,
      hand(hole, '2C 3D', board));
    eq([res.result, res.blind], ['win', expect], why);
  };
  blindCase('AS KS', 'QS JS 10S 7H 4D', 50000, 'royal flush pays the blind 500 to 1');
  blindCase('9S 8S', 'QS JS 10S 7H 4D', 5000, 'straight flush pays 50 to 1');
  blindCase('9S 9D', '9H 9C 2S 7H 4D', 1000, 'quads pay 10 to 1');
  blindCase('9S 9D', '9H KC KS 7H 4D', 300, 'a full house pays 3 to 1');
  blindCase('AS 7S', 'QS JS 2S 7H 4D', 150, 'a flush pays 3 to 2');
  blindCase('9S 8H', '10D JC QS 3H 4S', 100, 'a straight pays even money');

  // and the trips table
  const tripsCase = (hole, board, expect, why) => {
    const res = U.settle({ ante: 100, blind: 100, trips: 100 }, 1, false,
      hand(hole, '2C 3D', board));
    eq(res.trips, expect, why);
  };
  tripsCase('AS KS', 'QS JS 10S 7H 4D', 5000, 'trips pays 50 to 1 for a royal');
  tripsCase('9S 8S', 'QS JS 10S 7H 4D', 4000, 'trips pays 40 to 1 for a straight flush');
  tripsCase('9S 9D', '9H 9C 2S 7H 4D', 3000, 'trips pays 30 to 1 for quads');
  tripsCase('9S 9D', '9H KC KS 7H 4D', 800, 'trips pays 8 to 1 for a full house');
  tripsCase('AS 7S', 'QS JS 2S 7H 4D', 600, 'trips pays 6 to 1 for a flush');
  tripsCase('9S 8H', '10D JC QS 3H 4S', 500, 'trips pays 5 to 1 for a straight');
  tripsCase('9S 9D', '9H KC 2S 7H 4D', 300, 'trips pays 3 to 1 for trips');
  tripsCase('AS KD', '3H 8S JC AD 5C', -100, 'anything under trips loses the side bet');
}

/* ---- the paytable against the exact maths --------------------------------
   The 7-card hand frequencies are a published, independently known quantity.
   Pricing the Trips table against them is exact rather than sampled, so this
   says whether the paytable is the one it claims to be. */
const FREQ = { royal: 4324, straightFlush: 37260, quads: 224848, fullHouse: 3473184,
  flush: 4047644, straight: 6180020, trips: 6461620, twoPair: 31433400,
  pair: 58627800, high: 23294460 };
const DEALS = 133784560;                       // C(52,7)
{
  const total = Object.keys(FREQ).reduce((a, k) => a + FREQ[k], 0);
  eq(total, DEALS, 'the published frequencies account for every seven card deal');

  const pay = { royal: 50, straightFlush: 40, quads: 30, fullHouse: 8, flush: 6, straight: 5, trips: 3 };
  let gross = 0, winners = 0;
  Object.keys(pay).forEach(k => { gross += FREQ[k] * pay[k]; winners += FREQ[k]; });
  const edge = -(gross - (DEALS - winners)) / DEALS * 100;
  console.log('uth: trips table prices out at a ' + edge.toFixed(3) + '% house edge (exact)');
  eq(Math.abs(edge - 1.904) < 0.001, true, 'the trips table is the documented 1.90% one');

  // and the engine agrees about what each rung pays
  const rung = (cat, royal) => {
    const sc = royal ? [U.CAT.STRAIGHT_FLUSH, 14] : [cat, 9];
    const p = U.payFrom(U.TRIPS, sc);
    return p ? p[0] / p[1] : 0;
  };
  eq(rung(null, true), 50, 'engine pays 50 for a royal');
  eq(rung(U.CAT.STRAIGHT_FLUSH), 40, 'engine pays 40 for a straight flush');
  eq(rung(U.CAT.QUADS), 30, 'engine pays 30 for quads');
  eq(rung(U.CAT.FULL_HOUSE), 8, 'engine pays 8 for a full house');
  eq(rung(U.CAT.FLUSH), 6, 'engine pays 6 for a flush');
  eq(rung(U.CAT.STRAIGHT), 5, 'engine pays 5 for a straight');
  eq(rung(U.CAT.TRIPS), 3, 'engine pays 3 for trips');
  eq(rung(U.CAT.TWO_PAIR), 0, 'two pair pays nothing');
}

/* ---- the evaluator against reality ---------------------------------------
   The oracle above only proves two implementations agree. This checks the
   categories actually come up at their real rates, which would catch both
   being wrong in the same way. */
{
  // mulberry32: the cheap LCG used earlier was poor enough to bias the tails
  let a = 0x9E3779B9;
  const rnd = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const d = deck.slice(), seen = {};
  const N = 500000;
  for (let i = 0; i < N; i++) {
    for (let k = d.length - 1; k > 0; k--) { const j = (rnd() * (k + 1)) | 0; [d[k], d[j]] = [d[j], d[k]]; }
    const sc = U.score(d.slice(0, 7));
    const key = U.isRoyal(sc) ? 'royal' : sc[0];
    seen[key] = (seen[key] || 0) + 1;
  }
  const expect = {
    0: FREQ.high, 1: FREQ.pair, 2: FREQ.twoPair, 3: FREQ.trips,
    4: FREQ.straight, 5: FREQ.flush, 6: FREQ.fullHouse, 7: FREQ.quads,
    8: FREQ.straightFlush, royal: FREQ.royal
  };
  const lines = [];
  Object.keys(expect).forEach(k => {
    const p = expect[k] / DEALS, got = (seen[k] || 0) / N;
    const se = Math.sqrt(p * (1 - p) / N);
    const label = k === 'royal' ? 'Royal flush' : U.CAT_NAME[k];
    lines.push('    ' + label.padEnd(17) + (got * 100).toFixed(4) + '%  expected ' + (p * 100).toFixed(4) + '%');
    // five standard errors, with a floor so the rarest rows are not nonsense
    eq(Math.abs(got - p) <= Math.max(5 * se, 0.00004), true,
      label + ' comes up at its real rate (' + (got * 100).toFixed(4) + '% vs ' + (p * 100).toFixed(4) + '%)');
  });
  console.log('uth: category rates over ' + N.toLocaleString() + ' deals');
  lines.forEach(l => console.log(l));
}

console.log('uth: all passed', n, 'asserts');
