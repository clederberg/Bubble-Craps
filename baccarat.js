(function () {
'use strict';
var K = window.Casino, BAC = window.BAC;
var BET_KEYS = ['player', 'banker', 'tie', 'pPair', 'bPair', 'either', 'perfect', 'dragon', 'panda'];
var st = K.game('bac', { mode: 'commission', bets: {}, last: null, shoe: null, road: [] });
if (!st.road) st.road = [];
BET_KEYS.forEach(function (k) { if (typeof st.bets[k] !== 'number') st.bets[k] = 0; });

var G = BAC.newGame();
restoreShoe();
var phase = 'bet', round = null, result = null, reveal = 0, timer = null;

function $(id) { return document.getElementById(id); }
function money(c, s) { return K.money(c, s); }
function bank() { return K.bank(); }
function ez() { return st.mode === 'ez'; }

function saveShoe() {
  st.shoe = { c: G.shoe.cards.map(function (x) { return x.r + x.s; }), p: G.shoe.pos, cut: G.shoe.cut, pen: G.shoe.pen, decks: G.shoe.decks };
  K.save();
}
function restoreShoe() {
  var s = st.shoe;
  if (!s || !s.c || s.c.length < 52) return;
  G.shoe = { decks: s.decks, pen: s.pen, cut: s.cut, pos: s.p, shuffled: false,
    cards: s.c.map(function (t) { return { r: t.slice(0, -1), s: t.slice(-1) }; }) };
}

/* ---------- bets ---------- */
function stake() { return BET_KEYS.reduce(function (a, k) { return a + st.bets[k]; }, 0); }
function addBet(k, amount) {
  if (phase !== 'bet') return K.toast('Wait for the hand to finish');
  if (!ez() && (k === 'dragon' || k === 'panda')) return K.toast('Dragon 7 and Panda 8 are EZ bets');
  var lim = (k === 'player' || k === 'banker' || k === 'tie') ? BAC.LIMITS.main : BAC.LIMITS.side;
  var free = bank() - stake(), add = Math.min(amount, lim - st.bets[k], free);
  if (add <= 0) {
    if (free <= 0) return K.toast('Not enough in your bankroll');
    return K.toast('Table max on ' + BAC.BETS[k] + ' is ' + money(lim));
  }
  st.bets[k] += add;
  K.play('lay', 0, 0.7);
  K.save(); render();
}
function clearBet(k) {
  if (phase !== 'bet' || !st.bets[k]) return;
  st.bets[k] = 0; K.play('handle', 0, 0.6); K.save(); render();
}
function clearAll() {
  if (phase !== 'bet') return;
  BET_KEYS.forEach(function (k) { st.bets[k] = 0; });
  K.play('handle', 0, 0.7); K.save(); render();
}
function rebet() {
  if (phase !== 'bet') return;
  if (!st.last) return K.toast('No previous bet to repeat');
  var total = BET_KEYS.reduce(function (a, k) { return a + (st.last[k] || 0); }, 0);
  if (total > bank()) return K.toast('Not enough in your bankroll to repeat that');
  BET_KEYS.forEach(function (k) { st.bets[k] = st.last[k] || 0; });
  K.play('stack', 0, 0.7); K.save(); render();
}

/* ---------- deal ---------- */
function deal() {
  if (phase !== 'bet') return;
  var s = stake();
  if (!s) return K.toast('Place a bet first');
  if (s > bank()) return K.toast('Not enough in your bankroll');
  K.ac();
  st.last = {}; BET_KEYS.forEach(function (k) { st.last[k] = st.bets[k]; });
  K.addBank(-s);
  round = BAC.deal(G);
  if (round.shuffled) { K.play('shuffle', 0, 0.55); K.toast('New shoe: eight decks shuffled'); }
  result = null; reveal = 0; phase = 'deal';
  saveShoe(); render();
  step();
}
function step() {
  var cards = round.player.length + round.banker.length;
  if (reveal < cards) {
    reveal++;
    K.play('deal', 0, 0.75);
    render();
    timer = setTimeout(step, reveal <= 4 ? 320 : 520);
    return;
  }
  finish();
}
function finish() {
  result = BAC.settle(round, st.bets, st.mode);
  K.addBank(result.back);
  st.road.unshift({ r: round.result, p: round.pPair, b: round.bPair, d: round.dragon7, n: round.panda8 });
  if (st.road.length > 60) st.road.length = 60;
  phase = 'result';
  var said = round.result === 'T' ? 'Tie, ' + round.pt : (round.result === 'P' ? 'Player wins, ' + round.pt + ' to ' + round.bt : 'Banker wins, ' + round.bt + ' to ' + round.pt);
  if (round.dragon7 && ez()) said += '. Dragon seven, banker pushes';
  if (round.panda8) said += '. Panda eight';
  K.say(said);
  if (result.net > 0) K.play('stack', 0.1, 0.85);
  else if (result.net < 0) K.play('collide', 0.1, 0.6);
  saveShoe(); render();
  setTimeout(function () {
    if (phase !== 'result') return;
    phase = 'bet';
    BET_KEYS.forEach(function (k) { st.bets[k] = 0; });
    K.save(); render();
  }, 2400);
}

/* ---------- rendering ---------- */
function shown(side) {
  // deal order: player, banker, player, banker, then player's third, then banker's third
  var order = [];
  if (round.player[0]) order.push(['p', 0]);
  if (round.banker[0]) order.push(['b', 0]);
  if (round.player[1]) order.push(['p', 1]);
  if (round.banker[1]) order.push(['b', 1]);
  if (round.player[2]) order.push(['p', 2]);
  if (round.banker[2]) order.push(['b', 2]);
  var out = [];
  order.slice(0, reveal).forEach(function (o) { if (o[0] === side) out.push(o[1]); });
  return out;
}
function renderCards() {
  if (!round) { $('pHand').innerHTML = $('bHand').innerHTML = ''; $('pTotal').innerHTML = $('bTotal').innerHTML = ''; return; }
  var pIdx = shown('p'), bIdx = shown('b');
  $('pHand').innerHTML = pIdx.map(function (i) { return K.cardHTML(round.player[i]); }).join('');
  $('bHand').innerHTML = bIdx.map(function (i) { return K.cardHTML(round.banker[i]); }).join('');
  var pc = pIdx.map(function (i) { return round.player[i]; }), bc = bIdx.map(function (i) { return round.banker[i]; });
  $('pTotal').innerHTML = pc.length ? '<span class="total">' + BAC.total(pc) + (round.pPair && pIdx.length >= 2 ? ' · pair' : '') + '</span>' : '';
  $('bTotal').innerHTML = bc.length ? '<span class="total">' + BAC.total(bc) + (round.bPair && bIdx.length >= 2 ? ' · pair' : '') + '</span>' : '';
}
function spot(k, name, pay, cls) {
  var amt = st.bets[k];
  return '<button class="spot ' + (cls || '') + (amt ? ' has' : '') + (result && winners()[k] ? ' win' : '') + '" data-bet="' + k + '">'
    + '<span class="nm">' + name + '</span><span class="pay">' + pay + '</span>'
    + (amt ? '<span class="amt">' + money(amt) + '</span>' : '') + '</button>';
}
function winners() {
  var w = {};
  if (!result) return w;
  result.rows.forEach(function (r) { if (r.kind === 'win') w[r.k] = true; });
  return w;
}
function renderSpots() {
  var bankerPay = ez() ? '1 : 1 · Dragon 7 pushes' : '1 : 1 less 5%';
  $('mainRow').innerHTML = spot('player', 'Player', '1 : 1', 'player')
    + spot('tie', 'Tie', '8 : 1', 'tie')
    + spot('banker', 'Banker', bankerPay, 'banker');
  $('sideRow').innerHTML = spot('pPair', 'P Pair', '11 : 1', 'small')
    + spot('either', 'Either Pair', '5 : 1', 'small')
    + spot('perfect', 'Perfect Pair', '25 : 1', 'small')
    + spot('bPair', 'B Pair', '11 : 1', 'small');
  $('ezRow').innerHTML = ez()
    ? spot('dragon', 'Dragon 7', '40 : 1', 'small') + spot('panda', 'Panda 8', '25 : 1', 'small')
    : '';
}
function renderRoad() {
  var road = st.road;
  $('beads').innerHTML = road.slice(0, 42).reverse().map(function (x) {
    return '<span class="bead ' + x.r + '" title="' + x.r + '">' + x.r
      + (x.p ? '<i class="p"></i>' : '') + (x.b ? '<i class="b"></i>' : '') + '</span>';
  }).join('');
  var c = { P: 0, B: 0, T: 0 };
  road.forEach(function (x) { c[x.r]++; });
  $('tally').innerHTML = '<span style="color:var(--blue)">P <b>' + c.P + '</b></span>'
    + '<span style="color:#ff9a90">B <b>' + c.B + '</b></span>'
    + '<span style="color:var(--win)">T <b>' + c.T + '</b></span>';
}
function renderStatus() {
  document.querySelectorAll('.mode').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.mode === st.mode); });
  var bk = $('bank'), prev = +bk.dataset.v;
  bk.textContent = money(bank());
  if (!isNaN(prev) && bk.dataset.v !== undefined && bank() !== prev) {
    var cls = bank() > prev ? 'bump' : 'dip';
    bk.classList.remove('bump', 'dip'); void bk.offsetWidth; bk.classList.add(cls);
  }
  bk.dataset.v = bank();
  $('atstake').textContent = money(stake());
  $('shoeCount').textContent = K.remaining(G.shoe) + ' cards';
  $('shoeBar').style.width = Math.max(0, Math.min(100, (G.shoe.cut - G.shoe.pos) / G.shoe.cut * 100)) + '%';
  $('subline').textContent = ez()
    ? 'Eight decks · EZ: banker pays even money, a banker three-card 7 pushes'
    : 'Eight decks · banker pays 19:20 (5% commission) · tie pays 8:1';
  if (phase === 'bet') $('headline').textContent = 'Place your bets';
  else if (phase === 'deal') $('headline').textContent = 'Dealing';
  else if (round) {
    var t = round.result === 'T' ? 'Tie on ' + round.pt : round.result === 'P' ? 'Player wins ' + round.pt + ' to ' + round.bt : 'Banker wins ' + round.bt + ' to ' + round.pt;
    if (round.dragon7 && ez()) t += ' · Dragon 7';
    if (round.panda8) t += ' · Panda 8';
    $('headline').textContent = t;
  }
  $('verdict').className = 'verdict ' + (round && phase === 'result' ? round.result : '');
  $('verdict').textContent = round && phase === 'result'
    ? (round.result === 'T' ? 'TIE' : round.result === 'P' ? 'PLAYER WINS' : 'BANKER WINS') + (round.natural ? ' · NATURAL' : '')
    : '';
  $('events').innerHTML = result ? result.rows.map(function (r) {
    return '<span class="ev ' + r.kind + '">' + K.esc(r.label) + ' ' + money(r.net, true) + '</span>';
  }).join('') : '';
  var s = K.load();
  $('sound').textContent = !s.sound ? 'Audio: Off' : s.voice ? 'Audio: All' : 'Audio: FX';
  $('deal').disabled = phase !== 'bet';
  $('rebet').disabled = phase !== 'bet' || !st.last;
  $('clear').disabled = phase !== 'bet' || !stake();
}
function render() {
  renderCards(); renderSpots(); renderRoad(); renderStatus();
  K.renderChips($('chips'), K.load().chip, function (c) { K.load().chip = c; K.save(); K.play('lay', 0, 0.4); render(); });
  $('rules').innerHTML = rulesHTML();
}
function rulesHTML() {
  return '<summary>How this table works</summary><ul>'
    + '<li><b>Eight-deck shoe.</b> Cards are dealt by the standard tableau: both sides stand on 8 or 9, the player draws on 0-5, and the banker draws by the usual chart.</li>'
    + '<li><b>Commission game:</b> Player pays 1 to 1, Banker pays 1 to 1 less 5%, Tie pays 8 to 1 and pushes the main bets.</li>'
    + '<li><b>EZ game:</b> Banker pays even money with no commission, but when the banker wins with a three-card 7 the banker bet pushes. Player bets still lose that hand.</li>'
    + '<li><b>Dragon 7</b> (EZ only) pays 40 to 1 on that same banker three-card 7. <b>Panda 8</b> pays 25 to 1 when the player wins with a three-card 8.</li>'
    + '<li><b>Pairs:</b> Player Pair and Banker Pair pay 11 to 1, Either Pair pays 5 to 1, Perfect Pair (same rank and suit) pays 25 to 1, or 200 to 1 when both sides have one.</li>'
    + '<li>Table limits: ' + money(BAC.LIMITS.main) + ' on Player, Banker and Tie, ' + money(BAC.LIMITS.side) + ' on each side bet. Bankroll is shared with the Craps and Blackjack tables.</li></ul>';
}

/* ---------- reset dialog ---------- */
var MAX_BANK = 10000000;
function parseDollars(v) { var n = parseFloat(String(v).replace(/[$,\s]/g, '')); return isFinite(n) ? Math.round(n * 100) : NaN; }
function openReset() {
  if (phase !== 'bet') return K.toast('Wait for the hand to finish');
  var s = K.load(), a = (s.startAmt || 100000) / 100;
  $('resetAmt').value = a.toLocaleString('en-US', { minimumFractionDigits: a % 1 ? 2 : 0, maximumFractionDigits: 2 });
  $('resetErr').textContent = '';
  var d = $('resetDlg'); if (d.showModal) d.showModal(); else d.setAttribute('open', '');
}
function doReset() {
  var c = parseDollars($('resetAmt').value);
  if (isNaN(c) || c < 100) { $('resetErr').textContent = 'Enter an amount of at least $1.'; return; }
  if (c > MAX_BANK) { $('resetErr').textContent = 'The most you can start with is ' + money(MAX_BANK) + '.'; return; }
  var s = K.load();
  s.bank = c; s.startAmt = c;
  BET_KEYS.forEach(function (k) { st.bets[k] = 0; });
  K.save();
  var d = $('resetDlg'); if (d.close) d.close(); else d.removeAttribute('open');
  K.play('stack', 0, 0.8); K.toast('Bankroll reset to ' + money(c)); render();
}

/* ---------- wiring ---------- */
$('nav').innerHTML = K.nav('baccarat');
document.querySelector('.layout').addEventListener('click', function (e) {
  var b = e.target.closest('[data-bet]'); if (b) addBet(b.dataset.bet, K.load().chip);
});
document.querySelector('.layout').addEventListener('contextmenu', function (e) {
  var b = e.target.closest('[data-bet]'); if (!b) return;
  e.preventDefault(); clearBet(b.dataset.bet);
});
document.querySelector('.modes').addEventListener('click', function (e) {
  var b = e.target.closest('[data-mode]'); if (!b || phase !== 'bet') return;
  st.mode = b.dataset.mode;
  if (!ez()) { st.bets.dragon = 0; st.bets.panda = 0; }
  K.save(); render();
});
$('deal').addEventListener('click', deal);
$('rebet').addEventListener('click', rebet);
$('clear').addEventListener('click', clearAll);
$('sound').addEventListener('click', function () {
  var s = K.load();
  if (s.sound && s.voice) s.voice = false;
  else if (s.sound) { s.sound = false; if (window.speechSynthesis) speechSynthesis.cancel(); }
  else { s.sound = true; s.voice = true; }
  K.save(); render();
  if (s.sound) K.play('lay', 0, 0.6);
});
$('bankBtn').addEventListener('click', openReset);
$('reset').addEventListener('click', openReset);
$('resetForm').addEventListener('submit', function (e) { e.preventDefault(); doReset(); });
$('resetCancel').addEventListener('click', function () { var d = $('resetDlg'); if (d.close) d.close(); else d.removeAttribute('open'); });
$('resetPresets').addEventListener('click', function (e) {
  var b = e.target.closest('[data-amt]'); if (!b) return;
  $('resetAmt').value = (+b.dataset.amt).toLocaleString('en-US'); $('resetErr').textContent = '';
});
document.addEventListener('keydown', function (e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if ($('resetDlg').open || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  var k = e.key.toLowerCase();
  if (k === 'b') { e.preventDefault(); return openReset(); }
  if (e.code === 'Space' || k === 'enter') { e.preventDefault(); deal(); }
});
document.addEventListener('pointerdown', function () { K.ac(); }, { once: true });
render();
})();
