global.crypto = require('crypto').webcrypto;
const C = require('./common.js'), B = require('./bac.js'), assert = require('assert');
let n = 0; const eq = (a, b, m) => { n++; assert.deepStrictEqual(a, b, m); };
const card = s => ({ r: s.slice(0, -1), s: s.slice(-1) });
function stacked(cards) { const G = B.newGame(8); G.shoe.cards = cards.map(card).concat(G.shoe.cards); G.shoe.pos = 0; G.shoe.cut = 1e5; return G; }
// deal order: P, B, P, B, then player third, then banker third
const play = cards => B.deal(stacked(cards));

// naturals stand
let r = play(['9S', '5H', '8D', '3C']);
eq([r.pt, r.bt, r.result, r.player.length, r.banker.length], [7, 8, 'B', 2, 2], 'natural 8 stands');
r = play(['AS', '5H', '8D', '3C']);
eq([r.pt, r.bt, r.result], [9, 8, 'P'], 'natural 9 beats natural 8');
// player stands on 6 and 7, banker draws on 0-5
r = play(['3S', '2H', '4D', '3C', '7S']);
eq([r.pt, r.player.length, r.banker.length, r.bt], [7, 2, 3, 2], 'player 7 stands, banker 5 draws');
eq(r.result, 'P');
// player draws on 0-5
r = play(['2S', 'KH', '3D', '5C', '4H']);
eq([r.player.length, B.total(r.player)], [3, 9]);
// banker tableau: banker 3 stands when the player's third card is an 8
r = play(['2S', '2H', '2D', 'AC', '8H']);
eq([B.total(r.player.slice(0, 2)), B.total(r.banker.slice(0, 2))], [4, 3]);
eq([r.player.length, r.banker.length], [3, 2], 'banker 3 stands against a player 8');
// banker 4 draws against 2-7, stands against 0,1,8,9
r = play(['2S', '2H', '2D', '2C', '2H']);
eq(r.banker.length, 3, 'banker 4 draws against a 2');
r = play(['2S', '2H', '2D', '2C', 'AH']);
eq(r.banker.length, 2, 'banker 4 stands against an ace');
// banker 6 draws only against 6 or 7
r = play(['2S', '3H', '2D', '3C', '6H']);
eq([B.total(r.banker.slice(0, 2)), r.banker.length], [6, 3], 'banker 6 draws against a 6');
r = play(['2S', '3H', '2D', '3C', '5H']);
eq(r.banker.length, 2, 'banker 6 stands against a 5');

// payouts: commission vs EZ
const bets = k => Object.assign({ player: 0, banker: 0, tie: 0, pPair: 0, bPair: 0, either: 0, perfect: 0, dragon: 0, panda: 0 }, k);
r = play(['9S', '5H', '8D', '3C']); // banker wins 8 to 7
eq(B.settle(r, bets({ banker: 1000 }), 'commission').rows.map(x => [x.amount, x.net]), [[1950, 950]], 'banker pays 19:20');
eq(B.settle(r, bets({ banker: 1000 }), 'ez').rows.map(x => [x.amount, x.net]), [[2000, 1000]], 'EZ banker pays even');
eq(B.settle(r, bets({ player: 1000 }), 'ez').rows.map(x => x.net), [-1000]);
// Dragon 7: banker wins with a three-card 7
r = play(['2S', '2H', '3D', '2C', '4H', '3S']);
eq([r.pt, r.bt, r.banker.length, r.result, r.dragon7], [9, 7, 3, 'P', false], 'banker three-card 7 that loses is not a Dragon 7');
r = play(['5S', '2H', 'KD', '3C', '4H', '2S']);
eq([B.total(r.player), B.total(r.banker), r.banker.length, r.result], [9, 7, 3, 'P']);
r = play(['KS', '2H', 'KD', '3C', '5H', '2S']);
eq([r.pt, r.bt, r.banker.length, r.result, r.dragon7], [5, 7, 3, 'B', true], 'banker three-card 7');
eq(B.settle(r, bets({ banker: 1000, dragon: 100 }), 'ez').rows.map(x => [x.kind, x.amount, x.net]),
   [['push', 1000, 0], ['win', 4100, 4000]], 'EZ: banker pushes, Dragon 7 pays 40:1');
eq(B.settle(r, bets({ banker: 1000 }), 'commission').rows.map(x => [x.kind, x.net]), [['win', 950]], 'commission game pays that hand');
eq(B.settle(r, bets({ player: 1000 }), 'ez').rows.map(x => x.net), [-1000], 'player bets still lose on a Dragon 7');
// Panda 8: player wins with a three-card 8
r = play(['2S', '3H', '3D', '3C', '3H']);
eq([r.pt, r.bt, r.player.length, r.result, r.panda8], [8, 6, 3, 'P', true]);
eq(B.settle(r, bets({ player: 1000, panda: 100 }), 'ez').rows.map(x => [x.kind, x.net]), [['win', 1000], ['win', 2500]], 'Panda 8 pays 25:1');
// tie pushes the main bets and pays 8:1
r = play(['5S', '5H', '4D', '4C']);
eq([r.pt, r.bt, r.result], [9, 9, 'T']);
eq(B.settle(r, bets({ player: 1000, banker: 1000, tie: 100 }), 'commission').rows.map(x => [x.kind, x.amount, x.net]),
   [['push', 1000, 0], ['push', 1000, 0], ['win', 900, 800]]);
// pairs
r = play(['7S', 'KH', '7D', 'KC']);
eq([r.pPair, r.bPair, r.pPerfect], [true, true, false]);
eq(B.settle(r, bets({ pPair: 100, bPair: 100, either: 100, perfect: 100 }), 'commission').rows.map(x => x.net), [1100, 1100, 500, -100]);
r = play(['7S', 'KH', '7S', 'KH']);
eq([r.pPerfect, r.bPerfect], [true, true]);
eq(B.settle(r, bets({ perfect: 100 }), 'commission').rows.map(x => x.net), [20000], 'both perfect pairs pay 200:1');

// --- simulation: known frequencies and house edges ---
const G = B.newGame(8);
let c = { P: 0, B: 0, T: 0 }, dragon = 0, panda = 0, pair = 0, N = 2e6;
let edge = { player: 0, bankerC: 0, bankerEZ: 0, tie: 0, dragon: 0, panda: 0 };
for (let i = 0; i < N; i++) {
  const x = B.deal(G);
  c[x.result]++; if (x.dragon7) dragon++; if (x.panda8) panda++; if (x.pPair) pair++;
  edge.player += B.settle(x, bets({ player: 10000 }), 'ez').net;
  edge.bankerC += B.settle(x, bets({ banker: 10000 }), 'commission').net;
  edge.bankerEZ += B.settle(x, bets({ banker: 10000 }), 'ez').net;
  edge.tie += B.settle(x, bets({ tie: 10000 }), 'ez').net;
  edge.dragon += B.settle(x, bets({ dragon: 10000 }), 'ez').net;
  edge.panda += B.settle(x, bets({ panda: 10000 }), 'ez').net;
}
const pct = v => (v / N * 100).toFixed(2) + '%';
const ed = v => (v / (N * 10000) * 100).toFixed(2) + '%';
console.log('results  P', pct(c.P), '(44.62%) · B', pct(c.B), '(45.86%) · T', pct(c.T), '(9.52%)');
console.log('dragon 7', pct(dragon), '(2.26%) · panda 8', pct(panda), '(3.41%) · player pair', pct(pair), '(7.47%)');
console.log('house edge  player', ed(edge.player), '(-1.24%) · banker commission', ed(edge.bankerC), '(-1.06%) · banker EZ', ed(edge.bankerEZ), '(-1.02%)');
console.log('            tie', ed(edge.tie), '(-14.36%) · dragon 7', ed(edge.dragon), '(-7.61%) · panda 8', ed(edge.panda), '(-10.19%)');
const near = (got, want, tol, what) => { n++; assert.ok(Math.abs(got - want) < tol, what + ': ' + got + ' vs ' + want); };
near(c.P / N, 0.4462, 0.003, 'player wins');
near(c.B / N, 0.4586, 0.003, 'banker wins');
near(c.T / N, 0.0952, 0.002, 'ties');
near(dragon / N, 0.0226, 0.001, 'dragon 7 rate');
near(panda / N, 0.0341, 0.002, 'panda 8 rate');
near(edge.bankerC / (N * 10000), -0.0106, 0.003, 'banker commission edge');
near(edge.bankerEZ / (N * 10000), -0.0102, 0.003, 'banker EZ edge');
near(edge.player / (N * 10000), -0.0124, 0.003, 'player edge');
console.log('baccarat: all passed', n, 'asserts +', (N / 1e6) + 'M simulated coups');
