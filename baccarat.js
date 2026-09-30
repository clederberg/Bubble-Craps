(function () {
'use strict';
var K = window.Casino, BAC = window.BAC;
var BET_KEYS = ['player', 'banker', 'tie', 'pPair', 'bPair', 'either', 'perfect', 'dragon', 'panda'];
var st = K.game('bac', { mode: 'commission', bets: {}, last: null, shoe: null, road: [], squeeze: true });
if (st.squeeze === undefined) st.squeeze = true;
if (!st.road) st.road = [];
BET_KEYS.forEach(function (k) { if (typeof st.bets[k] !== 'number') st.bets[k] = 0; });

var G = BAC.newGame();
restoreShoe();
var phase = 'bet', round = null, result = null, reveal = 0, timer = null, seen = 0;

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
/* The same bet stays up after a coup, so Deal just repeats it. */
function restoreBets() {
  if (!st.last) return;
  var want = BET_KEYS.reduce(function (t, k) { return t + (st.last[k] || 0); }, 0);
  if (!want) return;
  if (want > bank()) {
    BET_KEYS.forEach(function (k) { st.bets[k] = 0; });
    K.toast('Not enough left to repeat that bet');
    return;
  }
  BET_KEYS.forEach(function (k) { st.bets[k] = (!ez() && (k === 'dragon' || k === 'panda')) ? 0 : (st.last[k] || 0); });
}
function doubleAndDeal() {
  if (phase !== 'bet') return;
  var base = stake() ? st.bets : st.last;
  if (!base || !BET_KEYS.reduce(function (t, k) { return t + (base[k] || 0); }, 0)) return K.toast('Place a bet first');
  var capped = false, next = {};
  BET_KEYS.forEach(function (k) {
    var lim = (k === 'player' || k === 'banker' || k === 'tie') ? BAC.LIMITS.main : BAC.LIMITS.side;
    var d = (base[k] || 0) * 2;
    if (d > lim) { d = lim; if (base[k]) capped = true; }
    next[k] = d;
  });
  var total = BET_KEYS.reduce(function (t, k) { return t + next[k]; }, 0);
  if (total > bank()) return K.toast('Not enough in your bankroll to double that bet');
  BET_KEYS.forEach(function (k) { st.bets[k] = next[k]; });
  if (capped) K.toast('Held at the table maximum');
  K.play('stack', 0, 0.8);
  K.save(); render();
  deal();
}
function rebet(andDeal) {
  if (phase !== 'bet') return;
  if (!st.last) return K.toast('No previous bet to repeat');
  var total = BET_KEYS.reduce(function (a, k) { return a + (st.last[k] || 0); }, 0);
  if (total > bank()) return K.toast('Not enough in your bankroll to repeat that');
  BET_KEYS.forEach(function (k) { st.bets[k] = st.last[k] || 0; });
  K.play('stack', 0, 0.7); K.save(); render();
  if (andDeal !== false) deal();
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
  result = null; reveal = 0; seen = 0;
  phase = st.squeeze ? 'squeeze' : 'deal';
  saveShoe(); render();
  if (st.squeeze) { K.play('deal', 0, 0.7); K.dealer.state('dealing'); K.dealer.speak('Cards out. Take your time.', true); }
  else step();
}
function step() {
  var cards = order().length;
  if (reveal < cards) {
    reveal++;
    K.play('deal', 0, 0.75);
    K.dealer.state('dealing');
    render();
    timer = setTimeout(step, reveal <= 4 ? 430 : 720);
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
  K.dealer.speak(said);
  K.dealer.state(result.net > 0 ? 'win' : result.net < 0 ? 'lose' : 'idle');
  var felt = document.querySelector('.felt');
  if (result.net > 0) { K.play('stack', 0.1, 0.85); K.resultBanner(felt, 'win', result.net); }
  else if (result.net < 0) { K.play('collide', 0.1, 0.6); K.resultBanner(felt, 'lose', result.net); }
  else { K.play('handle', 0.1, 0.5); K.resultBanner(felt, 'push', result.back); }
  saveShoe(); render();
  setTimeout(function () {
    if (phase !== 'result') return;
    phase = 'bet';
    restoreBets();
    K.save(); render();
  }, 2400);
}

/* ---------- squeeze: peel the card with the mouse ---------- */
function revealNext() {
  reveal++;
  K.play('shove', 0, 0.6);
  K.dealer.state('dealing');
  render();
  if (reveal >= order().length) { phase = 'deal'; finish(); }
}
(function squeezeHandlers() {
  var drag = null;
  document.addEventListener('pointerdown', function (e) {
    var el = e.target.closest ? e.target.closest('.squeezer') : null;
    if (!el || !squeezing()) return;
    var r = el.getBoundingClientRect();
    drag = { el: el, x: e.clientX, w: r.width, moved: 0, peel: 0 };
    el.classList.add('dragging');
    el.setPointerCapture && el.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  document.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x;
    drag.moved = Math.max(drag.moved, Math.abs(dx));
    drag.peel = Math.max(0, Math.min(1, dx / (drag.w * 1.15)));
    drag.el.style.setProperty('--peel', drag.peel.toFixed(3));
    if (drag.peel > 0.12 && !drag.ticked) { drag.ticked = true; K.play('shove', 0, 0.25); }
  });
  ['pointerup', 'pointercancel'].forEach(function (ev) {
    document.addEventListener(ev, function () {
      if (!drag) return;
      var d = drag; drag = null;
      d.el.classList.remove('dragging');
      if (d.peel > 0.5 || d.moved < 6) revealNext();
      else d.el.style.setProperty('--peel', '0');
    });
  });
})();

/* ---------- rendering ---------- */
function order() {
  var o = [['p', 0], ['b', 0], ['p', 1], ['b', 1]];
  if (round.player[2]) o.push(['p', 2]);
  if (round.banker[2]) o.push(['b', 2]);
  return o;
}
function squeezing() { return st.squeeze && phase === 'squeeze'; }
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
  if (!round) { K.setHTML($('pHand'), ''); K.setHTML($('bHand'), ''); K.setHTML($('pTotal'), ''); K.setHTML($('bTotal'), ''); return; }
  var ord = order(), html = { p: '', b: '' }, faceCount = { p: 0, b: 0 };
  ord.forEach(function (o, pos) {
    var side = o[0], idx = o[1], card = side === 'p' ? round.player[idx] : round.banker[idx];
    if (pos < reveal) {
      html[side] += K.cardHTML(card, pos >= seen ? 'deal' : '', idx);
      faceCount[side]++;
    } else if (pos === reveal && (squeezing() || phase === 'deal')) {
      if (squeezing()) {
        html[side] += '<div class="squeezer" data-peel="' + pos + '" style="--peel:0;--i:' + idx + '">'
          + '<div class="sq-face">' + K.cardHTML(card) + '</div>'
          + '<div class="sq-back">' + K.cardHTML(null) + '</div>'
          + '<span class="sq-hint">drag to peel</span></div>';
      }
    }
  });
  seen = reveal;
  K.setHTML($('pHand'), html.p);
  K.setHTML($('bHand'), html.b);
  var pc = round.player.slice(0, faceCount.p), bc = round.banker.slice(0, faceCount.b);
  K.setHTML($('pTotal'), pc.length ? '<span class="total">' + BAC.total(pc) + (round.pPair && faceCount.p >= 2 ? ' \u00b7 pair' : '') + '</span>' : '');
  K.setHTML($('bTotal'), bc.length ? '<span class="total">' + BAC.total(bc) + (round.bPair && faceCount.b >= 2 ? ' \u00b7 pair' : '') + '</span>' : '');
}

var CN = {
  player: '\u9592', banker: '\u838a', tie: '\u548c',
  pPair: '\u9592\u5c0d', bPair: '\u838a\u5c0d', either: '\u4efb\u4e00\u5c0d', perfect: '\u5b8c\u7f8e\u5c0d',
  dragon: '\u9f8d\u4e03', panda: '\u718a\u8c93\u516b'
};
function spot(k, name, pay, cls) {
  var amt = st.bets[k];
  return '<button class="spot ' + (cls || '') + (amt ? ' has' : '') + (result && winners()[k] ? ' win' : '') + '" data-bet="' + k + '">'
    + '<span class="cn">' + CN[k] + '</span>'
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
  K.setHTML($('mainRow'), spot('player', 'Player', '1 : 1', 'player')
    + spot('tie', 'Tie', '8 : 1', 'tie')
    + spot('banker', 'Banker', bankerPay, 'banker'));
  K.setHTML($('sideRow'), spot('pPair', 'P Pair', '11 : 1', 'small')
    + spot('either', 'Either Pair', '5 : 1', 'small')
    + spot('perfect', 'Perfect Pair', '25 : 1', 'small')
    + spot('bPair', 'B Pair', '11 : 1', 'small'));
  K.setHTML($('ezRow'), ez()
    ? spot('dragon', 'Dragon 7', '40 : 1', 'small dragon') + spot('panda', 'Panda 8', '25 : 1', 'small panda')
    : '');
}
var CN_RES = { P: '\u9592', B: '\u838a', T: '\u548c' };
/* Standard big road: a new column each time the winner changes, a dragon tail when a column is full. */
function bigRoad(list) {
  var cells = {}, col = 0, row = 0, last = null, maxCol = 0;
  function taken(c, r) { return !!cells[c + ',' + r]; }
  list.forEach(function (x) {
    if (x.r === 'T') { if (last !== null && cells[col + ',' + row]) cells[col + ',' + row].t++; return; }
    if (last === null) { col = 0; row = 0; }
    else if (x.r !== last) { col = maxCol + 1; row = 0; }
    else if (row < 5 && !taken(col, row + 1)) { row = row + 1; }
    else { var c = col + 1; while (taken(c, row)) c++; col = c; }
    cells[col + ',' + row] = { r: x.r, t: 0, p: x.p, b: x.b };
    if (col > maxCol) maxCol = col;
    last = x.r;
  });
  return { cells: cells, maxCol: maxCol };
}
function renderRoad() {
  var road = st.road, oldest = road.slice().reverse();
  K.setHTML($('beads'), oldest.slice(-42).map(function (x) {
    return '<span class="bead ' + x.r + '" title="' + x.r + '">' + CN_RES[x.r]
      + (x.p ? '<i class="p"></i>' : '') + (x.b ? '<i class="b"></i>' : '') + '</span>';
  }).join(''));
  var br = bigRoad(oldest), from = Math.max(0, br.maxCol - 23), h = '';
  for (var c = from; c <= Math.max(br.maxCol, from + 5); c++) {
    for (var r = 0; r < 6; r++) {
      var cell = br.cells[c + ',' + r];
      h += '<span class="bcell' + (cell ? ' ' + cell.r : '') + '">' + (cell ? '<u></u>' + (cell.t ? '<s></s>' : '') : '') + '</span>';
    }
  }
  K.setHTML($('bigRoad'), h);
  var cnt = { P: 0, B: 0, T: 0 };
  road.forEach(function (x) { cnt[x.r]++; });
  K.setHTML($('tally'), '<span style="color:var(--blue)">\u9592 <b>' + cnt.P + '</b></span>'
    + '<span style="color:#ff9a90">\u838a <b>' + cnt.B + '</b></span>'
    + '<span style="color:var(--win)">\u548c <b>' + cnt.T + '</b></span>');
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
  K.setText($('atstake'), money(stake()));
  K.setText($('shoeCount'), K.remaining(G.shoe) + ' cards');
  $('shoeBar').style.width = Math.max(0, Math.min(100, (G.shoe.cut - G.shoe.pos) / G.shoe.cut * 100)) + '%';
  K.setText($('subline'), ez()
    ? 'Eight decks \u00b7 EZ: banker pays even money, a banker three-card 7 pushes'
    : 'Eight decks \u00b7 banker pays 19:20 (5% commission) \u00b7 tie pays 8:1');
  if (phase === 'bet') K.setText($('headline'), 'Place your bets');
  else if (phase === 'squeeze') K.setText($('headline'), 'Squeeze: drag the card to peel it');
  else if (phase === 'deal') K.setText($('headline'), 'Dealing');
  else if (round) {
    var t = round.result === 'T' ? 'Tie on ' + round.pt : round.result === 'P' ? 'Player wins ' + round.pt + ' to ' + round.bt : 'Banker wins ' + round.bt + ' to ' + round.pt;
    if (round.dragon7 && ez()) t += ' · Dragon 7';
    if (round.panda8) t += ' · Panda 8';
    K.setText($('headline'), t);
  }
  $('verdict').className = 'verdict ' + (round && phase === 'result' ? round.result : '');
  K.setHTML($('verdict'), round && phase === 'result'
    ? '<b>' + CN_RES[round.result] + '</b>' + (round.result === 'T' ? 'TIE' : round.result === 'P' ? 'PLAYER WINS' : 'BANKER WINS') + (round.natural ? ' \u00b7 NATURAL' : '')
    : '');
  K.setText($('modeLabel'), ez() ? 'EZ \u00b7 \u514d\u4f63' : 'Commission \u00b7 \u4f63\u91d1');
  K.setHTML($('events'), result ? result.rows.map(function (r) {
    return '<span class="ev ' + r.kind + '">' + K.esc(r.label) + ' ' + money(r.net, true) + '</span>';
  }).join('') : '');
  var s = K.load();
  K.setText($('sound'), !s.sound ? 'Audio: Off' : s.voice ? 'Audio: All' : 'Audio: FX');
  K.setText($('squeeze'), st.squeeze ? 'Squeeze: On' : 'Squeeze: Off');
  $('deal').disabled = phase !== 'bet';
  $('squeeze').disabled = phase !== 'bet';
  $('rebet').disabled = phase !== 'bet' || (!stake() && !st.last);
  $('clear').disabled = phase !== 'bet' || !stake();
}
function mountDealer() {
  if (document.querySelector('.dealer-stage')) return;
  K.dealer.mount($('dealerStage'), K.load().dealerName || 'Dealer');
}
function renderGear() {
  K.setHTML($('shoeBox'), K.shoeHTML(G.shoe, { label: '8 decks' }));
  K.setHTML($('discardBox'), K.discardHTML(G.shoe));
}
function render() {
  mountDealer(); renderCards(); renderSpots(); renderRoad(); renderStatus(); renderGear();
  var chipSel = K.load().chip;
  if ($('chips').__chip !== chipSel) {
    $('chips').__chip = chipSel;
    K.renderChips($('chips'), chipSel, function (c) { K.load().chip = c; K.save(); K.play('lay', 0, 0.4); render(); });
  }
  K.setHTML($('rules'), rulesHTML());
}
function rulesHTML() {
  return '<summary>How this table works</summary><ul>'
    + '<li><b>Eight-deck shoe.</b> Cards are dealt by the standard tableau: both sides stand on 8 or 9, the player draws on 0-5, and the banker draws by the usual chart.</li>'
    + '<li><b>Commission game:</b> Player pays 1 to 1, Banker pays 1 to 1 less 5%, Tie pays 8 to 1 and pushes the main bets.</li>'
    + '<li><b>EZ game:</b> Banker pays even money with no commission, but when the banker wins with a three-card 7 the banker bet pushes. Player bets still lose that hand.</li>'
    + '<li><b>Dragon 7</b> (EZ only) pays 40 to 1 on that same banker three-card 7. <b>Panda 8</b> pays 25 to 1 when the player wins with a three-card 8.</li>'
    + '<li><b>Pairs:</b> Player Pair and Banker Pair pay 11 to 1, Either Pair pays 5 to 1, Perfect Pair (same rank and suit) pays 25 to 1, or 200 to 1 when both sides have one.</li>'
    + '<li><b>Squeeze:</b> with squeeze on, cards come out face down. Drag across one with the mouse or your finger to peel it, or tap it to flip it over.</li>'
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
$('rebet').addEventListener('click', doubleAndDeal);
$('clear').addEventListener('click', clearAll);
$('squeeze').addEventListener('click', function () {
  st.squeeze = !st.squeeze;
  K.save(); render();
  K.toast(st.squeeze ? 'Squeeze on: drag each card to peel it' : 'Squeeze off: cards turn themselves over');
});
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
