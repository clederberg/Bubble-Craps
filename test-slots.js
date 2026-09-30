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
const g = G.lanterns();
const grid = sym => sym.map(col => col.slice());
let r = S.evalLines(g, grid([['DRAGON','x','x'],['DRAGON','x','x'],['DRAGON','x','x'],['x','x','x'],['x','x','x']]), 1, 100);
eq(r.total, 9400, 'three dragons pay 94x the line bet');
r = S.evalLines(g, grid([['DRAGON','x','x'],['WILD','x','x'],['DRAGON','x','x'],['DRAGON','x','x'],['x','x','x']]), 1, 100);
eq(r.total, 47000, 'a wild fills in for four of a kind');
r = S.evalLines(g, grid([['WILD','x','x'],['WILD','x','x'],['WILD','x','x'],['x','x','x'],['x','x','x']]), 1, 100);
eq(r.total, 12500, 'three wilds pay the wild line');
r = S.evalLines(g, grid([['COIN','x','x'],['COIN','x','x'],['COIN','x','x'],['COIN','x','x'],['COIN','x','x']]), 50, 100);
eq(r.total, 0, 'coins never pay as a line');
r = S.evalLines(g, grid([['DRAGON','x','x'],['DRAGON','x','x'],['DRAGON','x','x'],['x','x','x'],['x','x','x']]), 50, 100);
eq(r.wins.every(w => w.sym === 'DRAGON' && w.count === 3), true, 'every line through those cells pays');
r = S.evalLines(g, grid([['K','K','K'],['K','K','K'],['K','K','K'],['x','x','x'],['x','x','x']]), 5, 100);
eq(r.wins.length, 5, 'in five-line mode only the first five lines are read');
eq(S.evalLines(g, grid([['K','K','K'],['K','K','K'],['K','K','K'],['x','x','x'],['x','x','x']]), 50, 100).wins.length, 50, 'with fifty lines every line reads three kings');

// hold and spin
const hs = S.holdAndSpin(g, 5000, [[0,0],[0,1],[1,0],[2,2],[3,1],[4,0]]);
eq(hs.board.filter(Boolean).length >= 6, true);
eq(hs.steps.length >= 2, true, 'respins are recorded step by step');
eq(hs.total > 0, true);

// pinball
const p = G.pinball();
const line = (a, b, c) => G.pinballWin(p, [[a],[b],[c]], 100);
eq(line('SEVEN','SEVEN','SEVEN').total, 60000, 'three sevens pay 600x');
eq(line('BAR3','BAR3','BAR3').total, 17000);
eq(line('BAR1','BAR3','BAR2').total, 900, 'mixed bars pay the consolation');
eq(line('CHERRY','BELL','BELL').total, 300, 'one cherry from the left');
eq(line('CHERRY','CHERRY','BELL').total, 900);
eq(line('BELL','CHERRY','CHERRY').total, 0, 'cherries must start on reel one');
eq(line('BALL','BALL','BALL').bonus, true);
eq(line('BALL','BALL','BELL').bonus, false);

// ---- simulated return to player ----
function simulate(game, spins, lineCount, lineBet) {
  let staked = 0, won = 0, holds = 0, frees = 0, grands = 0, best = 0;
  for (let i = 0; i < spins; i++) {
    const bet = lineCount * lineBet;
    staked += bet;
    const res = S.play(game, lineCount, lineBet);
    won += res.total;
    if (res.total > best) best = res.total;
    if (res.hold) { holds++; if (res.hold.grand) grands++; }
    if (res.free) frees++;
  }
  return { rtp: won / staked, holds: holds / spins, frees: frees / spins, grands: grands / spins, best: best / (lineCount * lineBet) };
}
const N = 250000;
[5, 25, 50].forEach(lc => {
  const s = simulate(g, N, lc, 100);
  console.log(`Golden Lanterns ${String(lc).padStart(2)} lines · RTP ${(s.rtp*100).toFixed(2)}% · hold & spin 1 in ${Math.round(1/s.holds)} · free games 1 in ${Math.round(1/s.frees)} · biggest win ${Math.round(s.best)}x bet`);
});
function simPin(spins, bet) {
  let staked = 0, won = 0, bonus = 0;
  for (let i = 0; i < spins; i++) {
    staked += bet;
    const stops = S.spinStops(p), gr = S.gridAt(p, stops);
    const w = G.pinballWin(p, gr, bet);
    won += w.total;
    if (w.bonus) { bonus++; won += G.pinballBonus(p, bet).amount; }
  }
  return { rtp: won / staked, bonus: bonus / spins };
}
const sp = simPin(N, 100);
console.log(`Pinball Classic · RTP ${(sp.rtp*100).toFixed(2)}% · bonus 1 in ${Math.round(1/sp.bonus)} spins`);
console.log('slots: all passed', n, 'asserts');
