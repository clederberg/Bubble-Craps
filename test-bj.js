global.crypto = require('crypto').webcrypto;
const C = require('./common.js'), BJ = require('./bj.js'), assert = require('assert');
let n = 0; const eq = (a, b, m) => { n++; assert.deepStrictEqual(a, b, m); };
const card = s => ({ r: s.slice(0, -1), s: s.slice(-1) });
function stacked(cards) {
  const G = BJ.newGame(6);
  G.shoe.cards = cards.map(card).concat(G.shoe.cards);
  G.shoe.pos = 0; G.shoe.cut = 10000;
  return G;
}
const money = r => r.rows.map(x => [x.label, x.amount, x.net]);

// hand values
eq(BJ.value([card('AS'), card('9H')]), { total: 20, soft: true });
eq(BJ.value([card('AS'), card('9H'), card('5C')]), { total: 15, soft: false });
eq(BJ.value([card('AS'), card('AD'), card('9H')]), { total: 21, soft: true });
eq(BJ.total([card('KS'), card('QH'), card('2C')]), 22);

// blackjack pays 3:2, dealer 20
let G = stacked(['AS', 'KH', 'KD', '9C']);
BJ.deal(G, [{ bet: 1000 }]);
eq(G.phase, 'payout'); eq(BJ.isBlackjack(G.spots[0].hands[0]), true);
eq(money(BJ.settle(G)), [['Hand blackjack', 2500, 1500]]);

// dealer stands on soft 17
G = stacked(['9S', 'AH', '8D', '6C', '5S']);
BJ.deal(G, [{ bet: 1000 }]); BJ.act(G, 'stand');
eq(BJ.total(G.dealer), 17, 'dealer stands on soft 17'); eq(G.dealer.length, 2);
eq(money(BJ.settle(G)), [['Hand wins 17 to 17'.replace('wins 17 to 17', 'pushes on 17'), 1000, 0]]);

// dealer hits 16, busts; player wins
G = stacked(['9S', '9H', '7D', '7C', 'KS']);
BJ.deal(G, [{ bet: 1000 }]); BJ.act(G, 'stand');
eq(BJ.total(G.dealer), 26); eq(money(BJ.settle(G))[0][2], 1000);

// double
G = stacked(['5S', '9H', '6D', '8C', 'KS']);
BJ.deal(G, [{ bet: 1000 }]);
eq(BJ.options(G).double, true);
eq(BJ.act(G, 'double').cost, 1000);
eq(BJ.total(G.spots[0].hands[0].cards), 21); eq(G.spots[0].hands[0].cards.length, 3);
eq(money(BJ.settle(G)), [['Hand wins 21 to 17', 4000, 2000]]);

// surrender loses half
G = stacked(['KS', '6H', '9D', 'AC']);
BJ.deal(G, [{ bet: 1000 }]);
eq(BJ.options(G).surrender, true);
BJ.act(G, 'surrender');
eq(money(BJ.settle(G)), [['Hand surrendered', 500, -500]]);

// split aces get one card each and cannot be hit
G = stacked(['AS', '9H', 'AD', '7C', 'KS', 'QH', '5D']);
BJ.deal(G, [{ bet: 1000 }]);
eq(BJ.options(G).split, true);
eq(BJ.act(G, 'split').cost, 1000);
eq(G.spots[0].hands.length, 2);
eq(G.spots[0].hands.map(h => h.cards.length), [2, 2]);
eq(G.phase, 'dealer' === G.phase ? G.phase : 'payout', 'both split-ace hands auto-stand');
eq(BJ.isBlackjack(G.spots[0].hands[0]), false, 'split 21 is not a blackjack');
let r = BJ.settle(G); eq(r.rows.length, 2); eq(r.rows.map(x => x.kind), ['push', 'push'], 'both 21 vs dealer 21');
eq(G.spots[0].hands.map(h => BJ.total(h.cards)), [21, 21]);

// split to four hands max, double after split
G = stacked(['8S', '5H', '8D', '6C', '8H', '8C', '8D', '3S', '3H', '3D', '3C', '2S', '2H', '2D', '2C', 'KS']);
BJ.deal(G, [{ bet: 1000 }]);
eq(BJ.act(G, 'split').ok, true);
let guard = 0;
while (BJ.options(G).split && guard++ < 10) BJ.act(G, 'split');
eq(G.spots[0].hands.length, 4, 'four hands max');
eq(BJ.options(G).split, false);
eq(BJ.options(G).double, true, 'double after split allowed');

// insurance: dealer blackjack
G = stacked(['KS', 'AH', 'QD', 'KC']);
BJ.deal(G, [{ bet: 1000 }]);
eq(G.phase, 'insurance');
eq(BJ.insure(G, 0, 900).added, 500, 'insurance capped at half');
BJ.closeInsurance(G);
eq(G.phase, 'payout');
eq(money(BJ.settle(G)), [['Insurance', 1500, 1000], ['Hand loses to blackjack', 0, -1000]]);

// even money: blackjack against an ace pays 1:1 up front
G = stacked(['AS', 'AH', 'KD', 'KC']);
BJ.deal(G, [{ bet: 1000 }]);
eq(G.phase, 'insurance');
eq(BJ.evenMoneySpots(G), [0]);
eq(BJ.takeEvenMoney(G, 0).ok, true);
eq(BJ.insure(G, 0, 500).ok, false, 'no insurance after even money');
BJ.closeInsurance(G);
eq(BJ.dealerBlackjack(G), true);
eq(money(BJ.settle(G)), [['Hand took even money', 2000, 1000]], 'even money pays 1:1 even when the dealer has blackjack');
// even money when the dealer does not have blackjack: still 1:1, not 3:2
G = stacked(['AS', 'AH', 'KD', '5C']);
BJ.deal(G, [{ bet: 1000 }]);
BJ.takeEvenMoney(G, 0);
BJ.closeInsurance(G);
eq(money(BJ.settle(G)), [['Hand took even money', 2000, 1000]]);
// declining even money keeps the 3:2 when the dealer misses
G = stacked(['AS', 'AH', 'KD', '5C']);
BJ.deal(G, [{ bet: 1000 }]);
BJ.closeInsurance(G);
eq(money(BJ.settle(G)), [['Hand blackjack', 2500, 1500]]);
// even money is not offered without a blackjack
G = stacked(['9S', 'AH', 'KD', '5C']);
BJ.deal(G, [{ bet: 1000 }]);
eq(BJ.evenMoneySpots(G), []);
eq(BJ.takeEvenMoney(G, 0).ok, false);

// player blackjack pushes dealer blackjack
G = stacked(['AS', 'AH', 'KD', 'KC']);
BJ.deal(G, [{ bet: 1000 }]); BJ.closeInsurance(G);
eq(money(BJ.settle(G)), [['Hand pushes (both blackjack)', 1000, 0]]);

// dealer 10 up peeks, no insurance offered
G = stacked(['9S', 'KH', '8D', 'AC']);
BJ.deal(G, [{ bet: 1000 }]);
eq(G.phase, 'payout'); eq(G.dealerHole, false);

// Match the Dealer: suited + unsuited
G = stacked(['KS', 'KS', '2D', '4C']);
BJ.deal(G, [{ bet: 1000, mtd: 100 }]);
eq(G.spots[0].side[0].net, 100 * 9, 'suited match pays 9:1');
G = stacked(['KH', 'KS', '2D', '4C']);
BJ.deal(G, [{ bet: 1000, mtd: 100 }]);
eq(G.spots[0].side[0].net, 100 * 4, 'unsuited match pays 4:1');
G = stacked(['KH', 'KS', 'KC', '4C']);
BJ.deal(G, [{ bet: 1000, mtd: 100 }]);
eq(G.spots[0].side[0].net, 100 * 8, 'two unsuited matches pay both');
G = stacked(['2H', '7S', '3C', '4C']);
BJ.deal(G, [{ bet: 1000, mtd: 100 }]);
eq(G.spots[0].side[0].net, -100);

// Buster: dealer busts with five cards pays 4:1
G = stacked(['KS', '2H', 'QD', '3C', '4S', '5H', 'KC']);
BJ.deal(G, [{ bet: 1000, buster: 100 }]); BJ.act(G, 'stand');
eq(G.dealer.length, 5); eq(BJ.total(G.dealer) > 21, true);
let rows = money(BJ.settle(G));
eq(rows[0], ['Buster (dealer busts with 5)', 500, 400]);
// Buster pays even when the player busted first
G = stacked(['KS', '2H', 'QD', '3C', 'KH', '4S', '5H', 'KC']);
BJ.deal(G, [{ bet: 1000, buster: 100 }]); BJ.act(G, 'hit');
eq(BJ.total(G.spots[0].hands[0].cards) > 21, true);
rows = money(BJ.settle(G));
eq(rows[0][2], 400, 'buster still pays'); eq(rows[1][2], -1000);

// three spots play in order
G = stacked(['2S', '3H', '4D', 'KS', '9C', '9H', '9D', '7C', '8S', '8H']);
BJ.deal(G, [{ bet: 100, seat: 0 }, { bet: 200, seat: 1 }, { bet: 300, seat: 2 }]);
eq(G.spots.length, 3);
eq(G.spots.map(s => s.hands[0].cards.map(c => c.r + c.s)), [['2S', '9C'], ['3H', '9H'], ['4D', '9D']]);
eq(G.dealer.map(c => c.r + c.s), ['KS', '7C']);
eq(G.active, { spot: 0, hand: 0 });
BJ.act(G, 'stand'); eq(G.active, { spot: 1, hand: 0 });
BJ.act(G, 'stand'); eq(G.active, { spot: 2, hand: 0 });
BJ.act(G, 'stand'); eq(G.phase, 'payout');

// --- simulation: money conservation and a sane house edge with mimic-the-dealer play ---
function simulate(hands, strategy) {
  const G = BJ.newGame(6);
  let bank = 1e9, staked = 0;
  for (let i = 0; i < hands; i++) {
    const bet = 1000, spots = [{ bet, mtd: 0, buster: 0 }];
    bank -= bet; staked += bet;
    BJ.deal(G, spots);
    if (G.phase === 'insurance') BJ.closeInsurance(G);
    let steps = 0;
    while (G.phase === 'player' && steps++ < 40) {
      const h = BJ.current(G), o = BJ.options(G);
      const a = strategy(BJ.value(h.cards), G.dealer[0], o);
      const res = BJ.act(G, a);
      if (res.ok && res.cost) bank -= res.cost, staked += res.cost;
      if (!res.ok) BJ.act(G, 'stand');
    }
    const s = BJ.settle(G);
    bank += s.back;
  }
  return { edge: (bank - 1e9) / staked, staked };
}
const mimic = v => (v.total < 17 ? 'hit' : 'stand');
let sim = simulate(200000, mimic);
console.log('mimic-the-dealer player edge:', (sim.edge * 100).toFixed(2) + '% (expected about -5.5%)');
assert.ok(sim.edge < -0.03 && sim.edge > -0.08, 'mimic edge out of range: ' + sim.edge);

// random play, checking for crashes and that every settlement is consistent
const acts = ['hit', 'stand', 'double', 'split', 'surrender'];
const G2 = BJ.newGame(6);
for (let i = 0; i < 30000; i++) {
  const bets = [];
  const spots = 1 + Math.floor(Math.random() * 3);
  for (let s = 0; s < spots; s++) bets.push({ bet: 100 * (1 + Math.floor(Math.random() * 10)), mtd: Math.random() < .4 ? 100 : 0, buster: Math.random() < .4 ? 100 : 0 });
  BJ.deal(G2, bets);
  if (G2.phase === 'insurance') { if (Math.random() < .5) BJ.insure(G2, 0, 100); BJ.closeInsurance(G2); }
  let guard2 = 0;
  while (G2.phase === 'player' && guard2++ < 60) {
    const a = acts[Math.floor(Math.random() * acts.length)];
    if (!BJ.act(G2, a).ok) BJ.act(G2, 'stand');
  }
  const out = BJ.settle(G2);
  G2.spots.forEach(sp => sp.hands.forEach(h => assert.ok(h.cards.length >= 2)));
  assert.ok(out.rows.length > 0);
  assert.ok(G2.dealer.length >= 2);
  if (BJ.total(G2.dealer) <= 21 && !BJ.dealerBlackjack(G2)) assert.ok(BJ.total(G2.dealer) >= 17 || G2.dealer.length === 2, 'dealer must reach 17');
}
console.log('blackjack: all passed', n, 'asserts + 230k simulated hands');
