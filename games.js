/* The two machines: a modern five-reel hold-and-spin game with a Festival of
   Lights theme, and an old-school three-reel classic with a pinball bonus.
   All artwork here is drawn by hand as inline SVG. */
(function (root) {
  'use strict';
  var S = (typeof require === 'function' && typeof module !== 'undefined') ? require('./slots.js') : root.Slots;

  /* ================= Festival of Lights: 5 reels, 3 rows, 5/25/50 lines ================= */
  /* Each symbol carries its own little drawing. `svg` is the inside of a
     0 0 48 48 viewBox; `ch` is a plain glyph for the letter symbols. */
  var ART = {
    star:
      '<path class="fill" d="M24 3 42.2 34.5H5.8Z"/><path class="fill" d="M24 45 5.8 13.5h36.4Z"/>' +
      '<path class="hole" d="M24 15.5 30.8 27.2H17.2Z"/>',
    menorah:
      '<g class="stroke"><path d="M24 33V13"/><path d="M7 13v8c0 7.5 7.6 12.5 17 12.5S41 28.5 41 21v-8"/>' +
      '<path d="M14 13v7c0 4.6 4.5 7.5 10 7.5S34 24.6 34 20v-7"/>' +
      '<path d="M24 33v5"/><path d="M14 44h20"/><path d="M18 38h12l2 6H16Z"/></g>' +
      '<g class="flame"><path d="M7 11.8c1.7-2.2 2.2-3.3 2.2-4.5 0-1.7-1-2.8-2.2-4.1-1.2 1.3-2.2 2.4-2.2 4.1 0 1.2.5 2.3 2.2 4.5z"/>' +
      '<path d="M14 11.8c1.7-2.2 2.2-3.3 2.2-4.5 0-1.7-1-2.8-2.2-4.1-1.2 1.3-2.2 2.4-2.2 4.1 0 1.2.5 2.3 2.2 4.5z"/>' +
      '<path d="M24 10.4c1.9-2.6 2.5-3.8 2.5-5.2 0-2-1.3-3.3-2.5-4.8-1.2 1.5-2.5 2.8-2.5 4.8 0 1.4.6 2.6 2.5 5.2z"/>' +
      '<path d="M34 11.8c1.7-2.2 2.2-3.3 2.2-4.5 0-1.7-1-2.8-2.2-4.1-1.2 1.3-2.2 2.4-2.2 4.1 0 1.2.5 2.3 2.2 4.5z"/>' +
      '<path d="M41 11.8c1.7-2.2 2.2-3.3 2.2-4.5 0-1.7-1-2.8-2.2-4.1-1.2 1.3-2.2 2.4-2.2 4.1 0 1.2.5 2.3 2.2 4.5z"/></g>',
    dreidel:
      '<g class="fill"><rect x="20.8" y="1.5" width="6.4" height="9" rx="2.2"/>' +
      '<path d="M12 11.5h24a2.2 2.2 0 0 1 2.2 2.2v14.6a2.2 2.2 0 0 1-.7 1.6L24 45.5 10.5 29.9a2.2 2.2 0 0 1-.7-1.6V13.7A2.2 2.2 0 0 1 12 11.5z"/></g>' +
      '<text class="mark" x="24" y="29" text-anchor="middle" font-size="18" font-weight="700" font-family="serif">\u05D2</text>',
    pomegranate:
      '<g class="fill"><path d="M24 15.5c9.6 0 15.3 7 15.3 15.5 0 8.6-6.6 14.8-15.3 14.8S8.7 39.6 8.7 31C8.7 22.5 14.4 15.5 24 15.5z"/>' +
      '<path d="M24 17c-1.6-4.3-4.3-7-8.6-8.6 2.8-1 5.4-.6 7.1.9-.5-2.2-.7-4.2-.6-6 1.2 1.5 2.2 3.4 3.1 5.7 1.9-1.6 4.4-2 7.4-.9C28.3 9.9 25.6 12.6 24 17z"/></g>' +
      '<g class="seed"><circle cx="19" cy="27" r="2.2"/><circle cx="29" cy="27" r="2.2"/>' +
      '<circle cx="24" cy="33" r="2.2"/><circle cx="15.5" cy="34.5" r="2.2"/><circle cx="32.5" cy="34.5" r="2.2"/>' +
      '<circle cx="24" cy="23" r="1.8"/></g>',
    challah:
      '<g class="fill"><path d="M4.5 30.5C9 19.5 16.4 13.5 24 13.5s15 6 19.5 17c-2.6 7-10 10.8-19.5 10.8S7.1 37.5 4.5 30.5z"/></g>' +
      '<g class="braid"><path d="M9 25.6c2.8-3.6 5.4-1 7.4-4.4"/><path d="M16.6 22.6c2.8-3.6 5.4-1 7.4-4.4"/>' +
      '<path d="M24.2 22.6c2.8-3.6 5.4-1 7.4-4.4"/><path d="M31.6 25.6c2.8-3.6 5.4-1 7.4-4.4"/>' +
      '<path d="M7 32.4c3.4-4 6.4-.6 9-4.4"/><path d="M16.4 33c3.4-4 6.4-.6 9-4.4"/>' +
      '<path d="M25.6 33c3.4-4 6.4-.6 9-4.4"/></g>' +
      '<g class="seedtop"><circle cx="15" cy="20" r="1"/><circle cx="24" cy="17.6" r="1"/><circle cx="33" cy="20" r="1"/></g>',
    shofar:
      '<g class="fill"><path d="M8 41.5C7 29.6 11.4 19.6 20.6 13.4 27.6 8.8 35.4 6 44 5v13.8c-7.6.4-14 2.4-18.8 6C18 30 14.6 35.4 14 41.5z"/>' +
      '<rect x="5.5" y="36.5" width="11" height="6" rx="3"/></g>' +
      '<ellipse class="hole" cx="43.6" cy="11.9" rx="2.6" ry="6.9"/>' +
      '<g class="stroke thin"><path d="M38 12.6c-7 1.2-12.6 3.6-17 7.2"/></g>',
    pan:
      '<g class="pan-h"><rect x="29" y="15.5" width="18" height="5.4" rx="2.7" transform="rotate(-14 29 18)"/></g>' +
      '<g class="fill"><path d="M4.6 22c.6 6.4 6.2 11.2 13.4 11.2S30.8 28.4 31.4 22z"/></g>' +
      '<g class="rim"><ellipse cx="18" cy="22" rx="14" ry="5.2"/></g>' +
      '<g class="inner"><ellipse cx="18" cy="22" rx="10.8" ry="3.7"/></g>',
    latke:
      '<g class="fill"><path d="M24 9c9.4 0 17 6.2 17 13.8S33.4 37 24 37 7 30.4 7 22.8 14.6 9 24 9z"/></g>' +
      '<g class="crisp"><path d="M14 19c4-2.4 7.6-2.4 11 0"/><path d="M17 26c4-2.4 8-2.4 12 0"/>' +
      '<path d="M26 15c3 .6 5.4 1.8 7 3.6"/></g>',
    ark:
      '<g class="case"><path d="M6 15c0-5 4-9 9-9h18c5 0 9 4 9 9v27H6z"/></g>' +
      '<g class="crown"><path d="M18 6l3-4 3 4 3-4 3 4"/></g>',
    scroll:
      '<g class="paper"><rect x="12" y="8" width="24" height="32" rx="2"/></g>' +
      '<g class="roller"><rect x="6" y="4" width="7" height="40" rx="3.5"/><rect x="35" y="4" width="7" height="40" rx="3.5"/></g>' +
      '<g class="text"><path d="M17 16h14"/><path d="M17 21h14"/><path d="M17 26h10"/><path d="M17 31h12"/></g>',
    candle:
      '<g><rect x="19" y="19" width="10" height="24" rx="2.6" fill="#fdf4e0"/>' +
      '<rect x="19" y="19" width="3.4" height="24" rx="1.6" fill="#e6d7bb"/>' +
      '<path d="M24 19v-3.4" stroke="#6b5a32" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M24 1.6c5.6 6.8 7.6 10.4 7.6 13.6a7.6 7.6 0 0 1-15.2 0c0-3.2 2-6.8 7.6-13.6z" fill="#ff9d2e"/>' +
      '<path d="M24 8.6c2.8 3.6 3.8 5.6 3.8 7.2a3.8 3.8 0 0 1-7.6 0c0-1.6 1-3.6 3.8-7.2z" fill="#fff0ae"/></g>'
  };
  var LIGHT_SYMBOLS = {
    WILD: { name: 'Star', cls: 'w-star', svg: ART.star },
    CANDLE: { name: 'Candle', cls: 'w-candle', svg: ART.candle },
    SHOFAR: { name: 'Shofar', cls: 'w-shofar', svg: ART.shofar },
    PAN: { name: 'Frying Pan', cls: 'w-pan', svg: ART.pan },
    MENORAH: { name: 'Menorah', cls: 'w-menorah', svg: ART.menorah },
    DREIDEL: { name: 'Dreidel', cls: 'w-dreidel', svg: ART.dreidel },
    POMEGRANATE: { name: 'Pomegranate', cls: 'w-pom', svg: ART.pomegranate },
    CHALLAH: { name: 'Challah', cls: 'w-challah', svg: ART.challah },
    ALEF: { name: 'Alef', cls: 'l-a', ch: 'א' },
    SHIN: { name: 'Shin', cls: 'l-k', ch: 'ש' },
    HEY: { name: 'Hey', cls: 'l-q', ch: 'ה' },
    GIMEL: { name: 'Gimel', cls: 'l-j', ch: 'ג' },
    NUN: { name: 'Nun', cls: 'l-t', ch: 'נ' }
  };
  // counts per reel; reels 1 and 5 hold one fewer wild so the feature is not too common
  var LIGHT_REELS = [
    { MENORAH: 2, DREIDEL: 3, POMEGRANATE: 4, CHALLAH: 4, ALEF: 6, SHIN: 6, HEY: 7, GIMEL: 7, NUN: 6, WILD: 1, CANDLE: 8, SHOFAR: 2, PAN: 1 },
    { MENORAH: 2, DREIDEL: 3, POMEGRANATE: 4, CHALLAH: 4, ALEF: 6, SHIN: 6, HEY: 7, GIMEL: 7, NUN: 6, WILD: 2, CANDLE: 8, SHOFAR: 2, PAN: 1 },
    { MENORAH: 3, DREIDEL: 3, POMEGRANATE: 4, CHALLAH: 4, ALEF: 6, SHIN: 6, HEY: 6, GIMEL: 7, NUN: 6, WILD: 2, CANDLE: 8, SHOFAR: 2, PAN: 1 },
    { MENORAH: 2, DREIDEL: 3, POMEGRANATE: 4, CHALLAH: 4, ALEF: 6, SHIN: 6, HEY: 7, GIMEL: 7, NUN: 6, WILD: 2, CANDLE: 8, SHOFAR: 2, PAN: 1 },
    { MENORAH: 2, DREIDEL: 3, POMEGRANATE: 4, CHALLAH: 4, ALEF: 6, SHIN: 6, HEY: 7, GIMEL: 7, NUN: 6, WILD: 1, CANDLE: 8, SHOFAR: 2, PAN: 1 }
  ];
  /* The free-game reel set: thicker with candles, and carrying stacks of the
     boosted symbol, which rides the strip as a placeholder token. */
  var FREE_REELS = [
    { MENORAH: 1, DREIDEL: 2, POMEGRANATE: 3, CHALLAH: 3, ALEF: 4, SHIN: 4, HEY: 5, GIMEL: 5, NUN: 5, WILD: 2, CANDLE: 7, SHOFAR: 2 },
    { MENORAH: 1, DREIDEL: 2, POMEGRANATE: 3, CHALLAH: 3, ALEF: 4, SHIN: 4, HEY: 5, GIMEL: 5, NUN: 5, WILD: 2, CANDLE: 7, SHOFAR: 2 },
    { MENORAH: 1, DREIDEL: 2, POMEGRANATE: 3, CHALLAH: 3, ALEF: 4, SHIN: 4, HEY: 5, GIMEL: 5, NUN: 5, WILD: 2, CANDLE: 7, SHOFAR: 2 },
    { MENORAH: 1, DREIDEL: 2, POMEGRANATE: 3, CHALLAH: 3, ALEF: 4, SHIN: 4, HEY: 5, GIMEL: 5, NUN: 5, WILD: 2, CANDLE: 7, SHOFAR: 2 },
    { MENORAH: 1, DREIDEL: 2, POMEGRANATE: 3, CHALLAH: 3, ALEF: 4, SHIN: 4, HEY: 5, GIMEL: 5, NUN: 5, WILD: 2, CANDLE: 7, SHOFAR: 2 }
  ];
  /* Which symbol the scroll reveals. A better symbol comes with fewer spins. */
  var FREE_PICKS = [
    { sym: 'NUN', w: 40, spinAdj: 0 },
    { sym: 'GIMEL', w: 40, spinAdj: 0 },
    { sym: 'HEY', w: 30, spinAdj: 0 },
    { sym: 'SHIN', w: 16, spinAdj: -1 },
    { sym: 'ALEF', w: 14, spinAdj: -1 },
    { sym: 'CHALLAH', w: 9, spinAdj: -2 },
    { sym: 'POMEGRANATE', w: 6, spinAdj: -3 },
    { sym: 'DREIDEL', w: 3, spinAdj: -4 },
    { sym: 'MENORAH', w: 1.5, spinAdj: -5 },
    { sym: 'WILD', w: 0.5, spinAdj: -6 }
  ];
  var LIGHT_PAYS = {
    MENORAH:     { 3: 83, 4: 415, 5: 1544 },
    DREIDEL:     { 3: 56, 4: 277, 5: 1014 },
    POMEGRANATE: { 3: 41, 4: 166, 5: 617 },
    CHALLAH:     { 3: 32, 4: 138, 5: 476 },
    ALEF:        { 3: 22, 4: 84, 5: 309 },
    SHIN:        { 3: 20, 4: 65, 5: 256 },
    HEY:         { 3: 12, 4: 56, 5: 205 },
    GIMEL:       { 3: 12, 4: 41, 5: 157 },
    NUN:         { 3: 12, 4: 41, 5: 157 },
    WILD:        { 3: 110, 4: 646, 5: 3087 }
  };
  var LIGHT_ORDER = ['MENORAH', 'DREIDEL', 'POMEGRANATE', 'CHALLAH', 'ALEF', 'SHIN', 'HEY', 'GIMEL', 'NUN', 'WILD'];
  function lights() {
    var g = {
      id: 'lights',
      title: 'Festival of Lights',
      rows: 3,
      symbols: LIGHT_SYMBOLS,
      order: LIGHT_ORDER,
      reels: LIGHT_REELS.map(function (c, i) { return S.strip(c, 8100 + i); }),
      freeReels: FREE_REELS.map(function (c, i) { return S.stackStrip(c, 8200 + i, 'BOOST', 2, 3); }),
      pays: LIGHT_PAYS,
      wild: 'WILD',
      coin: 'CANDLE',
      scatter: 'SHOFAR',
      bonus: 'PAN',
      special: ['CANDLE', 'SHOFAR', 'PAN'],
      lineOptions: [5, 25, 50],
      scatterPays: { 3: 2, 4: 10, 5: 50 },
      /* The four meters, held as multiples of the total bet. Each spin adds
         `rate` to each meter; winning one pays it out and drops it back to the
         seed. Kept in multiples so the odds do not change with bet size. */
      jackpots: {
        order: ['grand', 'major', 'minor', 'mini'],
        seed: { grand: 1000, major: 200, minor: 25, mini: 10 },
        rate: { grand: 0.012, major: 0.007, minor: 0.004, mini: 0.003 }
      },
      free: {
        trigger: 3,
        spins: { 3: 8, 4: 12, 5: 20 },
        multiplier: 1,
        token: 'BOOST',
        picks: FREE_PICKS,
        minSpins: 4,
        holdTrigger: 5,
        retrigger: 5
      },
      /* Buying a feature costs its true long-run value divided by the game's
         own return, so a purchase is worth the same as spinning for it. */
      buy: [
        { key: 'free', label: 'Free Games', price: 25, note: 'The ark opens and a symbol is boosted' },
        { key: 'latke', label: 'Latke Bonus', price: 30, note: 'Pick pans until one comes up empty' },
        { key: 'hold', label: 'Light the Menorah', price: 34, note: 'Hold and spin, jackpots in play' }
      ],
      /* The latke round: pick a flying pan, a latke lands in it and pays.
         An empty pan ends it, and so does a jackpot. */
      latke: {
        trigger: 3,
        reveals: [
          { mult: 2, w: 16 }, { mult: 3, w: 14 }, { mult: 6, w: 11 },
          { mult: 10, w: 8 }, { mult: 20, w: 4 }, { mult: 50, w: 1.5 },
          { jackpot: 'mini', label: 'MINI', w: 2 },
          { jackpot: 'minor', label: 'MINOR', w: 0.7 },
          { jackpot: 'major', label: 'MAJOR', w: 0.12 },
          { jackpot: 'grand', label: 'GRAND', w: 0.012 },
          { empty: true, w: 13 }
        ]
      },
      hold: {
        trigger: 6,
        landChance: 0.05,
        coins: [
          { mult: 1, w: 0.38 }, { mult: 2, w: 0.24 }, { mult: 3, w: 0.15 },
          { mult: 5, w: 0.11 }, { mult: 10, w: 0.07 }, { mult: 20, w: 0.03 },
          { label: 'MINI', w: 0.02, jackpot: 'mini' },
          { label: 'MINOR', w: 0.005, jackpot: 'minor' },
          { label: 'MAJOR', w: 0.0008, jackpot: 'major' }
        ]
      }
    };
    g.lines = S.buildLines(5, 3, 50);
    return g;
  }

  /* ================= Pinball Classic: 3 reels, one line, 1 or 2 credits ================= */
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
  /* The silver ball only lives on the third reel: one of them anywhere on the
     line sends the ball to the playfield. */
  var PIN_SIDE = { SEVEN: 1, BELL: 3, BAR3: 1, BAR2: 2, BAR1: 3, CHERRY: 2, BLANK: 10 };
  /* Reel three carries a single silver ball on a long virtual strip, so the
     shot bonus is a real event rather than something that lands every few
     spins. The other symbols keep their old proportions (every count x16). */
  var PIN_LAST = { SEVEN: 16, BELL: 48, BAR3: 16, BAR2: 32, BAR1: 48, CHERRY: 32, BALL: 1, BLANK: 112 };
  // Pays are multiples of the bet per credit, on the single line, left to right.
  var PIN_PAYS = {
    SEVEN: { 3: 586, max: 1400 },
    BELL: { 3: 56 },
    BAR3: { 3: 147 },
    BAR2: { 3: 73 },
    BAR1: { 3: 28 },
    CHERRY: { 1: 2, 2: 8, 3: 49 }
  };
  /* The shot bonus: the ball is launched at lit targets worth 5 to 100
     credits. One shot on a single credit, all five on max credits. */
  var PIN_TARGETS = [
    { credits: 5, w: 55 },
    { credits: 10, w: 22 },
    { credits: 15, w: 12 },
    { credits: 25, w: 6 },
    { credits: 50, w: 3 },
    { credits: 100, w: 2 }
  ];

  function pinball() {
    var g = {
      id: 'pinball',
      title: 'Pinball Classic',
      rows: 1,
      symbols: PIN_SYMBOLS,
      reels: [S.strip(PIN_SIDE, 5500), S.strip(PIN_SIDE, 5501), S.strip(PIN_LAST, 5502)],
      pays: PIN_PAYS,
      wild: null,
      coin: null,
      scatter: 'BALL',
      special: ['BALL'],
      lineOptions: [1],
      anyBar: 9,
      maxCredits: 2,
      scatterPays: null,
      free: { trigger: 3, spins: {}, multiplier: 1 },
      /* The shot bonus: the ball is launched at lit targets. One shot on a
         single credit, all five on max credits. */
      shot: {
        shots: { 1: 3, 2: 6 },
        targets: PIN_TARGETS
      }
    };
    g.lines = [[0, 0, 0]];
    return g;
  }

  /* Old-school extras: cherries pay from the left even without three, any three
     bars of mixed kinds pay a consolation, and three sevens on two credits pay
     the boosted top award. `bet` is the wager per credit. */
  function pinballWin(g, grid, bet, credits) {
    var cr = credits || 1;
    var line = [grid[0][0], grid[1][0], grid[2][0]], wins = [];
    function add(sym, count, mult, note, flat) {
      wins.push({ sym: sym, count: count, amount: (flat ? mult : mult * cr) * bet, note: note });
    }
    var three = line[0] === line[1] && line[1] === line[2];
    if (three && line[0] === 'SEVEN') {
      var maxed = cr >= g.maxCredits && g.pays.SEVEN.max;
      add('SEVEN', 3, maxed ? g.pays.SEVEN.max : g.pays.SEVEN[3], maxed ? 'three sevens, max credits' : 'three sevens', !!maxed);
    } else if (three && g.pays[line[0]] && g.pays[line[0]][3]) {
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
    var total = wins.reduce(function (a, w) { return a + w.amount; }, 0);
    return { line: line, wins: wins, total: total, balls: line[2] === 'BALL' ? 1 : 0, bonus: line[2] === 'BALL' };
  }
  /* The shot bonus: the ball is launched at the lit targets. Each shot hits one
     of them, and how many shots you get comes down to how many credits you
     played. Awards are in credits, so they scale with the bet per credit. */
  function pinballBonus(g, bet, credits) {
    var cr = credits || 1;
    var count = g.shot.shots[cr] || g.shot.shots[1];
    var targets = g.shot.targets, total = 0, shots = [], i;
    var wsum = targets.reduce(function (a, t) { return a + t.w; }, 0);
    for (i = 0; i < count; i++) {
      var roll = Math.random() * wsum, acc = 0, hit = targets[targets.length - 1], idx = targets.length - 1;
      for (var j = 0; j < targets.length; j++) {
        acc += targets[j].w;
        if (roll < acc) { hit = targets[j]; idx = j; break; }
      }
      var amount = hit.credits * bet;
      total += amount;
      shots.push({ target: idx, credits: hit.credits, amount: amount });
    }
    return { shots: shots, count: count, total: total, maxed: cr >= g.maxCredits };
  }

  var api = { lights: lights, FREE_PICKS: FREE_PICKS, pinball: pinball, pinballWin: pinballWin, pinballBonus: pinballBonus,
    LIGHT_SYMBOLS: LIGHT_SYMBOLS, LIGHT_ORDER: LIGHT_ORDER, PIN_SYMBOLS: PIN_SYMBOLS, ART: ART };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Games = api;
})(this);
