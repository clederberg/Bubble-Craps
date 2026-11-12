/* Roulette rules engine: the European single-zero wheel and the American
   double-zero one, with the full standard bet set.

   Two things are worth saying about the maths. First, every payout on a
   roulette layout is the same rule: a bet covering n numbers pays
   floor(36 / n) - 1 to one. That gives 35 on a straight, 17 on a split, 2 on a
   dozen, 1 on red, and 6 on the American five-number bet, which is the one
   people remember as an exception and is not one. Second, the house edge is
   not in the payouts, it is in the greens: on 37 pockets a bet covering n of
   them returns n * floor(36/n) / 37 of its stake, which is 36/37 for every bet
   on the European wheel and 36/38 on the American, save the five-number bet
   where the floor bites and it is 35/38.

   All money is in cents. */
(function (root) {
  'use strict';
  var C = (typeof require === 'function' && typeof module !== 'undefined') ? require('./common.js') : root.Casino;

  /* the pockets in the order they sit on the rim, clockwise from zero */
  var WHEELS = {
    euro: [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
      5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26],
    american: [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1,
      '00', 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2]
  };
  var REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  var LIMITS = { straight: 500000, split: 1000000, street: 1500000, corner: 2000000, line: 3000000, outside: 10000000 };

  function isRed(n) { return REDS.indexOf(n) >= 0; }
  function colour(n) { return (n === 0 || n === '00') ? 'green' : (isRed(n) ? 'red' : 'black'); }
  function isZero(n) { return n === 0 || n === '00'; }

  /* ---------- the bets ----------
     Every bet is a set of pockets. The key is its name on the layout, the
     numbers are what it covers, and the odds fall out of how many there are. */
  function odds(count) { return Math.floor(36 / count) - 1; }
  function keyOf(prefix, nums) { return prefix + ':' + nums.join('-'); }

  /* a number's place on the cloth: street 0..11 across, row 0..2 up */
  function cell(v) { return { s: Math.floor((v - 1) / 3), p: (v - 1) % 3 }; }
  function at(s, p) { return s * 3 + p + 1; }

  function buildBets(mode) {
    var bets = {}, s, p, i;
    function add(key, nums, label, kind) {
      nums = nums.slice().sort(function (a, b) {
        if (a === '00') return b === 0 ? 1 : -1;
        if (b === '00') return a === 0 ? -1 : 1;
        return a - b;
      });
      bets[key] = { key: key, nums: nums, odds: odds(nums.length), label: label, kind: kind };
    }
    /* straights, including the greens */
    for (i = 1; i <= 36; i++) add('s:' + i, [i], String(i), 'straight');
    add('s:0', [0], '0', 'straight');
    if (mode === 'american') add('s:00', ['00'], '00', 'straight');

    /* splits down a street and across to the next */
    for (s = 0; s < 12; s++) {
      for (p = 0; p < 2; p++) add(keyOf('p', [at(s, p), at(s, p + 1)]), [at(s, p), at(s, p + 1)], 'Split', 'split');
      if (s < 11) for (p = 0; p < 3; p++) add(keyOf('p', [at(s, p), at(s + 1, p)]), [at(s, p), at(s + 1, p)], 'Split', 'split');
    }
    /* streets, corners and six lines */
    for (s = 0; s < 12; s++) {
      add(keyOf('t', [at(s, 0), at(s, 1), at(s, 2)]), [at(s, 0), at(s, 1), at(s, 2)], 'Street', 'street');
      if (s < 11) {
        for (p = 0; p < 2; p++) {
          var q = [at(s, p), at(s, p + 1), at(s + 1, p), at(s + 1, p + 1)];
          add(keyOf('c', q), q, 'Corner', 'corner');
        }
        var six = [at(s, 0), at(s, 1), at(s, 2), at(s + 1, 0), at(s + 1, 1), at(s + 1, 2)];
        add(keyOf('l', six), six, 'Six line', 'line');
      }
    }
    /* the bets that touch the greens, which is where the two wheels differ */
    if (mode === 'american') {
      add('p:0-00', [0, '00'], 'Split', 'split');
      add('p:0-1', [0, 1], 'Split', 'split');
      add('p:0-2', [0, 2], 'Split', 'split');
      add('p:2-00', [2, '00'], 'Split', 'split');
      add('p:3-00', [3, '00'], 'Split', 'split');
      add('t:0-1-2', [0, 1, 2], 'Trio', 'street');
      add('t:2-3-00', [2, 3, '00'], 'Trio', 'street');
      add('basket', [0, '00', 1, 2, 3], 'Top line', 'line');
    } else {
      add('p:0-1', [0, 1], 'Split', 'split');
      add('p:0-2', [0, 2], 'Split', 'split');
      add('p:0-3', [0, 3], 'Split', 'split');
      add('t:0-1-2', [0, 1, 2], 'Trio', 'street');
      add('t:0-2-3', [0, 2, 3], 'Trio', 'street');
      add('basket', [0, 1, 2, 3], 'First four', 'corner');
    }
    /* the outside */
    for (i = 0; i < 3; i++) {
      var col = [], d = [];
      for (s = 0; s < 12; s++) col.push(at(s, i));
      for (p = 0; p < 12; p++) d.push(i * 12 + p + 1);
      add('col:' + (i + 1), col, ['1st', '2nd', '3rd'][i] + ' column', 'column');
      add('doz:' + (i + 1), d, ['1st 12', '2nd 12', '3rd 12'][i], 'dozen');
    }
    var low = [], high = [], red = [], black = [], odd = [], even = [];
    for (i = 1; i <= 36; i++) {
      (i <= 18 ? low : high).push(i);
      (isRed(i) ? red : black).push(i);
      (i % 2 ? odd : even).push(i);
    }
    add('low', low, '1 to 18', 'even');
    add('high', high, '19 to 36', 'even');
    add('red', red, 'Red', 'even');
    add('black', black, 'Black', 'even');
    add('odd', odd, 'Odd', 'even');
    add('even', even, 'Even', 'even');
    return bets;
  }

  var TABLES = { euro: buildBets('euro'), american: buildBets('american') };
  function table(mode) { return TABLES[mode === 'american' ? 'american' : 'euro']; }
  function wheel(mode) { return WHEELS[mode === 'american' ? 'american' : 'euro']; }

  function limitFor(bet) {
    return LIMITS[bet.kind === 'straight' ? 'straight'
      : bet.kind === 'split' ? 'split'
      : bet.kind === 'street' ? 'street'
      : bet.kind === 'corner' ? 'corner'
      : bet.kind === 'line' ? 'line' : 'outside'];
  }

  /* ---------- a game ---------- */
  function newGame(mode) {
    return { mode: mode === 'american' ? 'american' : 'euro', bets: {}, history: [], last: null };
  }
  function staked(G) {
    var t = 0, k;
    for (k in G.bets) if (G.bets[k]) t += G.bets[k];
    return t;
  }
  /* Returns what actually went down, which may be less than asked for if the
     bankroll or the table limit got in the way. */
  function place(G, key, amount, bank) {
    var bet = table(G.mode)[key];
    if (!bet || amount <= 0) return { added: 0, reason: bet ? 'amount' : 'nobet' };
    var have = G.bets[key] || 0;
    var room = limitFor(bet) - have;
    var add = Math.min(amount, room, bank);
    if (add <= 0) return { added: 0, reason: room <= 0 ? 'limit' : 'bank' };
    G.bets[key] = have + add;
    return { added: add, total: G.bets[key] };
  }
  function remove(G, key, amount) {
    var have = G.bets[key] || 0;
    if (!have) return { removed: 0 };
    var off = Math.min(amount, have);
    if (off >= have) delete G.bets[key]; else G.bets[key] = have - off;
    return { removed: off, left: G.bets[key] || 0 };
  }
  function clear(G) {
    var back = staked(G);
    G.bets = {};
    return back;
  }

  /* ---------- the spin ---------- */
  function spin(G) {
    var w = wheel(G.mode);
    var idx = C.randInt(w.length);
    return { n: w[idx], idx: idx, colour: colour(w[idx]) };
  }

  /* What a single bet gets back: nothing if it missed, stake and winnings if
     it hit. Returned, not won, so the caller never has to remember whether
     the stake was already taken. */
  function payout(mode, key, amount, n) {
    var bet = table(mode)[key];
    if (!bet) return 0;
    return bet.nums.indexOf(n) >= 0 ? amount * (bet.odds + 1) : 0;
  }

  /* Settles the whole layout against one pocket. `ev` is the receipt: one
     line per bet that did something, so the table can say what paid. */
  function settle(G, out) {
    var n = out.n, k, lines = [], back = 0, stake = staked(G);
    var keys = Object.keys(G.bets).sort();
    for (var i = 0; i < keys.length; i++) {
      k = keys[i];
      var amt = G.bets[k], bet = table(G.mode)[k];
      var got = payout(G.mode, k, amt, n);
      back += got;
      lines.push({
        key: k, label: bet.label, nums: bet.nums, amount: amt,
        won: got > 0, odds: bet.odds, returned: got, net: got - amt
      });
    }
    var res = {
      n: n, colour: out.colour, idx: out.idx,
      staked: stake, returned: back, net: back - stake,
      ev: lines.filter(function (l) { return l.won; })
        .concat(lines.filter(function (l) { return !l.won; }))
    };
    G.history.unshift({ n: n, colour: out.colour });
    if (G.history.length > 60) G.history.pop();
    G.last = res;
    return res;
  }

  /* ---------- for the tests and the stats panel ---------- */
  function edge(mode, key) {
    var bet = table(mode)[key], w = wheel(mode);
    var ret = bet.nums.length * (bet.odds + 1) / w.length;
    return 1 - ret;
  }
  function hot(G, n) {
    var c = 0;
    G.history.forEach(function (h) { if (h.n === n) c++; });
    return c;
  }

  var api = {
    WHEELS: WHEELS, REDS: REDS, LIMITS: LIMITS,
    isRed: isRed, colour: colour, isZero: isZero, odds: odds, cell: cell, at: at,
    buildBets: buildBets, table: table, wheel: wheel, limitFor: limitFor,
    newGame: newGame, staked: staked, place: place, remove: remove, clear: clear,
    spin: spin, payout: payout, settle: settle, edge: edge, hot: hot
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Roul = api;
})(this);
