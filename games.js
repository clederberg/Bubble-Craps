/* The two machines: a modern five-reel hold-and-spin game and an old-school
   three-reel classic with a pinball bonus. */
(function (root) {
  'use strict';
  var S = (typeof require === 'function' && typeof module !== 'undefined') ? require('./slots.js') : root.Slots;

  /* ================= Golden Lanterns: 5 reels, 3 rows, 5/25/50 lines ================= */
  var LANTERN_SYMBOLS = {
    WILD: { name: 'Pearl', cn: '珠', cls: 'wild' },
    COIN: { name: 'Gold Coin', cn: '金', cls: 'coin' },
    SCAT: { name: 'Temple', cn: '寺', cls: 'scat' },
    DRAGON: { name: 'Dragon', cn: '龍', cls: 's-dragon' },
    PHOENIX: { name: 'Phoenix', cn: '鳳', cls: 's-phoenix' },
    KOI: { name: 'Koi', cn: '鲤', cls: 's-koi' },
    LANTERN: { name: 'Lantern', cn: '燈', cls: 's-lantern' },
    A: { name: 'Ace', cn: 'A', cls: 's-a' },
    K: { name: 'King', cn: 'K', cls: 's-k' },
    Q: { name: 'Queen', cn: 'Q', cls: 's-q' },
    J: { name: 'Jack', cn: 'J', cls: 's-j' },
    T: { name: 'Ten', cn: '10', cls: 's-t' }
  };
  // counts per reel; reel 1 and 5 hold fewer coins so the feature is not too common
  var LANTERN_REELS = [
    { DRAGON: 2, PHOENIX: 3, KOI: 4, LANTERN: 4, A: 6, K: 6, Q: 7, J: 7, T: 7, WILD: 1, COIN: 8, SCAT: 2 },
    { DRAGON: 2, PHOENIX: 3, KOI: 4, LANTERN: 4, A: 6, K: 6, Q: 7, J: 7, T: 7, WILD: 2, COIN: 8, SCAT: 2 },
    { DRAGON: 3, PHOENIX: 3, KOI: 4, LANTERN: 4, A: 6, K: 6, Q: 6, J: 7, T: 7, WILD: 2, COIN: 8, SCAT: 2 },
    { DRAGON: 2, PHOENIX: 3, KOI: 4, LANTERN: 4, A: 6, K: 6, Q: 7, J: 7, T: 7, WILD: 2, COIN: 8, SCAT: 2 },
    { DRAGON: 2, PHOENIX: 3, KOI: 4, LANTERN: 4, A: 6, K: 6, Q: 7, J: 7, T: 7, WILD: 1, COIN: 8, SCAT: 2 }
  ];
  var LANTERN_PAYS = {
    DRAGON:  { 3: 94, 4: 470, 5: 1750 },
    PHOENIX: { 3: 63, 4: 314, 5: 1150 },
    KOI:     { 3: 47, 4: 188, 5: 700 },
    LANTERN: { 3: 37, 4: 157, 5: 540 },
    A:       { 3: 25, 4: 96, 5: 350 },
    K:       { 3: 23, 4: 73, 5: 290 },
    Q:       { 3: 13, 4: 63, 5: 232 },
    J:       { 3: 13, 4: 47, 5: 178 },
    T:       { 3: 13, 4: 47, 5: 178 },
    WILD:    { 3: 125, 4: 732, 5: 3500 }
  };
  function lanterns() {
    var g = {
      id: 'lanterns',
      title: 'Golden Lanterns',
      rows: 3,
      symbols: LANTERN_SYMBOLS,
      reels: LANTERN_REELS.map(function (c, i) { return S.strip(c, 8100 + i); }),
      pays: LANTERN_PAYS,
      wild: 'WILD',
      coin: 'COIN',
      scatter: 'SCAT',
      special: ['COIN', 'SCAT'],
      lineOptions: [5, 25, 50],
      scatterPays: { 3: 2, 4: 10, 5: 50 },
      free: { trigger: 3, spins: { 3: 8, 4: 12, 5: 20 }, multiplier: 2 },
      hold: {
        trigger: 6,
        landChance: 0.09,
        jackpots: { mini: 10, minor: 25, major: 200, grand: 1000 },
        coins: [
          { mult: 1, w: 0.38 }, { mult: 2, w: 0.24 }, { mult: 3, w: 0.15 },
          { mult: 5, w: 0.11 }, { mult: 10, w: 0.07 }, { mult: 20, w: 0.03 },
          { mult: 10, w: 0.012, label: 'MINI', jackpot: 'mini' },
          { mult: 25, w: 0.003, label: 'MINOR', jackpot: 'minor' },
          { mult: 200, w: 0.0008, label: 'MAJOR', jackpot: 'major' }
        ]
      }
    };
    g.lines = S.buildLines(5, 3, 50);
    return g;
  }

  /* ================= Pinball Classic: 3 reels, one line ================= */
  var PIN_SYMBOLS = {
    SEVEN: { name: 'Lucky Seven', cls: 'p-seven' },
    BELL: { name: 'Bell', cls: 'p-bell' },
    BAR3: { name: 'Triple Bar', cls: 'p-bar3' },
    BAR2: { name: 'Double Bar', cls: 'p-bar2' },
    BAR1: { name: 'Bar', cls: 'p-bar1' },
    CHERRY: { name: 'Cherry', cls: 'p-cherry' },
    BALL: { name: 'Silver Ball', cls: 'p-ball' },
    BLANK: { name: 'Blank', cls: 'p-blank' }
  };
  var PIN_REELS = [
    { SEVEN: 1, BELL: 3, BAR3: 1, BAR2: 2, BAR1: 3, CHERRY: 2, BALL: 3, BLANK: 7 },
    { SEVEN: 1, BELL: 3, BAR3: 1, BAR2: 2, BAR1: 3, CHERRY: 2, BALL: 3, BLANK: 7 },
    { SEVEN: 1, BELL: 3, BAR3: 1, BAR2: 2, BAR1: 3, CHERRY: 2, BALL: 3, BLANK: 7 }
  ];
  // Pays are multiples of the coin bet, on the single line, left to right.
  var PIN_PAYS = {
    SEVEN: { 3: 600 },
    BELL: { 3: 55 },
    BAR3: { 3: 170 },
    BAR2: { 3: 85 },
    BAR1: { 3: 35 },
    CHERRY: { 1: 3, 2: 9, 3: 60 }
  };
  function pinball() {
    var g = {
      id: 'pinball',
      title: 'Pinball Classic',
      rows: 1,
      symbols: PIN_SYMBOLS,
      reels: PIN_REELS.map(function (c, i) { return S.strip(c, 5500 + i); }),
      pays: PIN_PAYS,
      wild: null,
      coin: null,
      scatter: 'BALL',
      special: ['BALL'],
      lineOptions: [1],
      anyBar: 9,
      scatterPays: null,
      free: { trigger: 3, spins: {}, multiplier: 1 },
      pins: {
        // the ball drops through pegs into one of these slots, left to right
        slots: [250, 100, 50, 20, 10, 20, 50, 100, 250],
        rows: 8
      }
    };
    g.lines = [[0, 0, 0]];
    return g;
  }

  /* Old-school extras: cherries pay from the left even without three, and any
     three bars of mixed kinds pay a consolation. */
  function pinballWin(g, grid, bet) {
    var line = [grid[0][0], grid[1][0], grid[2][0]], wins = [];
    function add(sym, count, mult, note) { wins.push({ sym: sym, count: count, amount: mult * bet, note: note }); }
    if (line[0] === line[1] && line[1] === line[2] && g.pays[line[0]] && g.pays[line[0]][3]) {
      add(line[0], 3, g.pays[line[0]][3], 'three ' + g.symbols[line[0]].name.toLowerCase() + 's');
    } else {
      var bars = line.every(function (s) { return s === 'BAR1' || s === 'BAR2' || s === 'BAR3'; });
      if (bars) add('BAR1', 3, g.anyBar, 'any three bars');
      else {
        var cherries = 0;
        for (var i = 0; i < 3; i++) { if (line[i] === 'CHERRY') cherries++; else break; }
        if (cherries) add('CHERRY', cherries, g.pays.CHERRY[cherries], cherries === 1 ? 'one cherry' : cherries + ' cherries');
      }
    }
    var balls = line.filter(function (s) { return s === 'BALL'; }).length;
    var total = wins.reduce(function (a, w) { return a + w.amount; }, 0);
    return { line: line, wins: wins, total: total, balls: balls, bonus: balls === 3 };
  }
  /* The pinball bonus: the ball bounces left or right down a peg board. */
  function pinballBonus(g, bet) {
    var pos = 0, path = [];
    for (var r = 0; r < g.pins.rows; r++) {
      var right = Math.random() < 0.5;
      pos += right ? 1 : 0;
      path.push(right ? 1 : 0);
    }
    var slot = Math.max(0, Math.min(g.pins.slots.length - 1, pos));
    return { path: path, slot: slot, mult: g.pins.slots[slot], amount: g.pins.slots[slot] * bet };
  }

  var api = { lanterns: lanterns, pinball: pinball, pinballWin: pinballWin, pinballBonus: pinballBonus,
    LANTERN_SYMBOLS: LANTERN_SYMBOLS, PIN_SYMBOLS: PIN_SYMBOLS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Games = api;
})(this);
