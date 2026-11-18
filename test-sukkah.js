/* Sukkah Nights: the reels, the ways, the build, the guests and the wheels.

   The trigger rates are not sampled here, they are counted. The strips are
   fixed, so every reel has at most seventy stop positions, each showing a
   known number of lulavim and etrogim, and convolving the five gives the exact
   chance of a build or a wheel out of all 1.17 billion stop combinations.
   Everything else is checked against that.

   Run with: node test-sukkah.js */
global.crypto = require('crypto').webcrypto;
const C = require('./common.js'), S = require('./slots.js'), K = require('./sukkah.js');
const assert = require('assert');
let n = 0;
const eq = (a, b, m) => { n++; assert.deepStrictEqual(a, b, m); };
const ok = (a, m) => { n++; assert.ok(a, m); };
const near = (a, b, tol, m) => {
  n++;
  assert.ok(Math.abs(a - b) <= tol, (m || '') + ' got ' + a + ' want ' + b + ' +-' + tol);
};
const BET = 10000;

/* ---------------- the reels ---------------- */
{
  eq(K.reels.length, 5, 'five reels');
  K.reels.forEach((r, i) => {
    ok(r.length >= 50 && r.length <= 90, 'reel ' + i + ' is a sensible length, ' + r.length);
    ok(r.indexOf(K.BUILD) >= 0, 'reel ' + i + ' carries the lulav');
  });
  /* the first reel has no wild and no etrog, so a wheel needs the other four
     and a wild never starts a way on its own */
  eq(K.reels[0].indexOf(K.WILD), -1, 'no wind on reel one');
  eq(K.reels[0].indexOf(K.SAW), -1, 'no etrog on reel one');
  /* the pitom lives on the middle reel alone */
  K.reels.forEach((r, i) => {
    const golds = r.filter(s => s === K.GOLD).length;
    eq(golds, i === 2 ? 1 : 0, 'pitom count on reel ' + i);
  });
  /* every paying symbol is reachable on every reel */
  K.SYMS.forEach(sym => {
    K.reels.forEach((r, i) => ok(r.indexOf(sym) >= 0, sym + ' is on reel ' + i));
  });
}

/* ---------------- the ways ---------------- */
const unit = BET / 25;
const col = s => [s, s, s];
{
  /* a clean five of a kind on one way */
  const grid = [col('wheat'), col('wheat'), col('wheat'), col('wheat'), col('wheat')];
  const r = K.evalWays(grid, 3, unit);
  eq(r.wins.length, 1, 'one symbol paid');
  eq(r.wins[0].ways, 243, 'three high on five reels is 243 ways');
  eq(r.wins[0].amount, Math.round(K.PAYS.wheat[5] * unit * 243), 'and it pays every one of them');

  /* a single line of three, nothing else */
  const g2 = [['wheat', 'olive', 'olive'], ['wheat', 'olive', 'olive'], ['wheat', 'olive', 'olive'],
    ['fig', 'fig', 'fig'], ['fig', 'fig', 'fig']];
  const r2 = K.evalWays(g2, 3, unit);
  const wheatWin = r2.wins.filter(w => w.sym === 'wheat')[0];
  eq(wheatWin.count, 3, 'wheat ran three reels');
  eq(wheatWin.ways, 1, 'one of each');
  const oliveWin = r2.wins.filter(w => w.sym === 'olive')[0];
  eq(oliveWin.ways, 8, 'olive had two on each of three reels');
  ok(!r2.wins.some(w => w.sym === 'fig'), 'fig started on reel four so it pays nothing');

  /* the wind stands in for anything */
  const g3 = [col('sukkah'), col(K.WILD), col('sukkah'), ['fig', 'fig', 'fig'], col('fig')];
  const r3 = K.evalWays(g3, 3, unit);
  const sk = r3.wins.filter(w => w.sym === 'sukkah')[0];
  eq(sk.count, 3, 'the wind carried the sukkah through reel two');
  eq(sk.ways, 27);
  /* and a way has to start on reel one */
  const g4 = [col('olive'), col('fig'), col('fig'), col('fig'), col('fig')];
  ok(!K.evalWays(g4, 3, unit).wins.some(w => w.sym === 'fig'), 'four from reel two is nothing');
  /* two of a kind never pays */
  const g5 = [col('sukkah'), col('sukkah'), col('wheat'), col('olive'), col('fig')];
  ok(!K.evalWays(g5, 3, unit).wins.some(w => w.sym === 'sukkah'), 'two of a kind pays nothing');
  /* longer is always worth more than shorter, per way */
  K.SYMS.forEach(sym => {
    const p = K.PAYS[sym];
    ok(p[5] > p[4] && p[4] > p[3], sym + ' pays more the further it runs');
  });
}

/* ---------------- exactly how often a feature comes ---------------- */
const RATE = (() => {
  let dist = new Map([['0,0,0', 1]]);
  let denom = 1;
  K.reels.forEach(reel => {
    const per = new Map();
    for (let s = 0; s < reel.length; s++) {
      let h = 0, e = 0, g = 0;
      for (let y = 0; y < 3; y++) {
        const sym = reel[(s + y) % reel.length];
        if (sym === K.BUILD) h++; else if (sym === K.SAW) e++; else if (sym === K.GOLD) g++;
      }
      const k = h + ',' + e + ',' + g;
      per.set(k, (per.get(k) || 0) + 1);
    }
    const next = new Map();
    for (const [a, ca] of dist) {
      const [h1, e1, g1] = a.split(',').map(Number);
      for (const [b, cb] of per) {
        const [h2, e2, g2] = b.split(',').map(Number);
        const k = (h1 + h2) + ',' + (e1 + e2) + ',' + (g1 + g2);
        next.set(k, (next.get(k) || 0) + ca * cb);
      }
    }
    dist = next;
    denom *= reel.length;
  });
  let build = 0, wheel = 0, sup = 0;
  for (const [k, c] of dist) {
    const [h, e, g] = k.split(',').map(Number);
    if (e + g >= K.SAW_TRIGGER) { wheel += c; if (g >= 1) sup += c; }
    else if (h >= K.BUILD_TRIGGER) build += c;
  }
  return { denom, build: build / denom, plain: (wheel - sup) / denom, super: sup / denom };
})();
{
  ok(RATE.denom > 1e9, 'over a billion stop combinations, got ' + RATE.denom);
  const one = x => 1 / x;
  near(one(RATE.build), 150, 25, 'a build about every hundred and fifty spins');
  near(one(RATE.plain + RATE.super), 160, 30, 'a wheel about every hundred and sixty');
  near(one(RATE.super), 750, 200, 'the pitom wheel about once in seven hundred and fifty');
  near(one(RATE.build + RATE.plain + RATE.super), 77, 12, 'a feature of some kind every seventy odd');
  ok(RATE.super < RATE.plain / 2, 'the pair of wheels is the rarer way in');
}

/* ---------------- putting a sukkah up ---------------- */
{
  /* a lulav on an empty square frames it, on a frame it walls it, on a walled
     one it roofs it, and a finished one passes the night to whoever is behind */
  const b = K.buildRound({ rows: 3, nights: 0, landChance: 0, seed: [[0, 0]], seedTier: K.FRAME });
  eq(b.board[0], K.FRAME, 'the seed went up as a frame');
  eq(b.board.filter(v => v > 0).length, 1, 'and nothing else did');

  const b2 = K.buildRound({ rows: 3, nights: 6, landChance: 1, seed: [], seedTier: K.FRAME });
  ok(b2.board.every(v => v >= 0 && v <= K.SCHACH), 'nothing goes past a finished sukkah');
  ok(b2.board.every(v => v === K.SCHACH), 'a lulav on every square every night finishes the street');
  eq(b2.board.length, 15, 'three rows is fifteen squares');

  /* three in a night buys another night, and the cap holds */
  const b3 = K.buildRound({ rows: 3, nights: 6, landChance: 1, seed: [], seedTier: K.FRAME });
  eq(b3.extra, 6, 'the extra nights cap out');
  eq(b3.nights, 12, 'six and six');
  const b4 = K.buildRound({ rows: 3, nights: 6, landChance: 0, seed: [], seedTier: K.FRAME });
  eq(b4.extra, 0, 'a quiet night earns nothing');
  eq(b4.played, 6, 'and you still get your six');

  /* the big sukkah is six rows */
  const b5 = K.buildRound({ rows: 6, nights: 2, landChance: 0, seed: [], seedTier: K.FRAME });
  eq(b5.board.length, 30, 'the super grid is thirty squares');

  /* the log is a full record: one entry for the start and one a night */
  const b6 = K.buildRound({ rows: 3, nights: 6, landChance: 0.1, seed: [[1, 1]], seedTier: K.FRAME });
  eq(b6.log.length, b6.played + 1, 'a line for the start and a line a night');
  ok(b6.log[b6.log.length - 1].board.every((v, i) => v === b6.board[i]), 'and it ends where the board did');
}

/* ---------------- the guests ---------------- */
{
  const board = [K.FRAME, K.WALLS, K.SCHACH, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const g = K.ushpizin(board, BET, null, 3);
  eq(g.waves.length, 3, 'three waves of guests');
  eq(g.waves.map(w => w.name), ['frame', 'walls', 'schach'], 'frames first, finished last');
  eq(g.waves[0].cells.length, 1); eq(g.waves[1].cells.length, 1); eq(g.waves[2].cells.length, 1);
  eq(g.built, 3, 'three sukkot on the street');
  eq(g.full, null, 'and the street is not finished');
  /* the total is the sum of what was in them, to the cent */
  const sum = g.values.reduce((a, v) => a + (v ? v.amount : 0), 0);
  eq(g.total, sum, 'the night totals exactly what the guests found');
  g.values.forEach((v, i) => {
    if (board[i]) { ok(v && v.amount > 0, 'square ' + i + ' held something'); eq(v.tier, board[i]); }
    else eq(v, null, 'an empty square holds nothing');
  });

  /* every square finished is the Shalom, and merely filling them is not */
  const allSchach = new Array(15).fill(K.SCHACH);
  const gf = K.ushpizin(allSchach, BET, null, 3);
  eq(gf.full, K.SEED.shalom * BET, 'a finished street is the Shalom');
  ok(gf.jackpots.some(j => j.tier === 'shalom'), 'and it is on the receipt');
  const allFrames = new Array(15).fill(K.FRAME);
  eq(K.ushpizin(allFrames, BET, null, 3).full, null, 'fifteen bare frames is not the Shalom');
  const mixed = new Array(15).fill(K.SCHACH); mixed[7] = K.WALLS;
  eq(K.ushpizin(mixed, BET, null, 3).full, null, 'one unroofed sukkah and it does not count');
}

/* ---------------- what is inside them ---------------- */
{
  /* a frame can never hold a jackpot; only a finished one can hold the Shalom */
  ok(K.FILL[1].every(r => !r.jackpot), 'there is no jackpot in a bare frame');
  ok(!K.FILL[2].some(r => r.jackpot === 'hoshana' || r.jackpot === 'shalom'),
    'the two big ones are not in a walled sukkah');
  ok(K.FILL[3].some(r => r.jackpot === 'shalom'), 'the Shalom is in a finished one');
  /* and on average a better sukkah is worth more */
  const avg = tier => {
    let t = 0;
    for (let i = 0; i < 40000; i++) t += K.fillOne(tier, BET, null).amount;
    return t / 40000 / BET;
  };
  const a1 = avg(1), a2 = avg(2), a3 = avg(3);
  ok(a2 > a1 * 1.5, 'walls beat a frame, ' + a1.toFixed(2) + ' then ' + a2.toFixed(2));
  ok(a3 > a2 * 1.5, 'schach beats walls, ' + a3.toFixed(2));
  /* the jackpots climb */
  ok(K.SEED.chai < K.SEED.simcha && K.SEED.simcha < K.SEED.hoshana && K.SEED.hoshana < K.SEED.shalom,
    'the four jackpots are in order');
  eq(K.jackpot('shalom', BET, null), K.SEED.shalom * BET, 'a jackpot is a multiple of the whole bet');
  eq(K.jackpot('chai', BET, { chai: 25 }), 25 * BET, 'and the meter moves it');
}

/* ---------------- the wheels ---------------- */
{
  const seen = {}, sup = {};
  for (let i = 0; i < 6000; i++) {
    seen[K.spinWheel(false, BET, null, [[1, 1], [2, 1], [3, 1]]).label] = 1;
    sup[K.spinWheel(true, BET, null, [[1, 1], [2, 1], [3, 1]]).label] = 1;
  }
  K.WHEEL.forEach(seg => ok(seen[seg.label], 'the wheel can land on ' + seg.label));
  K.SUPER_WHEEL.forEach(seg => ok(sup[seg.label], 'the pair of wheels can land on ' + seg.label));
  /* the super version builds on the big grid and the plain one does not */
  for (let i = 0; i < 400; i++) {
    const r = K.spinWheel(true, BET, null, [[1, 1], [2, 1], [3, 1]]);
    if (r.build) { eq(r.build.board.length, 30, 'the pitom opens the sukkah to six rows'); break; }
  }
  for (let i = 0; i < 400; i++) {
    const r = K.spinWheel(false, BET, null, [[1, 1], [2, 1], [3, 1]]);
    if (r.build) { eq(r.build.board.length, 15, 'the plain wheel stays at three rows'); break; }
  }
  /* the Schach mode really does start finished */
  const st = K.modeSetup('schach', false, [[1, 1], [2, 1]], 3);
  eq(st.seedTier, K.SCHACH, 'Schach Nights starts with the roof on');
  const et = K.modeSetup('etrog', false, [[1, 1]], 3);
  ok(et.roam > 0, 'Etrog Nights has etrogim still moving about');
  /* a wheel that pays a jackpot pays the jackpot and nothing else */
  let checked = 0;
  for (let i = 0; i < 40000 && checked < 3; i++) {
    const r = K.spinWheel(false, BET, null, [[1, 1], [2, 1], [3, 1]]);
    if (r.jackpots.length === 1 && !r.build) {
      eq(r.total, r.jackpots[0].amount, 'the jackpot segment pays its jackpot');
      checked++;
    }
  }
  ok(checked > 0, 'saw the wheel pay a jackpot outright');
}

/* ---------------- a spin end to end ---------------- */
{
  /* the money on the ticket is the ways plus whatever the feature paid */
  for (let i = 0; i < 30000; i++) {
    const o = K.play({ totalBet: BET });
    const feature = (o.build ? o.build.guests.total : 0) + (o.wheel ? o.wheel.total : 0);
    if (o.total !== o.lineTotal + feature) {
      assert.fail('spin paid ' + o.total + ' but the parts came to ' + (o.lineTotal + feature));
    }
    ok(!(o.build && o.wheel), 'a spin is one feature or the other, never both');
  }
  n++;
  /* six lulavim with no etrog is the plain build, and three etrogim is a wheel */
  const g = { reels: K.reels, rows: 3 };
  let sawBuild = false, sawWheel = false, sawSuper = false;
  for (let i = 0; i < 300000 && !(sawBuild && sawWheel && sawSuper); i++) {
    const stops = S.spinStops(g, K.reels);
    const grid = S.gridAt(g, stops, K.reels);
    const o = K.play({ totalBet: BET, stops: stops });
    const hats = S.countIn(grid, K.BUILD), saws = S.countIn(grid, K.SAW) + S.countIn(grid, K.GOLD);
    if (saws >= 3) { ok(!!o.wheel, 'three etrogim spun the wheel'); sawWheel = true;
      if (S.countIn(grid, K.GOLD) && o.wheel.superMode) sawSuper = true; }
    else if (hats >= 6) { ok(!!o.build, 'six lulavim built'); sawBuild = true; }
    else { ok(!o.build && !o.wheel, 'neither, so no feature'); }
  }
  ok(sawBuild, 'saw a build happen');
  ok(sawWheel, 'saw a wheel happen');
  ok(sawSuper, 'saw the pitom wheel happen');
}

/* ---------------- the hold ---------------- */
{
  /* The base game and the body of each bonus settle quickly. The jackpots do
     not, so they are counted separately and priced in, rather than waited for. */
  const BONUS = 120000;
  function body(kind) {
    let plain = 0, jp = {};
    for (let i = 0; i < BONUS; i++) {
      let r;
      if (kind === 'build') {
        const seed = [];
        while (seed.length < 6) {
          const x = C.randInt(5), y = C.randInt(3);
          if (!seed.some(p => p[0] === x && p[1] === y)) seed.push([x, y]);
        }
        const b = K.buildRound({ rows: 3, nights: 6, landChance: 0.055, seed, seedTier: K.FRAME });
        r = K.ushpizin(b.board, BET, null, 3);
      } else {
        r = K.spinWheel(kind === 'super', BET, null, [[1, 1], [2, 1], [3, 1]]);
      }
      let jpAmt = 0;
      (r.jackpots || []).forEach(j => { jp[j.tier] = (jp[j.tier] || 0) + 1; jpAmt += j.amount; });
      plain += r.total - jpAmt;
      ok(r.total >= 0, 'a bonus never pays out less than nothing');
    }
    let v = plain / BONUS / BET;
    const rates = {};
    Object.entries(jp).forEach(([tier, hits]) => {
      v += (hits / BONUS) * K.SEED[tier];
      rates[tier] = hits / BONUS;
    });
    return { ev: v, rates };
  }
  let ways = 0;
  const WAYS = 300000, g = { reels: K.reels, rows: 3 };
  for (let i = 0; i < WAYS; i++) {
    ways += K.evalWays(S.gridAt(g, S.spinStops(g, K.reels), K.reels), 3, BET / 25).total;
  }
  const waysRtp = ways / (WAYS * BET);
  const parts = { build: body('build'), plain: body('plain'), super: body('super') };
  const rtp = waysRtp
    + parts.build.ev * RATE.build + parts.plain.ev * RATE.plain + parts.super.ev * RATE.super;

  const jpRate = {};
  [['build', RATE.build], ['plain', RATE.plain], ['super', RATE.super]].forEach(([k, p]) => {
    Object.entries(parts[k].rates).forEach(([tier, r]) => { jpRate[tier] = (jpRate[tier] || 0) + r * p; });
  });

  near(rtp, 0.96, 0.02, 'the game holds about four per cent');
  near(waysRtp, 0.245, 0.03, 'the reels on their own pay about a quarter');
  ok(parts.super.ev > parts.plain.ev * 1.5,
    'the pitom wheel is worth a lot more than the plain one, ' + parts.super.ev.toFixed(0)
    + 'x against ' + parts.plain.ev.toFixed(0) + 'x');
  ok(parts.build.ev > 25 && parts.build.ev < 75, 'a build is worth about fifty times the bet, got ' + parts.build.ev.toFixed(1));
  /* the four jackpots come in the right order and at sane distances */
  const order = ['chai', 'simcha', 'hoshana', 'shalom'];
  for (let i = 1; i < order.length; i++) {
    ok(jpRate[order[i]] < jpRate[order[i - 1]],
      order[i] + ' is rarer than ' + order[i - 1]);
  }
  ok(1 / jpRate.shalom > 25000 && 1 / jpRate.shalom < 120000,
    'the Shalom comes up once in tens of thousands of spins, got 1 in ' + Math.round(1 / jpRate.shalom));
  ok(1 / jpRate.chai < 2500, 'the Chai is a regular visitor, 1 in ' + Math.round(1 / jpRate.chai));

  console.log('  RTP ' + (100 * rtp).toFixed(2) + '% (reels ' + (100 * waysRtp).toFixed(1)
    + '%, build ' + (100 * parts.build.ev * RATE.build).toFixed(1)
    + '%, wheel ' + (100 * parts.plain.ev * RATE.plain).toFixed(1)
    + '%, pitom ' + (100 * parts.super.ev * RATE.super).toFixed(1) + '%)');
  console.log('  a feature 1 in ' + (1 / (RATE.build + RATE.plain + RATE.super)).toFixed(0)
    + ' | build 1 in ' + (1 / RATE.build).toFixed(0)
    + ' | wheel 1 in ' + (1 / (RATE.plain + RATE.super)).toFixed(0)
    + ' | pitom 1 in ' + (1 / RATE.super).toFixed(0));
  console.log('  jackpots ' + order.map(t => t + ' 1 in ' + Math.round(1 / jpRate[t])).join(' | '));
}

console.log('sukkah: all passed ' + n + ' asserts');
