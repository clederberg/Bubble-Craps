global.crypto = require('crypto').webcrypto;
const C = require('./common.js'), S = require('./slots.js'), G = require('./games.js'), assert = require('assert');
let n = 0; const eq = (a, b, m) => { n++; assert.deepStrictEqual(a, b, m); };

// paylines
const lines = S.buildLines(5, 3, 50);
eq(lines.length, 50);
eq(lines.slice(0, 3), [[0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2]], 'horizontals come first');
eq(lines.every(p => p.every((r, i) => i === 0 || Math.abs(r - p[i-1]) <= 1)), true, 'lines never jump two rows');
eq(new Set(lines.map(p => p.join())).size, 50, 'no duplicate lines');

// line evaluation
const g = G.lights();
const grid = sym => sym.map(col => col.slice());
let r = S.evalLines(g, grid([['MENORAH','x','x'],['MENORAH','x','x'],['MENORAH','x','x'],['x','x','x'],['x','x','x']]), 1, 100);
eq(r.total, g.pays.MENORAH[3] * 100, 'three menorahs pay the paytable line');
r = S.evalLines(g, grid([['MENORAH','x','x'],['WILD','x','x'],['MENORAH','x','x'],['MENORAH','x','x'],['x','x','x']]), 1, 100);
eq(r.total, g.pays.MENORAH[4] * 100, 'a wild fills in for four of a kind');
r = S.evalLines(g, grid([['WILD','x','x'],['WILD','x','x'],['WILD','x','x'],['x','x','x'],['x','x','x']]), 1, 100);
eq(r.total, g.pays.WILD[3] * 100, 'three wilds pay the wild line');
r = S.evalLines(g, grid([['CANDLE','x','x'],['CANDLE','x','x'],['CANDLE','x','x'],['CANDLE','x','x'],['CANDLE','x','x']]), 50, 100);
eq(r.total, 0, 'candles never pay as a line');
r = S.evalLines(g, grid([['MENORAH','x','x'],['MENORAH','x','x'],['MENORAH','x','x'],['x','x','x'],['x','x','x']]), 50, 100);
eq(r.wins.every(w => w.sym === 'MENORAH' && w.count === 3), true, 'every line through those cells pays');
r = S.evalLines(g, grid([['SHIN','SHIN','SHIN'],['SHIN','SHIN','SHIN'],['SHIN','SHIN','SHIN'],['x','x','x'],['x','x','x']]), 5, 100);
eq(r.wins.length, 5, 'in five-line mode only the first five lines are read');
eq(S.evalLines(g, grid([['SHIN','SHIN','SHIN'],['SHIN','SHIN','SHIN'],['SHIN','SHIN','SHIN'],['x','x','x'],['x','x','x']]), 50, 100).wins.length, 50, 'with fifty lines every line reads three shins');

// hold and spin
const hs = S.holdAndSpin(g, 5000, [[0,0],[0,1],[1,0],[2,2],[3,1],[4,0]]);
eq(hs.board.filter(Boolean).length >= 6, true);
eq(hs.steps.length >= 2, true, 'respins are recorded step by step');
eq(hs.total > 0, true);
eq(Array.isArray(hs.jackpots), true, 'a hold and spin reports any jackpot it awarded');

// jackpot meters are multiples of the bet, so the odds do not move with bet size
eq(S.meterValue(g, 'mini', 10000, null), 10000 * g.jackpots.seed.mini, 'an unseeded meter pays its seed multiple');
eq(S.meterValue(g, 'grand', 10000, { grand: 1500 }), 15000000, 'a live meter pays its multiple of the total bet');
eq(S.meterValue(g, 'grand', 20000, { grand: 1500 }) / S.meterValue(g, 'grand', 10000, { grand: 1500 }), 2,
  'double the bet, double the jackpot');

// the latke round
for (let i = 0; i < 400; i++) {
  const lr = S.latkeRound(g, 2500, null);
  const last = lr.picks[lr.picks.length - 1];
  eq(!!(last.empty || last.jackpot), true, 'a latke round ends on an empty pan or a jackpot');
  eq(lr.total, lr.picks.reduce((a, p) => a + (p.amount || 0), 0), 'the round pays exactly what the pans revealed');
  eq(lr.picks.filter(p => p.empty).length <= 1, true, 'only the last pan can be empty');
}

// free games
const fgTest = S.freeGames(g, 8, 25, 100, null, 3);
eq(fgTest.rounds.length > 0, true);
eq(g.order.indexOf(fgTest.boost) >= 0 || fgTest.boost === 'WILD', true, 'the scroll reveals a paying symbol');
eq(fgTest.total >= Math.round(g.scatterPays[3] * 2500), true, 'a free games round never pays less than the shofar award');
eq(g.free.holdTrigger < g.hold.trigger, true, 'the hold and spin comes one candle early in free games');
let zeroes = 0, boosted = {};
for (let i = 0; i < 600; i++) {
  const f = S.freeGames(g, 8, 25, 100, null, 3);
  if (f.total <= 0) zeroes++;
  boosted[f.boost] = (boosted[f.boost] || 0) + 1;
}
eq(zeroes, 0, 'no free games round pays nothing');
eq(Object.keys(boosted).length > 3, true, 'the boosted symbol varies');

// the pan only starts the latke round from three
eq(g.latke.trigger, 3);
eq(g.reels.every(r => r.filter(s => s === 'PAN').length === 1), true, 'one pan per reel');
eq(g.freeReels.every(r => r.filter(s => s === 'CANDLE').length > g.reels[0].filter(s => s === 'CANDLE').length / 2), true,
  'the free game strips carry candles');

// pinball
const p = G.pinball();
const line = (a, b, c, cr) => G.pinballWin(p, [[a],[b],[c]], 100, cr);
eq(line('SEVEN','SEVEN','SEVEN').total, 45000, 'three sevens pay 450x on one credit');
eq(line('SEVEN','SEVEN','SEVEN', 2).total, 120000, 'three sevens on two credits pay the boosted award');
eq(line('BELL','BELL','BELL', 2).total, 7200, 'ordinary wins double on two credits');
eq(line('BAR3','BAR3','BAR3').total, 11500);
eq(line('BAR1','BAR3','BAR2').total, 600, 'mixed bars pay the consolation');
eq(line('CHERRY','BELL','BELL').total, 200, 'one cherry from the left');
eq(line('CHERRY','CHERRY','BELL').total, 600);
eq(line('BELL','CHERRY','CHERRY').total, 0, 'cherries must start on reel one');
eq(line('BELL','BELL','BALL').bonus, true, 'one ball on the last reel starts the bonus');
eq(line('BALL','BALL','BELL').bonus, false, 'the ball only counts on the third reel');
eq(p.reels[0].filter(s => s === 'BALL').length, 0, 'no balls on the first two reels');
eq(p.reels[2].filter(s => s === 'BALL').length, 3, 'three balls on the third reel');

/* Jackpots are far too rare to read off a general run, so measure the hold and
   spin directly: how often it fills all fifteen, and how often a jackpot cell
   lands. A meter costs its seed each time it is hit, plus whatever it grew by. */
function jackpotRates(trials) {
  function dist(reels) {
    const d = {};
    for (let i = 0; i < trials; i++) {
      const stops = S.spinStops(g, reels);
      const grid = S.gridAt(g, stops, reels).map(c => c.map(x => x === g.free.token ? 'NUN' : x));
      d[S.countIn(grid, g.coin)] = (d[S.countIn(grid, g.coin)] || 0) + 1;
    }
    return d;
  }
  function run(d, trigger) {
    const keys = Object.keys(d).map(Number).filter(x => x >= trigger);
    const hit = keys.reduce((a, x) => a + d[x], 0);
    const all = Object.values(d).reduce((a, b) => a + b, 0);
    if (!hit) return { rate: 0, fill: 0, mini: 0, minor: 0, major: 0 };
    let fill = 0; const jp = { mini: 0, minor: 0, major: 0 };
    const runs = Math.floor(trials / 2);
    for (let i = 0; i < runs; i++) {
      let r = Math.random() * hit, count = keys[0];
      for (const k of keys) { r -= d[k]; if (r <= 0) { count = k; break; } }
      const pos = [], used = {};
      while (pos.length < count) {
        const x = Math.floor(Math.random() * 5), y = Math.floor(Math.random() * 3), key = x + ',' + y;
        if (!used[key]) { used[key] = 1; pos.push([x, y]); }
      }
      const h = S.holdAndSpin(g, 10000, pos);
      if (h.filled === 15) fill++;
      h.jackpots.forEach(j => { if (jp[j.tier] !== undefined) jp[j.tier]++; });
    }
    return { rate: hit / all, fill: fill / runs, mini: jp.mini / runs, minor: jp.minor / runs, major: jp.major / runs };
  }
  return { base: run(dist(g.reels), g.hold.trigger), free: run(dist(g.freeReels), g.free.holdTrigger) };
}

// ---- return to player ----
/* Measuring this off a plain run of spins is hopeless: the features are rare
   and enormous, so the sample swings by points. Instead price each piece from
   its own large sample and put them together. */
function triggerRates(spins, lineCount, lineBet) {
  const stake = lineCount * lineBet;
  let lines = 0, scat = 0, hold = 0, latke = 0, n = 0;
  const freeBy = { 3: 0, 4: 0, 5: 0 };
  for (let i = 0; i < spins; i++) {
    n++;
    const stops = S.spinStops(g), grid = S.gridAt(g, stops);
    lines += S.evalLines(g, grid, lineCount, lineBet).total;
    const sc = S.countIn(grid, g.scatter);
    if (g.scatterPays[sc]) scat += g.scatterPays[sc] * stake;
    if (sc >= g.free.trigger) freeBy[sc]++;
    if (S.positionsOf(grid, g.coin).length >= g.hold.trigger) hold++;
    if (S.countIn(grid, g.bonus) >= g.latke.trigger) latke++;
  }
  return { lines: lines / (n * stake), scat: scat / (n * stake),
    hold: hold / n, latke: latke / n,
    free: { 3: freeBy[3] / n, 4: freeBy[4] / n, 5: freeBy[5] / n } };
}
function avgFree(count, rounds, lineCount, lineBet) {
  const stake = lineCount * lineBet;
  let sum = 0, holds = 0, floors = 0, spins = 0, zero = 0;
  for (let i = 0; i < rounds; i++) {
    const f = S.freeGames(g, g.free.spins[count], lineCount, lineBet, null, count);
    sum += f.total - f.jackpots.reduce((a, j) => a + j.amount, 0);
    if (f.holds) holds++;
    if (f.topUp) floors++;
    if (f.total <= 0) zero++;
    spins += f.played;
  }
  return { avg: sum / rounds / stake, holds: holds / rounds, floors: floors / rounds,
    spins: spins / rounds, zero: zero };
}
function avgLatke(rounds, stake) {
  let sum = 0, picks = 0;
  for (let i = 0; i < rounds; i++) {
    const r = S.latkeRound(g, stake, null);
    sum += r.total - r.jackpots.reduce((a, j) => a + j.amount, 0);
    picks += r.picks.length;
  }
  return { avg: sum / rounds / stake, picks: picks / rounds };
}
function avgHold(trials, stake) {
  const d = {};
  for (let i = 0; i < 120000; i++) {
    const stops = S.spinStops(g), grid = S.gridAt(g, stops);
    const c = S.positionsOf(grid, g.coin).length;
    if (c >= g.hold.trigger) d[c] = (d[c] || 0) + 1;
  }
  const keys = Object.keys(d).map(Number), tot = keys.reduce((a, k) => a + d[k], 0);
  let sum = 0;
  for (let i = 0; i < trials; i++) {
    let r = Math.random() * tot, n = keys[0];
    for (const k of keys) { r -= d[k]; if (r <= 0) { n = k; break; } }
    const pos = [], used = {};
    while (pos.length < n) {
      const x = Math.floor(Math.random() * 5), y = Math.floor(Math.random() * 3), key = x + ',' + y;
      if (!used[key]) { used[key] = 1; pos.push([x, y]); }
    }
    const h = S.holdAndSpin(g, stake, pos);
    sum += (h.total - h.jackpots.reduce((a, j) => a + j.amount, 0)) / stake;
  }
  return sum / trials;
}

const jr = jackpotRates(120000);
const rev = g.latke.reveals;
const wEmpty = rev.find(r => r.empty).w;
const wJp = rev.filter(r => r.jackpot).reduce((a, r) => a + r.w, 0);
const lkJp = {};
rev.filter(r => r.jackpot).forEach(r => { lkJp[r.jackpot] = r.w / (wEmpty + wJp); });

const holdAvg = avgHold(60000, 2500);
const latke = avgLatke(120000, 2500);
[5, 25, 50].forEach(lc => {
  const stake = lc * 100;
  const t = triggerRates(300000, lc, 100);
  /* Free games carry nearly all the variance here: a round averages ~22x but can
     pay hundreds, so a small sample swings the total by a point. Sample it hard. */
  const free = { 3: avgFree(3, 20000, lc, 100), 4: avgFree(4, 4000, lc, 100), 5: avgFree(5, 1500, lc, 100) };
  eq(free[3].zero + free[4].zero + free[5].zero, 0, 'no free games round pays nothing');
  const fgRtp = [3, 4, 5].reduce((a, c) => a + t.free[c] * free[c].avg, 0);
  const fgTrig = t.free[3] + t.free[4] + t.free[5];
  const holdRtp = t.hold * holdAvg;
  const latkeRtp = t.latke * latke.avg;
  const per = {
    mini: t.hold * jr.base.mini + fgTrig * free[3].holds * jr.free.mini + t.latke * lkJp.mini,
    minor: t.hold * jr.base.minor + fgTrig * free[3].holds * jr.free.minor + t.latke * lkJp.minor,
    major: t.hold * jr.base.major + fgTrig * free[3].holds * jr.free.major + t.latke * lkJp.major,
    grand: t.hold * jr.base.fill + fgTrig * free[3].holds * jr.free.fill + t.latke * lkJp.grand
  };
  let jpRtp = 0;
  Object.keys(per).forEach(x => { jpRtp += per[x] * g.jackpots.seed[x] + g.jackpots.rate[x]; });
  const total = t.lines + t.scat + fgRtp + holdRtp + latkeRtp + jpRtp;
  eq(total > 0.925 && total < 0.96, true, `${lc}-line return stays in band (measured ${(total * 100).toFixed(2)}%)`);
  console.log(`Festival of Lights ${String(lc).padStart(2)} lines \u00b7 RTP ${(total * 100).toFixed(2)}% ` +
    `(lines ${(t.lines * 100).toFixed(1)} \u00b7 free games ${(fgRtp * 100).toFixed(1)} \u00b7 hold & spin ${(holdRtp * 100).toFixed(1)} ` +
    `\u00b7 latke ${(latkeRtp * 100).toFixed(1)} \u00b7 shofar ${(t.scat * 100).toFixed(1)} \u00b7 jackpots ${(jpRtp * 100).toFixed(1)})`);
  if (lc === 25) {
    console.log(`  free games 1 in ${Math.round(1 / fgTrig)} spins \u00b7 ${free[3].avg.toFixed(1)}x bet on average \u00b7 ` +
      `${free[3].spins.toFixed(1)} spins \u00b7 hold & spin inside ${(free[3].holds * 100).toFixed(0)}% of rounds \u00b7 ` +
      `floor topped up ${(free[3].floors * 100).toFixed(1)}% of rounds`);
    console.log(`  latke bonus 1 in ${Math.round(1 / t.latke)} spins \u00b7 ${latke.avg.toFixed(1)}x bet on average \u00b7 ${latke.picks.toFixed(1)} pans picked`);
    console.log(`  hold & spin 1 in ${Math.round(1 / t.hold)} spins in the base game, 1 in ${Math.round(1 / jr.free.rate)} free spins, ${holdAvg.toFixed(1)}x bet on average`);
    ['mini', 'minor', 'major', 'grand'].forEach(x => {
      console.log(`  ${x.padEnd(5)} jackpot 1 in ${Math.round(1 / per[x]).toLocaleString()} spins \u00b7 seeds at ${g.jackpots.seed[x]}x bet \u00b7 grows ${g.jackpots.rate[x]}x a spin`);
    });
  }
});

/* Pinball is small enough to price exactly: walk all 10,648 reel stops and
   add the bonus, rather than trusting a sample. */
function pinRTP(credits) {
  function binom(k) { let r = 1; for (let i = 0; i < k; i++) r = r * (p.pins.rows - i) / (i + 1); return r; }
  const pocketEV = p.pins.pockets.reduce((a, v, i) => a + v * binom(i) / Math.pow(2, p.pins.rows), 0);
  let paid = 0, combos = 0, trig = 0;
  for (const a of p.reels[0]) for (const b of p.reels[1]) for (const c of p.reels[2]) {
    combos++;
    const w = G.pinballWin(p, [[a], [b], [c]], 1, credits);
    paid += w.total;
    if (w.bonus) { paid += pocketEV * credits; trig++; }
  }
  return { rtp: paid / combos / credits, bonus: trig / combos };
}
[1, 2].forEach(cr => {
  const sp = pinRTP(cr);
  eq(sp.rtp > 0.94 && sp.rtp < 0.98, true, `pinball ${cr}-credit return stays in band`);
  console.log(`Pinball Classic ${cr} credit${cr > 1 ? 's' : ' '} \u00b7 RTP ${(sp.rtp * 100).toFixed(2)}% (exact) \u00b7 bonus 1 in ${Math.round(1 / sp.bonus)} spins`);
});
console.log('slots: all passed', n, 'asserts');
