/* Purim Pots: a five-reel game built the way Big Hot Flaming Pots is built.

   Three pots sit on the reels as scatters. Land three or more and the bonus
   starts, and whichever pots you closed decide what kind of bonus it is:
   Poppy gives a fourth respin, Apricot opens a second tray so the bonus
   happens twice over, and Chocolate drops in with a value of its own that is
   added to every hamantasch on the tray. Close two and you get both.

   The bonus itself is the interesting part. Hamantaschen lock in place, and a
   column with all three cells full is an order up: it pays, and those
   hamantaschen leave, so the cells are open again. Every order up lights one
   letter of G R A N D, and lighting all five wins the Grand. Nothing pays
   except what you complete, which is what makes the third cell of a column
   worth sweating.

   The round is three spins, four if Poppy was one of the pots. They do not
   reset, so what matters is how much of the tray you can clear in the few you
   are given.

   Money is in cents. Line pays are multiples of the line bet; everything in
   the bonus is a multiple of the total bet, so the odds do not move with the
   bet size. */
(function (root) {
  'use strict';
  var S = (typeof require === 'function' && typeof module !== 'undefined') ? require('./slots.js') : root.Slots;

  /* ---------- symbols ---------- */
  var SYMBOLS = {
    CROWN:     { name: 'Crown', art: 'crown', wild: true },
    MEGILLAH:  { name: 'Megillah', art: 'megillah' },
    GRAGGER:   { name: 'Gragger', art: 'gragger' },
    MASK:      { name: 'Mask', art: 'mask' },
    GOBLET:    { name: 'Goblet', art: 'goblet' },
    BASKET:    { name: 'Mishloach Manot', art: 'basket' },
    PEY:       { name: 'פ', art: 'letter', ch: 'פ' },
    VAV:       { name: 'ו', art: 'letter', ch: 'ו' },
    REISH:     { name: 'ר', art: 'letter', ch: 'ר' },
    MEM:       { name: 'מ', art: 'letter', ch: 'מ' },
    POPPY:     { name: 'Poppy pot', art: 'pot', pot: 'poppy' },
    APRICOT:   { name: 'Apricot pot', art: 'pot', pot: 'apricot' },
    CHOCOLATE: { name: 'Chocolate pot', art: 'pot', pot: 'chocolate' }
  };
  var ORDER = ['CROWN', 'MEGILLAH', 'GRAGGER', 'MASK', 'GOBLET', 'BASKET', 'PEY', 'VAV', 'REISH', 'MEM'];
  var POT_SYMS = ['POPPY', 'APRICOT', 'CHOCOLATE'];

  var PAYS = {
    CROWN:    { 3: 82, 4: 477, 5: 2190 },
    MEGILLAH: { 3: 50, 4: 246, 5: 1024 },
    GRAGGER:  { 3: 36, 4: 180, 5: 739 },
    MASK:     { 3: 26, 4: 131, 5: 524 },
    GOBLET:   { 3: 20, 4: 86, 5: 343 },
    BASKET:   { 3: 15, 4: 60, 5: 241 },
    PEY:      { 3: 9, 4: 32, 5: 129 },
    VAV:      { 3: 9, 4: 32, 5: 129 },
    REISH:    { 3: 7, 4: 22, 5: 94 },
    MEM:      { 3: 7, 4: 22, 5: 94 }
  };

  /* The pots are spread thin and evenly. Three of them anywhere starts the
     bonus, so the rate has to be earned on every reel. */
  var REELS = [
    { CROWN: 2, MEGILLAH: 6, GRAGGER: 6, MASK: 8, GOBLET: 10, BASKET: 12, PEY: 14, VAV: 14, REISH: 16, MEM: 16, POPPY: 3, APRICOT: 3, CHOCOLATE: 3 },
    { CROWN: 4, MEGILLAH: 6, GRAGGER: 6, MASK: 8, GOBLET: 10, BASKET: 12, PEY: 14, VAV: 14, REISH: 16, MEM: 16, POPPY: 3, APRICOT: 3, CHOCOLATE: 3 },
    { CROWN: 4, MEGILLAH: 6, GRAGGER: 6, MASK: 8, GOBLET: 10, BASKET: 12, PEY: 14, VAV: 14, REISH: 16, MEM: 16, POPPY: 3, APRICOT: 3, CHOCOLATE: 3 },
    { CROWN: 4, MEGILLAH: 6, GRAGGER: 6, MASK: 8, GOBLET: 10, BASKET: 12, PEY: 14, VAV: 14, REISH: 16, MEM: 16, POPPY: 3, APRICOT: 3, CHOCOLATE: 3 },
    { CROWN: 2, MEGILLAH: 6, GRAGGER: 6, MASK: 8, GOBLET: 10, BASKET: 12, PEY: 14, VAV: 14, REISH: 16, MEM: 16, POPPY: 3, APRICOT: 3, CHOCOLATE: 3 }
  ];

  /* What each pot does to the round it starts. */
  var POTS = [
    { key: 'poppy', sym: 'POPPY', name: 'Poppy', effect: 'spin', note: 'a fourth respin instead of three' },
    { key: 'apricot', sym: 'APRICOT', name: 'Apricot', effect: 'twin', note: 'a second tray plays alongside' },
    { key: 'chocolate', sym: 'CHOCOLATE', name: 'Chocolate', effect: 'boost', note: 'a drop adds its value to every hamantasch' }
  ];

  function game() {
    var g = {
      id: 'purim',
      title: 'Purim Pots',
      rows: 3,
      cols: 5,
      lineCount: 20,
      symbols: SYMBOLS,
      order: ORDER,
      pays: PAYS,
      wild: 'CROWN',
      potSyms: POT_SYMS,
      special: POT_SYMS.slice(),
      reels: REELS.map(function (c, i) { return S.strip(c, 4700 + i); }),
      pots: POTS,
      jackpots: {
        order: ['grand', 'major', 'minor', 'mini'],
        seed: { grand: 1000, major: 200, minor: 25, mini: 10 },
        rate: { grand: 0.012, major: 0.007, minor: 0.004, mini: 0.003 }
      },
      hold: {
        close: 3,
        respins: 3,
        landChance: 0.22,
        /* a second tray does not simply double the supply of hamantaschen */
        trayFactor: 1,
        /* how often a respin brings the chocolate drizzle instead of a plain
           hamantasch, and only when that pot was closed */
        drizzleChance: 0.1,
        maxSteps: 60,
        prizes: [
          { mult: 0.84, w: 0.4 }, { mult: 1.69, w: 0.25 }, { mult: 2.74, w: 0.15 },
          { mult: 4.7, w: 0.09 }, { mult: 7.05, w: 0.052 }, { mult: 13.2, w: 0.02 },
          { mult: 26.5, w: 0.006 },
          { label: 'MINI', w: 0.016, jackpot: 'mini' },
          { label: 'MINOR', w: 0.004, jackpot: 'minor' },
          { label: 'MAJOR', w: 0.0005, jackpot: 'major' }
        ]
      },
      buy: [
        { key: 'any', label: 'Pot Bonus', price: 45, note: 'Whichever pot turns up' },
        { key: 'poppy', label: 'Poppy Pot', price: 39, note: 'A fourth respin' },
        { key: 'apricot', label: 'Apricot Pot', price: 54, note: 'Two trays at once' },
        { key: 'chocolate', label: 'Chocolate Pot', price: 41, note: 'A drop adds its value to the tray' }
      ]
    };
    g.lines = S.buildLines(5, 3, g.lineCount);
    return g;
  }

  var GRAND_LETTERS = ['G', 'R', 'A', 'N', 'D'];
  /* prize labels are drawn from the amount once a drop has changed it */
  function money(c) { return '$' + Math.round(c / 100).toLocaleString('en-US'); }

  /* ---------- the bonus ----------
     One tray is fifteen cells read as five columns of three. Hamantaschen lock
     where they land; a column with all three full is an order up, which pays
     that column and empties it. */
  /* The five letters sit over the five columns, so a letter lights the first
     time its own column is completed. Completing it again pays again but the
     letter is already lit, which is why the Grand wants all five columns and
     not simply five orders. */
  function newTray(cols, rows) {
    return { cells: new Array(cols * rows).fill(null), lit: new Array(cols).fill(false),
      orders: [], paid: 0, grand: 0 };
  }

  function holdRound(g, totalBet, opts, jp) {
    opts = opts || {};
    var cols = g.cols, rows = g.rows, cells = cols * rows;
    var mods = opts.mods || [];
    var has = function (k) { return mods.indexOf(k) >= 0; };
    var base = has('poppy') ? g.hold.respins + 1 : g.hold.respins;
    var boost = has('chocolate');
    var trays = [newTray(cols, rows)];
    if (has('apricot')) trays.push(newTray(cols, rows));

    var total = 0, jackpots = [], steps = [], guard = 0, respins = base, landedAll = 0;

    function prize() {
      var t = S.weighted(g.hold.prizes);
      /* meters climb in fractions of a cent; a prize on the tray shows a round
         figure rather than a number with change on the end */
      if (t.jackpot) return { label: t.label, amount: Math.round(S.meterValue(g, t.jackpot, totalBet, jp) / 100) * 100, jackpot: t.jackpot };
      var amt = Math.round(t.mult * totalBet);
      return { label: money(amt), amount: amt, jackpot: null, mult: t.mult };
    }
    function place(tray, idx, v) {
      v = v || prize();
      tray.cells[idx] = v;
      landedAll++;
      if (v.jackpot) jackpots.push({ tier: v.jackpot, amount: v.amount });
      return v;
    }
    /* The chocolate drop lands carrying a value of its own, and that value is
       added to every hamantasch already on the tray. Then it settles as one
       more hamantasch, so it costs no cell. Jackpots are left alone. */
    function drizzle(tray, idx) {
      var v = prize();
      if (v.jackpot) return place(tray, idx, v);      // a jackpot drop just lands
      tray.cells.forEach(function (c) {
        if (c && !c.jackpot) { c.amount += v.amount; c.label = money(c.amount); }
      });
      v.drop = true;
      return place(tray, idx, v);
    }
    /* Any column that is full pays and empties, and lights the next letter. */
    function orders(tray, ti) {
      var done = [];
      for (var c = 0; c < cols; c++) {
        var full = true, sum = 0, idx = [];
        for (var r = 0; r < rows; r++) {
          var i = c * rows + r;
          if (!tray.cells[i]) { full = false; break; }
          sum += tray.cells[i].amount; idx.push(i);
        }
        if (!full) continue;
        idx.forEach(function (i) { tray.cells[i] = null; });
        tray.paid += sum;
        total += sum;
        var fresh = !tray.lit[c];
        tray.lit[c] = true;
        var order = { tray: ti, col: c, amount: sum, letter: fresh ? GRAND_LETTERS[c] : null };
        tray.orders.push(order);
        done.push(order);
        if (tray.lit.every(function (x) { return x; }) && !tray.grand) {
          tray.grand = S.meterValue(g, 'grand', totalBet, jp);
          total += tray.grand;
          jackpots.push({ tier: 'grand', amount: tray.grand });
          order.grand = tray.grand;
        }
      }
      return done;
    }

    /* The pots that started it become the first hamantaschen, spread across
       the trays, and the tray is topped up to three. */
    var seeds = (opts.seeds || []).slice();
    var want = Math.max(g.hold.close, seeds.length);
    var openCells = [];
    trays.forEach(function (t, ti) { for (var i = 0; i < cells; i++) openCells.push([ti, i]); });
    for (var s = 0; s < want; s++) {
      if (!openCells.length) break;
      var pick = openCells.splice(Math.floor(Math.random() * openCells.length), 1)[0];
      place(trays[pick[0]], pick[1]);
    }
    var firstOrders = [];
    trays.forEach(function (t, ti) { firstOrders = firstOrders.concat(orders(t, ti)); });
    steps.push({ trays: snapshot(trays), respins: respins, landed: want, orders: firstOrders, seed: true, total: total });

    while (respins > 0 && guard++ < g.hold.maxSteps) {
      var landed = 0, drops = [];
      /* Two trays share one supply of hamantaschen rather than doubling it,
         so a second tray spreads the round out instead of running away with
         it. The gain is the extra column slots and a second set of letters. */
      var chance = g.hold.landChance * (trays.length > 1 ? (opts.trayFactor || g.hold.trayFactor) : 1);
      trays.forEach(function (tray, ti) {
        for (var i = 0; i < cells; i++) {
          if (tray.cells[i]) continue;
          if (Math.random() >= chance) continue;
          var tryDrop = boost && Math.random() < g.hold.drizzleChance;
          var v = tryDrop ? drizzle(tray, i) : place(tray, i);
          /* a drop that came up a jackpot simply lands; there is nothing to
             add to the tray, so it is not a drizzle */
          var drizzled = tryDrop && !v.jackpot;
          /* a copy, not the cell itself: a later chocolate drop lifts every
             value on the tray, and this record is what the machine replays */
          drops.push({ tray: ti, idx: i, drizzle: drizzled, add: drizzled ? v.amount : 0,
            value: { label: v.label, amount: v.amount, jackpot: v.jackpot || null } });
          landed++;
        }
      });
      var made = [];
      trays.forEach(function (t, ti) { made = made.concat(orders(t, ti)); });
      respins--;
      steps.push({ trays: snapshot(trays), respins: respins, landed: landed, drops: drops, orders: made, total: total });
    }

    /* What is still sitting in a half-finished column when the respins run
       out is paid where it stands. */
    var left = leftOver(trays);
    total += left;

    return { steps: steps, total: total, jackpots: jackpots, mods: mods, respinBase: base, left: left,
      trays: trays.length, lit: trays.map(function (t) { return t.lit.filter(Boolean).length; }),
      orders: trays.reduce(function (a, t) { return a + t.orders.length; }, 0),
      grand: trays.reduce(function (a, t) { return a + t.grand; }, 0),
      landed: landedAll };
  }
  function snapshot(trays) {
    return trays.map(function (t) {
      return { cells: t.cells.map(function (v) { return v ? { label: v.label, amount: v.amount, jackpot: v.jackpot || null } : null; }),
        letters: t.letters, paid: t.paid, grand: t.grand };
    });
  }
  function leftOver(trays) {
    return trays.reduce(function (a, t) {
      return a + t.cells.reduce(function (x, v) { return x + (v ? v.amount : 0); }, 0);
    }, 0);
  }

  /* ---------- one spin ---------- */
  /* A pot closes when three of its own land. Close two and the round gets
     both features, which is the treat; most rounds close one. */
  function potsOn(g, grid) {
    var out = { count: 0, keys: [], spots: [], seen: {} };
    g.potSyms.forEach(function (sym) {
      var at = S.positionsOf(grid, sym);
      var key = g.symbols[sym].pot;
      out.seen[key] = at.length;
      if (at.length < g.hold.close) return;
      out.keys.push(key);
      at.forEach(function (p) {
        out.count++;
        out.spots.push({ sym: sym, key: key, x: p[0], y: p[1] });
      });
    });
    return out;
  }

  function play(g, lineBet, jp) {
    var totalBet = g.lineCount * lineBet;
    var stops = S.spinStops(g), grid = S.gridAt(g, stops);
    var lines = S.evalLines(g, grid, g.lineCount, lineBet);
    var out = { stops: stops, grid: grid, wins: lines.wins, lineTotal: lines.total, total: lines.total,
      totalBet: totalBet, features: [], jackpots: [] };
    var pots = potsOn(g, grid);
    out.pots = pots;
    if (pots.keys.length) {
      var hs = holdRound(g, totalBet, { mods: pots.keys, seeds: pots.spots }, jp);
      out.hold = hs;
      out.total += hs.total;
      hs.jackpots.forEach(function (j) { out.jackpots.push(j); });
      out.features.push('hold');
    }
    return out;
  }

  /* ---------- buying one ----------
     A bought bonus still comes off a real board, so the spin in front of it
     shows the pots that bought it and pays its own lines. */
  function buyFeature(g, which, lineBet, jp) {
    var totalBet = g.lineCount * lineBet;
    var wanted = which === 'any' ? null : which;
    var stops = S.spinStops(g), grid = S.gridAt(g, stops), pots = potsOn(g, grid);
    for (var i = 0; i < 80000; i++) {
      var st = S.spinStops(g), gr = S.gridAt(g, st), pt = potsOn(g, gr);
      if (!pt.keys.length) continue;
      if (wanted && pt.keys.indexOf(wanted) < 0) continue;
      stops = st; grid = gr; pots = pt;
      break;
    }
    var lines = S.evalLines(g, grid, g.lineCount, lineBet);
    var out = { stops: stops, grid: grid, wins: lines.wins, lineTotal: lines.total, total: lines.total,
      totalBet: totalBet, features: [], jackpots: [], pots: pots, bought: which };
    var mods = pots.keys.slice();
    if (wanted && mods.indexOf(wanted) < 0) mods.push(wanted);
    var seeds = pots.spots.length ? pots.spots : [{ x: 0, y: 0 }, { x: 2, y: 1 }, { x: 4, y: 2 }];
    var hs = holdRound(g, totalBet, { mods: mods, seeds: seeds }, jp);
    out.hold = hs;
    out.total += hs.total;
    hs.jackpots.forEach(function (j) { out.jackpots.push(j); });
    out.features.push('hold');
    return out;
  }

  var api = { game: game, play: play, holdRound: holdRound, buyFeature: buyFeature, potsOn: potsOn,
    SYMBOLS: SYMBOLS, ORDER: ORDER, POTS: POTS, GRAND_LETTERS: GRAND_LETTERS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PurimPots = api;
})(this);
