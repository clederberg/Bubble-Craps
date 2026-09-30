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

  function spinStops(game) {
    return game.reels.map(function (r) { return C.randInt(r.length); });
  }
  function gridAt(game, stops) {
    return game.reels.map(function (reel, i) {
      var out = [];
      for (var row = 0; row < game.rows; row++) out.push(reel[(stops[i] + row) % reel.length]);
      return out;
    });
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
  function holdAndSpin(game, totalBet, seedCoins) {
    var slots = game.reels.length * game.rows;
    var board = new Array(slots).fill(null), filled = 0, i;
    (seedCoins || []).forEach(function (p) {
      var idx = p[0] * game.rows + p[1];
      if (board[idx] === null) { board[idx] = coinValue(game, totalBet); filled++; }
    });
    var respins = 3, steps = [{ board: board.slice(), respins: respins, landed: (seedCoins || []).length }];
    while (respins > 0 && filled < slots) {
      var landed = 0;
      for (i = 0; i < slots; i++) {
        if (board[i] !== null) continue;
        if (Math.random() < game.hold.landChance) { board[i] = coinValue(game, totalBet); filled++; landed++; }
      }
      respins = landed ? 3 : respins - 1;
      steps.push({ board: board.slice(), respins: respins, landed: landed });
    }
    var total = board.reduce(function (a, v) { return a + (v ? v.amount : 0); }, 0);
    var grand = null;
    if (filled === slots) { grand = Math.round(game.hold.jackpots.grand * totalBet); total += grand; }
    return { board: board, steps: steps, total: total, grand: grand, filled: filled };
  }
  function coinValue(game, totalBet) {
    var table = game.hold.coins, roll = Math.random(), acc = 0;
    for (var i = 0; i < table.length; i++) {
      acc += table[i].w;
      if (roll < acc) {
        var t = table[i];
        return { label: t.label || (t.mult + 'x'), amount: Math.round(t.mult * totalBet), jackpot: t.jackpot || null };
      }
    }
    var last = table[table.length - 1];
    return { label: last.label || (last.mult + 'x'), amount: Math.round(last.mult * totalBet), jackpot: last.jackpot || null };
  }

  /* ---------- one complete spin ---------- */
  function play(game, lineCount, lineBet) {
    var totalBet = lineCount * lineBet;
    var stops = spinStops(game), grid = gridAt(game, stops);
    var res = evalLines(game, grid, lineCount, lineBet);
    var out = { stops: stops, grid: grid, wins: res.wins, lineTotal: res.total, total: res.total, totalBet: totalBet, features: [] };

    if (game.coin) {
      var coins = positionsOf(grid, game.coin);
      if (coins.length >= game.hold.trigger) {
        var hs = holdAndSpin(game, totalBet, coins);
        out.hold = hs;
        out.total += hs.total;
        out.features.push('hold');
      }
    }
    if (game.scatter) {
      var sc = countIn(grid, game.scatter);
      if (game.scatterPays && game.scatterPays[sc]) out.total += game.scatterPays[sc] * totalBet;
      if (sc >= game.free.trigger) {
        var spins = game.free.spins[sc] || game.free.spins[game.free.trigger];
        var fg = freeGames(game, spins, lineCount, lineBet);
        out.free = fg;
        out.total += fg.total;
        out.features.push('free');
      }
    }
    return out;
  }
  function freeGames(game, spins, lineCount, lineBet) {
    var rounds = [], total = 0;
    for (var i = 0; i < spins; i++) {
      var stops = spinStops(game), grid = gridAt(game, stops);
      var r = evalLines(game, grid, lineCount, lineBet);
      var amount = r.total * game.free.multiplier;
      total += amount;
      rounds.push({ stops: stops, grid: grid, wins: r.wins, amount: amount });
    }
    return { spins: spins, rounds: rounds, total: total, multiplier: game.free.multiplier };
  }

  var api = { buildLines: buildLines, strip: strip, rng32: rng32, spinStops: spinStops, gridAt: gridAt, countIn: countIn,
    positionsOf: positionsOf, evalLines: evalLines, holdAndSpin: holdAndSpin, play: play, freeGames: freeGames };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Slots = api;
})(this);
