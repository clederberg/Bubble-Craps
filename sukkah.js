/* Sukkah Nights: the five-reel game on the fourth bank.

   The shape is the one everybody knows from the pig game: a build symbol you
   collect six of, which gives you six spins to put up and then improve
   buildings on the grid, and a second scatter that spins a wheel to decide
   which flavour of that bonus you get. What is different here is what you are
   building and what happens at the end.

   Sukkot is the festival of the temporary hut. You put one up in the days
   after Yom Kippur, you eat and sleep in it for seven days, and the law is
   that it has to be flimsy enough to see the stars through the roof but sound
   enough to stand up to an ordinary wind. So the build is a sukkah going up in
   three stages: the FRAME of poles, then the WALLS, then the SCHACH, the cut
   branches laid over the top that make it kosher and make it a sukkah.

   The pig game ends by knocking the houses down, which is the wrong ending for
   this one: here you want the thing to stand. So it ends the way the festival
   does. On the last night the USHPIZIN arrive, the seven guests you invite
   into the sukkah, and they come through in three waves and pay out what is in
   each one. Frames first, then walls, then the finished sukkot, and the
   seventh guest closes the night and totals it.

   The two feature symbols are the two halves of the four species. The LULAV,
   the palm frond, is what you build with, because schach is palm fronds. The
   ETROG, the citron, is what spins the wheel, because the etrog is the one you
   hunt for. And the gold version of it is the PITOM ETROG, one with its little
   crown tip unbroken, which is the flawless one people pay through the nose
   for. Land it with two ordinary etrogim and the wheel behind the reels turns
   into the pair of wheels, the sukkah opens from three rows to six, and every
   mode has a bigger version of itself.

   The four jackpots climb the way the festival does: CHAI, SIMCHA, HOSHANA
   and SHALOM, for the sukkat shalom, the shelter of peace.

   Money is in cents. Pays are multiples of the unit, which is a
   twenty-fifth of the total bet, the way a twenty-five credit ways game is
   priced. Everything in a bonus is a multiple of the total bet, so the odds do
   not move with the bet size. */
(function (root) {
  'use strict';
  var S = (typeof require === 'function' && typeof module !== 'undefined') ? require('./slots.js') : root.Slots;
  var C = (typeof require === 'function' && typeof module !== 'undefined') ? require('./common.js') : root.Casino;

  var WILD = 'wind', BUILD = 'lulav', SAW = 'etrog', GOLD = 'pitom';
  /* the three stages of a sukkah, in the order it goes up */
  var FRAME = 1, WALLS = 2, SCHACH = 3;
  var TIER_NAME = [null, 'frame', 'walls', 'schach'];
  var JP = ['chai', 'simcha', 'hoshana', 'shalom'];

  /* ---------------- what a spin can show ---------------- */
  /* The low symbols are the seven species of the land, because Sukkot is the
     harvest festival and that is what the sukkah is decorated with. */
  var PAYS = {
    sukkah:     { 3: 32,   4: 100,  5: 400 },
    ushpizin:   { 3: 20,   4: 64,  5: 240 },
    feast:      { 3: 16,   4: 48,  5: 160 },
    grape:      { 3: 8,   4: 24,   5: 80 },
    fig:        { 3: 6.4, 4: 20,   5: 64 },
    date:       { 3: 5.6, 4: 16,   5: 56 },
    pomegranate:{ 3: 4.8, 4: 14, 5: 48 },
    olive:      { 3: 4,   4: 12,   5: 40 },
    barley:     { 3: 3.2, 4: 9.6, 5: 32 },
    wheat:      { 3: 2.4, 4: 8,   5: 28 }
  };
  var SYMS = Object.keys(PAYS);

  /* ---------------- the reels ----------------
     Reel one carries no etrog, so a wheel needs the other four, and the gold
     one lives on the middle three only, which is what keeps it rare without
     making it impossible. The lulav comes in stacks, because six of them have
     to be able to land in a fifteen cell window. */
  function strips() {
    var common = { wheat: 8, barley: 8, date: 7, olive: 7, pomegranate: 6,
      fig: 6, grape: 5, feast: 4, ushpizin: 3, sukkah: 3 };
    /* Tuned so that six lulavim land about once in a hundred and fifty spins
       and three etrogim about once in a hundred and fifty, which puts a
       feature of one kind or the other about every seventy five. */
    var SAWS = [0, 2, 3, 3, 2], BLOCKS = [1, 2, 2, 2, 1], SIZE = [2, 3, 3, 3, 2];
    var out = [];
    for (var r = 0; r < 5; r++) {
      var counts = {};
      Object.keys(common).forEach(function (k) { counts[k] = common[k]; });
      counts[WILD] = r === 0 ? 0 : 2;
      counts[SAW] = SAWS[r];
      /* the pitom etrog lives on the middle reel alone */
      counts[GOLD] = r === 2 ? 1 : 0;
      out.push(S.stackStrip(counts, 4100 + r * 17, BUILD, BLOCKS[r], SIZE[r]));
    }
    return out;
  }

  /* ---------------- ways ----------------
     Two hundred and forty three ways: a symbol pays if it is on reel one and
     every reel after it, as many times over as there are ways to pick one of
     them from each reel. */
  function evalWays(grid, rows, unit) {
    var wins = [], total = 0;
    SYMS.forEach(function (sym) {
      var ways = 1, len = 0, counts = [];
      for (var r = 0; r < grid.length; r++) {
        var n = 0;
        for (var y = 0; y < rows; y++) if (grid[r][y] === sym || grid[r][y] === WILD) n++;
        if (!n) break;
        counts.push(n);
        ways *= n;
        len++;
      }
      var table = PAYS[sym];
      if (len < 3 || !table || !table[len]) return;
      var amount = Math.round(table[len] * unit * ways);
      if (amount <= 0) return;
      wins.push({ sym: sym, count: len, ways: ways, amount: amount, perWay: table[len] });
      total += amount;
    });
    return { wins: wins, total: total };
  }

  /* ---------------- the jackpots ---------------- */
  var SEED = { chai: 18, simcha: 60, hoshana: 300, shalom: 2500 };
  function jackpot(tier, totalBet, meters) {
    var mult = (meters && meters[tier]) ? meters[tier] : SEED[tier];
    return Math.round(mult * totalBet);
  }

  /* ---------------- what is inside a sukkah ----------------
     A frame holds small change, a walled one holds more and can hold one of
     the two lower jackpots, and only a finished sukkah with its schach on can
     hold the Shalom. */
  /* One knob for how much is inside a sukkah, so the hold of the game can be
     moved without re-balancing every table by hand. */
  var VALUE = 4.54;
  var FILL = {
    1: [{ w: 30, mult: 0.4 }, { w: 24, mult: 0.6 }, { w: 16, mult: 1 }, { w: 8, mult: 1.5 }, { w: 3, mult: 2 }],
    2: [{ w: 24, mult: 1 }, { w: 20, mult: 1.5 }, { w: 14, mult: 2 }, { w: 8, mult: 3 }, { w: 4, mult: 5 },
        { w: 2.2, jackpot: 'chai' }, { w: 0.5, jackpot: 'simcha' }],
    3: [{ w: 18, mult: 2 }, { w: 16, mult: 3 }, { w: 12, mult: 5 }, { w: 7, mult: 8 }, { w: 4, mult: 12 },
        { w: 2, mult: 20 }, { w: 2.4, jackpot: 'chai' }, { w: 1.1, jackpot: 'simcha' },
        { w: 0.55, jackpot: 'hoshana' }, { w: 0.028, jackpot: 'shalom' }]
  };
  function fillOne(tier, totalBet, meters) {
    var r = S.weighted(FILL[tier]);
    if (r.jackpot) return { jackpot: r.jackpot, amount: jackpot(r.jackpot, totalBet, meters), tier: tier };
    return { mult: r.mult * VALUE, amount: Math.round(r.mult * VALUE * totalBet), tier: tier };
  }

  /* ---------------- the build ----------------
     Six nights. A lulav on an empty square puts up a frame, on a frame it adds
     the walls, on a walled one it lays the schach. On a finished sukkah it
     goes to whichever one is furthest behind instead, so a night is never
     wasted. Three lulavim in one night buys a seventh. */
  function buildRound(opt) {
    var rows = opt.rows, cells = 5 * rows;
    var board = new Array(cells).fill(0);
    var nights = opt.nights || 6, played = 0, extra = 0;
    if (!opt.extraAt) opt.extraAt = 3;
    if (opt.extraCap === undefined) opt.extraCap = 6;
    var log = [];
    (opt.seed || []).forEach(function (p) {
      var i = p[0] * rows + p[1];
      if (i >= 0 && i < cells) board[i] = Math.max(board[i], opt.seedTier || FRAME);
    });
    log.push({ night: 0, board: board.slice(), landed: (opt.seed || []).length, nights: nights });

    function place(i) {
      if (board[i] < SCHACH) { board[i]++; return i; }
      /* Already finished, so the night goes to whichever sukkah is furthest
         behind. Only one that is not finished itself can take it, or the
         roof gets laid twice and the square goes off the top of the scale. */
      var best = -1, low = SCHACH;
      for (var k = 0; k < cells; k++) {
        if (board[k] > 0 && board[k] < low) { low = board[k]; best = k; }
      }
      if (best >= 0) { board[best]++; return best; }
      /* everything standing is finished, so start a new one */
      for (var e = 0; e < cells; e++) if (board[e] === 0) { board[e] = FRAME; return e; }
      return -1;
    }

    while (played < nights && played < 40) {
      played++;
      var landed = 0, hits = [];
      for (var i = 0; i < cells; i++) {
        if (Math.random() < opt.landChance) {
          landed++;
          hits.push(place(i));
        }
      }
      /* the roaming etrogim of the Etrog Nights mode lay frames of their own */
      if (opt.roam) {
        for (var k = 0; k < opt.roam; k++) {
          if (Math.random() < opt.roamChance) {
            var empty = [];
            for (var c = 0; c < cells; c++) if (board[c] === 0) empty.push(c);
            if (empty.length) board[empty[Math.floor(Math.random() * empty.length)]] = FRAME;
          }
        }
      }
      if (landed >= opt.extraAt && extra < opt.extraCap) { nights++; extra++; }
      log.push({ night: played, board: board.slice(), landed: landed, hits: hits, nights: nights });
    }
    return { board: board, log: log, nights: nights, played: played, extra: extra, rows: rows };
  }

  /* The guests arrive: frames first, then the walled ones, then the finished
     sukkot, and the night is totalled. */
  function ushpizin(board, totalBet, meters, rows) {
    var waves = [], total = 0, jackpots = [], values = new Array(board.length).fill(null);
    [FRAME, WALLS, SCHACH].forEach(function (tier) {
      var wave = [];
      for (var i = 0; i < board.length; i++) {
        if (board[i] !== tier) continue;
        var v = fillOne(tier, totalBet, meters);
        values[i] = v;
        total += v.amount;
        if (v.jackpot) jackpots.push({ tier: v.jackpot, amount: v.amount });
        wave.push({ at: i, value: v });
      }
      waves.push({ tier: tier, name: TIER_NAME[tier], cells: wave });
    });
    var built = board.filter(function (v) { return v > 0; }).length;
    /* The Shalom is not for filling the grid, it is for finishing it: every
       square has to be a sukkah with its schach on, which is the whole street
       built and roofed before the guests come. */
    var done = board.filter(function (v) { return v === SCHACH; }).length;
    var full = null;
    if (done === board.length) {
      full = jackpot('shalom', totalBet, meters);
      total += full;
      jackpots.push({ tier: 'shalom', amount: full });
    }
    return { waves: waves, values: values, total: total, jackpots: jackpots, built: built, full: full, rows: rows };
  }

  /* ---------------- the wheel ----------------
     Three etrogim spin the wheel behind the reels. It either pays a jackpot
     outright or it picks which kind of night you are about to have. The gold
     etrog turns it into the pair of wheels: the same choices, but every one of
     them in its larger form, on a sukkah that has opened from three rows to
     six. */
  var WHEEL = [
    { w: 30, mode: 'frames', label: 'Ushpizin Nights' },
    { w: 20, mode: 'etrog', label: 'Etrog Nights' },
    { w: 14, mode: 'mega', label: 'Mega Lulav' },
    { w: 9, mode: 'schach', label: 'Schach Nights' },
    { w: 7, credit: 3, label: '3x' },
    { w: 4, credit: 6, label: '6x' },
    { w: 2.5, credit: 12, label: '12x' },
    { w: 3.2, jackpot: 'chai', label: 'Chai' },
    { w: 1.1, jackpot: 'simcha', label: 'Simcha' },
    { w: 0.3, jackpot: 'hoshana', label: 'Hoshana' },
    { w: 0.13, jackpot: 'shalom', label: 'Shalom' }
  ];
  var SUPER_WHEEL = [
    { w: 26, mode: 'frames', label: 'Super Ushpizin' },
    { w: 21, mode: 'etrog', label: 'Super Etrog' },
    { w: 16, mode: 'mega', label: 'Super Mega Lulav' },
    { w: 13, mode: 'schach', label: 'Super Schach' },
    { w: 8, credit: 10, label: '10x' },
    { w: 5, credit: 25, label: '25x' },
    { w: 6, jackpot: 'chai', label: 'Chai' },
    { w: 3, jackpot: 'simcha', label: 'Simcha' },
    { w: 1.6, jackpot: 'hoshana', label: 'Hoshana' },
    { w: 0.6, jackpot: 'shalom', label: 'Shalom' }
  ];

  /* what each mode starts you with and how generous the nights are */
  function modeSetup(mode, superMode, sawSpots, rows) {
    var cells = 5 * rows;
    /* The big sukkah has twice the squares, so the same chance per square
       would be twice the bonus. It gets a longer grid and a slower fill. */
    var s = { rows: rows, nights: 6, landChance: superMode ? 0.057 : 0.068,
      extraAt: superMode ? 4 : 3, extraCap: superMode ? 6 : 6,
      seed: [], seedTier: FRAME, roam: 0, roamChance: 0 };
    if (mode === 'frames') {
      /* the plain one: the etrogim that brought you here become frames */
      s.seed = sawSpots.slice();
      if (superMode) s.seed = s.seed.concat(spread(cells, rows, 4));
    } else if (mode === 'etrog') {
      /* etrogim stay on the grid and keep laying frames of their own */
      s.seed = sawSpots.slice();
      s.roam = superMode ? 4 : 2;
      s.roamChance = superMode ? 0.55 : 0.4;
    } else if (mode === 'mega') {
      /* one oversized lulav: a block of the grid goes up at once */
      s.seed = sawSpots.concat(block(rows, superMode ? 3 : 2));
      s.landChance = superMode ? 0.062 : 0.075;
    } else if (mode === 'schach') {
      /* the hard one to get: every etrog is a finished sukkah from the off */
      s.seed = sawSpots.slice();
      s.seedTier = SCHACH;
      if (superMode) s.seed = s.seed.concat(spread(cells, rows, 3));
    }
    return s;
  }
  function spread(cells, rows, n) {
    var out = [], used = {};
    for (var i = 0; i < n * 4 && out.length < n; i++) {
      var c = Math.floor(Math.random() * cells);
      if (used[c]) continue;
      used[c] = 1;
      out.push([Math.floor(c / rows), c % rows]);
    }
    return out;
  }
  function block(rows, size) {
    var x0 = Math.floor(Math.random() * (5 - size + 1));
    var y0 = Math.floor(Math.random() * (rows - size + 1));
    var out = [];
    for (var x = 0; x < size; x++) for (var y = 0; y < size; y++) out.push([x0 + x, y0 + y]);
    return out;
  }

  function spinWheel(superMode, totalBet, meters, sawSpots) {
    var table = superMode ? SUPER_WHEEL : WHEEL;
    var pick = S.weighted(table);
    var res = { superMode: !!superMode, label: pick.label, total: 0, jackpots: [], mode: null, build: null, guests: null };
    if (pick.jackpot) {
      res.total = jackpot(pick.jackpot, totalBet, meters);
      res.jackpots.push({ tier: pick.jackpot, amount: res.total });
      return res;
    }
    if (pick.credit) {
      res.total = Math.round(pick.credit * totalBet);
      res.credit = pick.credit;
      return res;
    }
    var rows = superMode ? 6 : 3;
    res.mode = pick.mode;
    var setup = modeSetup(pick.mode, superMode, sawSpots, rows);
    var b = buildRound(setup);
    var g = ushpizin(b.board, totalBet, meters, rows);
    res.build = b;
    res.guests = g;
    res.total = g.total;
    res.jackpots = g.jackpots;
    return res;
  }

  /* ---------------- a whole spin ---------------- */
  var BUILD_TRIGGER = 6, SAW_TRIGGER = 3;
  function play(opt) {
    opt = opt || {};
    var totalBet = opt.totalBet;
    var unit = totalBet / 25;
    var meters = opt.meters;
    var reels = opt.reels || REELS;
    var rows = 3;
    var stops = opt.stops || S.spinStops({ reels: reels, rows: rows }, reels);
    var grid = S.gridAt({ reels: reels, rows: rows }, stops, reels);

    var lines = evalWays(grid, rows, unit);
    var out = { stops: stops, grid: grid, ways: lines.wins, lineTotal: lines.total,
      total: lines.total, jackpots: [], build: null, wheel: null, bet: totalBet };

    var saws = S.positionsOf(grid, SAW), golds = S.positionsOf(grid, GOLD);
    var hats = S.positionsOf(grid, BUILD);
    var sawAll = saws.concat(golds);

    /* the wheel first: it decides what kind of night the build turns into */
    if (sawAll.length >= SAW_TRIGGER) {
      var w = spinWheel(golds.length > 0, totalBet, meters, sawAll);
      out.wheel = w;
      out.total += w.total;
      out.jackpots = out.jackpots.concat(w.jackpots);
    } else if (hats.length >= BUILD_TRIGGER) {
      /* six lulavim on their own is the plain build */
      var b = buildRound({ rows: rows, nights: 6, landChance: 0.055, seed: hats, seedTier: FRAME });
      var g = ushpizin(b.board, totalBet, meters, rows);
      out.build = { round: b, guests: g, mode: 'lulav' };
      out.total += g.total;
      out.jackpots = out.jackpots.concat(g.jackpots);
    }
    return out;
  }

  var REELS = strips();

  var api = {
    WILD: WILD, BUILD: BUILD, SAW: SAW, GOLD: GOLD, SYMS: SYMS, PAYS: PAYS,
    FRAME: FRAME, WALLS: WALLS, SCHACH: SCHACH, TIER_NAME: TIER_NAME, JP: JP, SEED: SEED,
    WHEEL: WHEEL, SUPER_WHEEL: SUPER_WHEEL, FILL: FILL,
    BUILD_TRIGGER: BUILD_TRIGGER, SAW_TRIGGER: SAW_TRIGGER,
    reels: REELS, strips: strips, evalWays: evalWays, jackpot: jackpot, fillOne: fillOne,
    buildRound: buildRound, ushpizin: ushpizin, spinWheel: spinWheel, modeSetup: modeSetup, play: play
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Sukkah = api;
})(this);
