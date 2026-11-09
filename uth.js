/* Ultimate Texas Hold'em rules. All money is in cents.

   Ante and Blind are posted together and must be equal. Trips is an optional
   side bet that resolves on the player's own best five cards whatever else
   happens, a fold included.

   One raise per hand, and the longer you wait the less you may bet:
     before the flop   check, or Play 3x or 4x the ante
     after the flop    check, or Play 2x
     after the river   fold, or Play 1x

   The dealer needs a pair or better to qualify. Ante pushes when the dealer
   does not qualify, which is what makes checking down cheap. */
(function (root) {
  'use strict';

  var RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  function val(r) { return r === 'A' ? 14 : r === 'K' ? 13 : r === 'Q' ? 12 : r === 'J' ? 11 : +r; }

  /* Hand categories, low to high. Royal is a straight flush to the ace and is
     only distinguished where a paytable pays it differently. */
  var CAT = { HIGH: 0, PAIR: 1, TWO_PAIR: 2, TRIPS: 3, STRAIGHT: 4, FLUSH: 5,
    FULL_HOUSE: 6, QUADS: 7, STRAIGHT_FLUSH: 8 };
  var CAT_NAME = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight',
    'Flush', 'Full house', 'Four of a kind', 'Straight flush'];

  /* The best straight in a set of distinct descending values, or 0. The wheel
     counts with the ace low, so the ace is appended as a 1 when present. */
  function straightHigh(vals) {
    var u = vals.slice().sort(function (a, b) { return b - a; })
      .filter(function (v, i, a) { return i === 0 || v !== a[i - 1]; });
    if (u[0] === 14) u.push(1);
    var run = 1;
    for (var i = 1; i < u.length; i++) {
      if (u[i] === u[i - 1] - 1) {
        run++;
        if (run >= 5) return u[i] + 4;
      } else run = 1;
    }
    return 0;
  }

  /* Score any 5 to 7 cards as [category, tiebreakers...], compared left to
     right. Written to read the whole set at once rather than trying all 21
     five-card subsets, because the simulation leans on it millions of times.
     test-uth.js checks it against a brute-force oracle that does try them all. */
  function score(cards) {
    var byRank = {}, bySuit = { S: [], H: [], D: [], C: [] }, vals = [], i, v;
    for (i = 0; i < cards.length; i++) {
      v = val(cards[i].r);
      vals.push(v);
      byRank[v] = (byRank[v] || 0) + 1;
      bySuit[cards[i].s].push(v);
    }
    var flushSuit = null;
    for (var s in bySuit) if (bySuit[s].length >= 5) flushSuit = s;

    if (flushSuit) {
      var sfHigh = straightHigh(bySuit[flushSuit]);
      if (sfHigh) return [CAT.STRAIGHT_FLUSH, sfHigh];
    }

    /* ranks grouped by how many of them there are, then by rank */
    var groups = Object.keys(byRank).map(Number).sort(function (a, b) {
      return byRank[b] - byRank[a] || b - a;
    });
    var n1 = byRank[groups[0]], n2 = groups.length > 1 ? byRank[groups[1]] : 0;

    if (n1 === 4) return [CAT.QUADS, groups[0], Math.max.apply(null, groups.slice(1))];
    if (n1 === 3 && n2 >= 2) return [CAT.FULL_HOUSE, groups[0], groups[1]];
    if (flushSuit) {
      var f = bySuit[flushSuit].slice().sort(function (a, b) { return b - a; }).slice(0, 5);
      return [CAT.FLUSH].concat(f);
    }
    var st = straightHigh(vals);
    if (st) return [CAT.STRAIGHT, st];
    if (n1 === 3) return [CAT.TRIPS, groups[0]].concat(groups.slice(1, 3));
    if (n1 === 2 && n2 === 2) {
      var pairs = groups.filter(function (g) { return byRank[g] === 2; }).sort(function (a, b) { return b - a; });
      var top = pairs.slice(0, 2);
      /* With three pairs the odd pair still supplies the kicker, so the
         kicker is the best rank outside the top two pairs rather than the
         best singleton. */
      var rest = groups.filter(function (g) { return top.indexOf(g) < 0; })
        .sort(function (a, b) { return b - a; });
      return [CAT.TWO_PAIR, top[0], top[1], rest[0]];
    }
    if (n1 === 2) return [CAT.PAIR, groups[0]].concat(groups.slice(1, 4));
    return [CAT.HIGH].concat(groups.slice(0, 5));
  }

  function compare(a, b) {
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var x = a[i] || 0, y = b[i] || 0;
      if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
  }
  function isRoyal(sc) { return sc[0] === CAT.STRAIGHT_FLUSH && sc[1] === 14; }
  function handName(sc) {
    if (isRoyal(sc)) return 'Royal flush';
    return CAT_NAME[sc[0]];
  }

  /* Paytables as [numerator, denominator] on top of the stake. */
  var BLIND = [
    { cat: CAT.STRAIGHT_FLUSH, royal: true, pay: [500, 1], name: 'Royal flush' },
    { cat: CAT.STRAIGHT_FLUSH, pay: [50, 1], name: 'Straight flush' },
    { cat: CAT.QUADS, pay: [10, 1], name: 'Four of a kind' },
    { cat: CAT.FULL_HOUSE, pay: [3, 1], name: 'Full house' },
    { cat: CAT.FLUSH, pay: [3, 2], name: 'Flush' },
    { cat: CAT.STRAIGHT, pay: [1, 1], name: 'Straight' }
  ];
  var TRIPS = [
    { cat: CAT.STRAIGHT_FLUSH, royal: true, pay: [50, 1], name: 'Royal flush' },
    { cat: CAT.STRAIGHT_FLUSH, pay: [40, 1], name: 'Straight flush' },
    { cat: CAT.QUADS, pay: [30, 1], name: 'Four of a kind' },
    { cat: CAT.FULL_HOUSE, pay: [8, 1], name: 'Full house' },
    { cat: CAT.FLUSH, pay: [6, 1], name: 'Flush' },
    { cat: CAT.STRAIGHT, pay: [5, 1], name: 'Straight' },
    { cat: CAT.TRIPS, pay: [3, 1], name: 'Three of a kind' }
  ];
  function payFrom(table, sc) {
    for (var i = 0; i < table.length; i++) {
      var row = table[i];
      if (sc[0] !== row.cat) continue;
      if (row.royal && !isRoyal(sc)) continue;
      if (!row.royal && row.cat === CAT.STRAIGHT_FLUSH && isRoyal(sc)) continue;
      return row.pay;
    }
    return null;
  }
  function mul(c, r) { return Math.floor(c * r[0] / r[1]); }

  /* Deal a whole hand up front. The board is fixed before the player acts,
     exactly as at a table, so no decision can change a card. */
  function deal(draw) {
    var hole = [draw(), draw()], dealer = [draw(), draw()], board = [];
    for (var i = 0; i < 5; i++) board.push(draw());
    return { hole: hole, dealer: dealer, board: board };
  }

  function qualifies(sc) { return sc[0] >= CAT.PAIR; }

  /* bets: { ante, blind, trips }. playMult is 0 when the hand was folded or
     never raised, otherwise 4, 3, 2 or 1. Every figure returned is a net:
     what the bankroll gains or loses, with pushes at zero. */
  function settle(bets, playMult, folded, h) {
    var ante = bets.ante || 0, blind = bets.blind || 0, trips = bets.trips || 0;
    var player = score(h.hole.concat(h.board));
    var dealer = score(h.dealer.concat(h.board));
    var play = ante * (playMult || 0);
    var out = { player: player, dealer: dealer, play: play,
      dealerQualifies: qualifies(dealer), folded: !!folded };

    /* Trips rides on the player's own five cards and is settled whatever
       happens to the rest of the hand, folds included. */
    var tp = payFrom(TRIPS, player);
    out.trips = trips ? (tp ? mul(trips, tp) : -trips) : 0;
    out.tripsPay = tp;

    if (folded) {
      out.ante = -ante;
      out.blind = -blind;
      out.playNet = 0;
      out.result = 'fold';
    } else {
      var cmp = compare(player, dealer);
      out.cmp = cmp;
      /* The ante pushes whenever the dealer fails to open, win or lose. */
      out.ante = !out.dealerQualifies ? 0 : (cmp > 0 ? ante : cmp < 0 ? -ante : 0);
      out.playNet = cmp > 0 ? play : cmp < 0 ? -play : 0;
      var bp = cmp > 0 ? payFrom(BLIND, player) : null;
      out.blindPay = bp;
      /* Blind only pays a winning hand of a straight or better; a smaller
         winner pushes it. */
      out.blind = cmp > 0 ? (bp ? mul(blind, bp) : 0) : cmp < 0 ? -blind : 0;
      out.result = cmp > 0 ? 'win' : cmp < 0 ? 'lose' : 'push';
    }
    out.total = out.ante + out.blind + out.playNet + out.trips;
    out.staked = ante + blind + trips + play;
    return out;
  }

  var api = {
    RANKS: RANKS, CAT: CAT, CAT_NAME: CAT_NAME, BLIND: BLIND, TRIPS: TRIPS,
    val: val, score: score, compare: compare, isRoyal: isRoyal, handName: handName,
    straightHigh: straightHigh, payFrom: payFrom, mul: mul,
    deal: deal, settle: settle, qualifies: qualifies
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.UTH = api;
})(this);
