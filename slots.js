/* Slot engine shared by both machines: reel strips, paylines, line evaluation,
   hold-and-spin and free games. Money is in cents; pays are multiples of the
   line bet (or of the total bet, where noted). */
(function (root) {
  'use strict';
  var C = (typeof require === 'function' && typeof module !== 'undefined') ? require('./common.js') : root.Casino;

  /* ---------- paylines: smooth paths across the reels, horizontals first ---------- */
  function buildLines(reels, rows, max) {
    var paths = [[]];
    for (var r = 0; r < reels; r++) {
      var next = [];
      paths.forEach(function (p) {
        for (var row = 0; row < rows; row++) {
          if (p.length && Math.abs(p[p.length - 1] - row) > 1) continue;
          next.push(p.concat([row]));
        }
      });
      paths = next;
    }
    var flat = [], rest = [];
    paths.forEach(function (p) {
      var isFlat = p.every(function (x) { return x === p[0]; });
      (isFlat ? flat : rest).push(p);
    });
    rest.sort(function (a, b) {
      var wig = function (p) { var s = 0; for (var i = 1; i < p.length; i++) s += Math.abs(p[i] - p[i - 1]); return s; };
      return wig(a) - wig(b) || a.join().localeCompare(b.join());
    });
    return flat.concat(rest).slice(0, max);
  }

  /* ---------- reels ---------- */
  /* Fixed reel strips: the layout is generated from a seed so every player and
     every session sees the same reels, the way a real machine's strips are fixed. */
  function rng32(seed) {
    var a = seed >>> 0;
    return function () {
      a += 0x6D2B79F5;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function strip(counts, seed) {
    var rnd = rng32(seed === undefined ? 12345 : seed);
    var pool = [];
    Object.keys(counts).forEach(function (s) { for (var i = 0; i < counts[s]; i++) pool.push(s); });
    var out = [], guard = 0;
    while (pool.length) {
      var i = Math.floor(rnd() * pool.length);
      if (out.length && out[out.length - 1] === pool[i] && pool.length > 1 && guard++ < 40) continue;
      guard = 0;
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  }

  function spinStops(game, reels) {
    return (reels || game.reels).map(function (r) { return C.randInt(r.length); });
  }
  function gridAt(game, stops, reels) {
    return (reels || game.reels).map(function (reel, i) {
      var out = [];
      for (var row = 0; row < game.rows; row++) out.push(reel[(stops[i] + row) % reel.length]);
      return out;
    });
  }
  /* A strip that carries the boosted symbol in stacks, the way a free-game
     reel set does. BOOST is a placeholder swapped for the chosen symbol. */
  function stackStrip(counts, seed, token, blocks, blockSize) {
    var rnd = rng32(seed === undefined ? 999 : seed);
    var base = strip(counts, seed);
    var out = base.slice(), i;
    for (i = 0; i < blocks; i++) {
      var at = Math.floor(rnd() * out.length);
      var run = [];
      for (var j = 0; j < blockSize; j++) run.push(token);
      out = out.slice(0, at).concat(run, out.slice(at));
    }
    return out;
  }
  /* pick one entry from a table of { w: weight, ... } */
  function weighted(table) {
    var sum = 0, i;
    for (i = 0; i < table.length; i++) sum += table[i].w;
    var roll = Math.random() * sum, acc = 0;
    for (i = 0; i < table.length; i++) {
      acc += table[i].w;
      if (roll < acc) return table[i];
    }
    return table[table.length - 1];
  }
  function countIn(grid, sym) {
    var n = 0;
    grid.forEach(function (reel) { reel.forEach(function (s) { if (s === sym) n++; }); });
    return n;
  }
  function positionsOf(grid, sym) {
    var out = [];
    grid.forEach(function (reel, x) { reel.forEach(function (s, y) { if (s === sym) out.push([x, y]); }); });
    return out;
  }

  /* ---------- line wins ---------- */
  function evalLines(game, grid, lineCount, lineBet) {
    var wins = [], total = 0;
    var candidates = Object.keys(game.pays);
    game.lines.slice(0, lineCount).forEach(function (path, li) {
      var best = null;
      candidates.forEach(function (sym) {
        if (game.special.indexOf(sym) >= 0) return;
        var n = 0;
        for (var i = 0; i < path.length; i++) {
          var s = grid[i][path[i]];
          if (s === sym || (game.wild && s === game.wild)) n++; else break;
        }
        var table = game.pays[sym];
        if (!table || !table[n]) return;
        var amount = table[n] * lineBet;
        if (!best || amount > best.amount) best = { line: li, sym: sym, count: n, amount: amount, path: path.slice(0, n) };
      });
      if (best) { total += best.amount; wins.push(best); }
    });
    return { wins: wins, total: total };
  }

  /* ---------- hold and spin ---------- */
  /* Coins lock in place and you get three respins, which reset every time a new
     coin lands. Fill all fifteen positions for the Grand. */
  function holdAndSpin(game, totalBet, seedCoins, jp) {
    var slots = game.reels.length * game.rows;
    var board = new Array(slots).fill(null), filled = 0, i;
    (seedCoins || []).forEach(function (p) {
      var idx = p[0] * game.rows + p[1];
      if (board[idx] === null) { board[idx] = coinValue(game, totalBet, jp); filled++; }
    });
    var respins = 3, steps = [{ board: board.slice(), respins: respins, landed: (seedCoins || []).length }];
    while (respins > 0 && filled < slots) {
      var landed = 0;
      for (i = 0; i < slots; i++) {
        if (board[i] !== null) continue;
        if (Math.random() < game.hold.landChance) { board[i] = coinValue(game, totalBet, jp); filled++; landed++; }
      }
      respins = landed ? 3 : respins - 1;
      steps.push({ board: board.slice(), respins: respins, landed: landed });
    }
    var total = board.reduce(function (a, v) { return a + (v ? v.amount : 0); }, 0);
    var jackpots = [];
    board.forEach(function (v) { if (v && v.jackpot) jackpots.push({ tier: v.jackpot, amount: v.amount }); });
    var grand = null;
    if (filled === slots) {
      grand = meterValue(game, 'grand', totalBet, jp);
      total += grand;
      jackpots.push({ tier: 'grand', amount: grand });
    }
    return { board: board, steps: steps, total: total, grand: grand, filled: filled, jackpots: jackpots };
  }
  /* What a jackpot is worth right now. The meters are kept as multiples of the
     total bet, not as dollars, so the odds are the same whatever you bet and
     the displayed figure still climbs every spin. */
  function meterValue(game, tier, totalBet, jp) {
    var mult = (jp && jp[tier]) ? jp[tier] : game.jackpots.seed[tier];
    return Math.round(mult * totalBet);
  }
  function coinValue(game, totalBet, jp) {
    var t = weighted(game.hold.coins);
    if (t.jackpot) {
      return { label: t.label, amount: meterValue(game, t.jackpot, totalBet, jp), jackpot: t.jackpot };
    }
    return { label: t.label || (t.mult + 'x'), amount: Math.round(t.mult * totalBet), jackpot: null };
  }

  /* ---------- the latke round ----------
     Pans fly past, you pick one, a latke lands in it. Every pick pays until a
     pan comes up empty; a jackpot pan ends the round too. */
  function latkeRound(game, totalBet, jp) {
    var picks = [], total = 0, jackpots = [], guard = 0;
    while (guard++ < 60) {
      var r = weighted(game.latke.reveals);
      if (r.empty) { picks.push({ empty: true }); break; }
      if (r.jackpot) {
        var amt = meterValue(game, r.jackpot, totalBet, jp);
        picks.push({ jackpot: r.jackpot, label: r.label, amount: amt });
        jackpots.push({ tier: r.jackpot, amount: amt });
        total += amt;
        break;
      }
      var v = Math.round(r.mult * totalBet);
      picks.push({ mult: r.mult, amount: v });
      total += v;
    }
    return { picks: picks, total: total, jackpots: jackpots };
  }

  /* ---------- one complete spin ---------- */
  /* Buy a feature outright: no reels, just the feature, priced in the game
     config. The meters still take their cut of the purchase. */
  function buyFeature(game, which, lineCount, lineBet, jp) {
    var totalBet = lineCount * lineBet;
    var out = { stops: spinStops(game), grid: null, wins: [], lineTotal: 0, total: 0,
      totalBet: totalBet, features: [], jackpots: [], bought: which };
    if (which === 'hold') {
      var cells = game.reels.length * game.rows, pool = [], i;
      for (i = 0; i < cells; i++) pool.push(i);
      var seeds = [], want = game.hold.trigger + (Math.random() < 0.35 ? 1 : 0);
      while (seeds.length < want && pool.length) {
        var at = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        seeds.push([Math.floor(at / game.rows), at % game.rows]);
      }
      var hs = holdAndSpin(game, totalBet, seeds, jp);
      out.hold = hs;
      out.total += hs.total;
      hs.jackpots.forEach(function (j) { out.jackpots.push(j); });
      out.features.push('hold');
    } else if (which === 'latke') {
      var lr = latkeRound(game, totalBet, jp);
      lr.pans = game.latke.trigger;
      out.latke = lr;
      out.total += lr.total;
      lr.jackpots.forEach(function (j) { out.jackpots.push(j); });
      out.features.push('latke');
    } else {
      var spins = game.free.spins[game.free.trigger];
      var fg = freeGames(game, spins, lineCount, lineBet, jp, game.free.trigger);
      out.free = fg;
      out.total += fg.total;
      fg.jackpots.forEach(function (j) { out.jackpots.push(j); });
      out.features.push('free');
    }
    return out;
  }

  function play(game, lineCount, lineBet, jp) {
    var totalBet = lineCount * lineBet;
    var stops = spinStops(game), grid = gridAt(game, stops);
    var res = evalLines(game, grid, lineCount, lineBet);
    var out = { stops: stops, grid: grid, wins: res.wins, lineTotal: res.total, total: res.total,
      totalBet: totalBet, features: [], jackpots: [] };

    if (game.coin) {
      var coins = positionsOf(grid, game.coin);
      if (coins.length >= game.hold.trigger) {
        var hs = holdAndSpin(game, totalBet, coins, jp);
        out.hold = hs;
        out.total += hs.total;
        hs.jackpots.forEach(function (j) { out.jackpots.push(j); });
        out.features.push('hold');
      }
    }
    if (game.bonus) {
      var pans = countIn(grid, game.bonus);
      if (pans >= game.latke.trigger) {
        var lr = latkeRound(game, totalBet, jp);
        out.latke = lr;
        out.latke.pans = pans;
        out.total += lr.total;
        lr.jackpots.forEach(function (j) { out.jackpots.push(j); });
        out.features.push('latke');
      }
    }
    if (game.scatter) {
      var sc = countIn(grid, game.scatter);
      if (game.scatterPays && game.scatterPays[sc]) {
        out.scatterPay = game.scatterPays[sc] * totalBet;
        out.scatterCount = sc;
        out.total += out.scatterPay;
      }
      if (sc >= game.free.trigger) {
        var spins = game.free.spins[sc] || game.free.spins[game.free.trigger];
        var fg = freeGames(game, spins, lineCount, lineBet, jp, sc);
        out.free = fg;
        out.total += fg.total;
        fg.jackpots.forEach(function (j) { out.jackpots.push(j); });
        out.features.push('free');
      }
    }
    return out;
  }
  /* ---------- free games ----------
     The ark opens and a scroll picks one symbol to boost for the round. That
     symbol lands in stacks on its own reel set, a full stack turns the reel
     wild, candles come thicker and trigger the hold and spin one candle early,
     and the round can never pay nothing. */
  function freeGames(game, spins, lineCount, lineBet, jp, trigCount) {
    var totalBet = lineCount * lineBet;
    var pick = weighted(game.free.picks);
    var boost = pick.sym;
    var count = Math.max(game.free.minSpins, spins + (pick.spinAdj || 0));
    var rounds = [], total = 0, jackpots = [], holds = 0, retriggers = 0;
    var left = count, i = 0;
    while (i < left && i < 400) {
      var stops = spinStops(game, game.freeReels);
      var raw = gridAt(game, stops, game.freeReels);
      var grid = raw.map(function (col) {
        return col.map(function (sym) { return sym === game.free.token ? boost : sym; });
      });
      var wildReels = [];
      grid.forEach(function (col, x) {
        if (col.every(function (s) { return s === boost; })) wildReels.push(x);
      });
      var read = grid.map(function (col, x) {
        return wildReels.indexOf(x) >= 0 ? col.map(function () { return game.wild; }) : col;
      });
      var r = evalLines(game, read, lineCount, lineBet);
      var amount = r.total * game.free.multiplier;
      var coins = positionsOf(grid, game.coin);
      var hold = null;
      if (coins.length >= game.free.holdTrigger) {
        hold = holdAndSpin(game, totalBet, coins, jp);
        amount += hold.total;
        hold.jackpots.forEach(function (j) { jackpots.push(j); });
        holds++;
      }
      var sc = countIn(grid, game.scatter);
      var retrigger = sc >= game.free.trigger;
      if (retrigger) { left += game.free.retrigger; retriggers++; }
      total += amount;
      /* `of` is the round total as it stands on this spin, which grows when a
         retrigger lands, so the counter never reads "10 of 5". */
      rounds.push({ stops: stops, grid: grid, read: read, wins: r.wins, amount: amount,
        hold: hold, wildReels: wildReels, retrigger: retrigger, index: i + 1, of: left });
      i++;
    }
    var floor = Math.round((game.scatterPays[trigCount] || game.scatterPays[game.free.trigger]) * totalBet);
    var topUp = 0;
    if (total < floor) { topUp = floor - total; total = floor; }
    return { spins: count, awarded: left, played: i, rounds: rounds, total: total, multiplier: game.free.multiplier,
      boost: boost, pickLabel: pick.label || boost, jackpots: jackpots, holds: holds,
      retriggers: retriggers, topUp: topUp, floor: floor };
  }

  var api = { buildLines: buildLines, strip: strip, stackStrip: stackStrip, rng32: rng32, spinStops: spinStops,
    gridAt: gridAt, countIn: countIn, positionsOf: positionsOf, evalLines: evalLines, holdAndSpin: holdAndSpin,
    latkeRound: latkeRound, buyFeature: buyFeature, play: play, freeGames: freeGames, weighted: weighted, meterValue: meterValue };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Slots = api;
})(this);
