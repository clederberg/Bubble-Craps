(function () {
'use strict';
var K = window.Casino, BJ = window.BJ;
var SPOTS = 3;
var st = K.game('bj', { bets: [], last: null, shoe: null });
if (!st.bets || st.bets.length !== SPOTS) st.bets = [];
while (st.bets.length < SPOTS) st.bets.push({ bet: 0, mtd: 0, buster: 0 });

var G = BJ.newGame();
restoreShoe();
var phase = 'bet', lastResult = null, pending = false, seen = {};

function $(id) { return document.getElementById(id); }
function money(c, s) { return K.money(c, s); }
function bank() { return K.bank(); }

/* ---------- shoe kept across reloads ---------- */
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

/* ---------- betting ---------- */
function atStake() {
  return st.bets.reduce(function (a, b) { return a + b.bet + b.mtd + b.buster; }, 0);
}
function addBet(i, kind, amount) {
  if (phase !== 'bet') return K.toast('Finish the hand first');
  var b = st.bets[i], lim = kind === 'bet' ? BJ.LIMITS.main : BJ.LIMITS.side;
  var room = lim - b[kind], free = bank() - atStake();
  var add = Math.min(amount, room, free);
  if (add <= 0) {
    if (free <= 0) return K.toast('Not enough in your bankroll');
    return K.toast('Table max on ' + (kind === 'bet' ? 'the main bet' : kind === 'mtd' ? 'Match the Dealer' : 'Buster') + ' is ' + money(lim));
  }
  b[kind] += add;
  if (!K.play('lay', 0, 0.7)) K.play('place', 0, 0.7);
  K.save(); render();
}
function removeBet(i, kind) {
  if (phase !== 'bet') return;
  var b = st.bets[i];
  if (!b[kind]) return;
  b[kind] = 0;
  K.play('handle', 0, 0.6);
  K.save(); render();
}
function clearBets() {
  if (phase !== 'bet') return;
  st.bets.forEach(function (b) { b.bet = b.mtd = b.buster = 0; });
  K.play('handle', 0, 0.7); K.save(); render();
}
function rebet() {
  if (phase !== 'bet') return;
  if (!st.last) return K.toast('No previous bet to repeat');
  var total = st.last.reduce(function (a, b) { return a + b.bet + b.mtd + b.buster; }, 0);
  if (total > bank()) return K.toast('Not enough in your bankroll to repeat that');
  st.bets = st.last.map(function (b) { return { bet: b.bet, mtd: b.mtd, buster: b.buster }; });
  K.play('stack', 0, 0.7); K.save(); render();
}

/* ---------- round ---------- */
function deal() {
  if (phase !== 'bet') return;
  var stake = atStake();
  if (!stake) return K.toast('Place a bet first');
  if (stake > bank()) return K.toast('Not enough in your bankroll');
  K.ac();
  st.last = st.bets.map(function (b) { return { bet: b.bet, mtd: b.mtd, buster: b.buster }; });
  K.addBank(-stake);
  var bets = st.bets.map(function (b, i) { return { seat: i, bet: b.bet, mtd: b.mtd, buster: b.buster }; });
  BJ.deal(G, bets);
  if (G.events.some(function (e) { return e.t === 'shuffle'; })) { K.play('shuffle', 0, 0.55); K.toast('New shoe: six decks shuffled'); }
  K.play('deal', 0.05, 0.8); K.play('deal', 0.22, 0.7); K.play('deal', 0.4, 0.7);
  lastResult = null;
  seen = {};
  phase = 'play';
  saveShoe(); render();
  if (G.phase === 'insurance') return openInsurance();
  if (G.phase === 'payout') return finish();
  announceTurn();
}
function announceTurn() {
  if (G.phase !== 'player') return;
  var h = BJ.current(G);
  if (h && h.cards.length === 2 && BJ.total(h.cards) === 21) K.say('Blackjack!');
}
function act(action) {
  if (G.phase !== 'player') return;
  var before = BJ.current(G);
  var r = BJ.act(G, action);
  if (!r.ok) return K.toast(r.reason);
  if (r.cost) {
    if (r.cost > bank()) { K.toast('Not enough in your bankroll'); return; }
    K.addBank(-r.cost);
  }
  if (action === 'hit' || action === 'double' || action === 'split') K.play('deal', 0, 0.8);
  else K.play('shove', 0, 0.5);
  if (action === 'surrender') K.say('Surrender');
  if (before && BJ.total(before.cards) > 21) K.say('Bust');
  saveShoe();
  if (G.phase !== 'player') return finish();
  render();
}
function finish() {
  phase = 'result';
  var out = BJ.settle(G);
  K.addBank(out.back);
  lastResult = out;
  var dt = BJ.total(G.dealer);
  var line = dt > 21 ? 'Dealer busts with ' + dt : BJ.dealerBlackjack(G) ? 'Dealer blackjack' : 'Dealer has ' + dt;
  K.say(line + (out.net > 0 ? '. You win ' + money(out.net) : ''));
  if (out.net > 0) K.play('stack', 0.15, 0.85);
  else if (out.net < 0) K.play('collide', 0.15, 0.6);
  saveShoe(); render();
  setTimeout(function () {
    if (phase !== 'result') return;
    phase = 'bet';
    st.bets.forEach(function (b) { b.bet = b.mtd = b.buster = 0; });
    K.save(); render();
  }, 2200);
}

/* ---------- insurance ---------- */
function openInsurance() {
  var spots = G.spots.filter(function (sp) { return sp.bet > 0; });
  var max = spots.reduce(function (a, sp) { return a + Math.floor(sp.bet / 2); }, 0);
  $('insNote').textContent = 'The dealer shows an ace. Insurance pays 2 to 1 and costs up to half your bet ('
    + money(max) + ' for your ' + (spots.length > 1 ? spots.length + ' hands' : 'hand') + ').';
  $('insRow').innerHTML = '<button type="button" data-ins="half">Insure for ' + money(max) + '</button>'
    + '<button type="button" data-ins="halfhalf">Insure for ' + money(Math.floor(max / 2)) + '</button>';
  var d = $('insDlg');
  if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  K.say('Insurance?');
}
function takeInsurance(fraction) {
  var spent = 0;
  G.spots.forEach(function (sp, i) {
    var want = Math.floor(Math.floor(sp.bet / 2) * fraction);
    if (want <= 0) return;
    if (want > bank() - spent) want = bank() - spent;
    var r = BJ.insure(G, i, want);
    if (r.ok) spent += r.added;
  });
  if (spent) { K.addBank(-spent); K.play('lay', 0, 0.7); }
  closeInsurance();
}
function closeInsurance() {
  var d = $('insDlg');
  if (d.close) d.close(); else d.removeAttribute('open');
  BJ.closeInsurance(G);
  saveShoe(); render();
  if (G.phase === 'payout') return finish();
  announceTurn();
}

/* ---------- rendering ---------- */
function totalPill(cards, hand) {
  var v = BJ.value(cards), cls = '', txt;
  if (hand && BJ.isBlackjack(hand)) { cls = 'bj'; txt = 'Blackjack'; }
  else if (v.total > 21) { cls = 'bust'; txt = 'Bust ' + v.total; }
  else txt = (v.soft && v.total !== 21 ? v.total - 10 + '/' : '') + v.total;
  return '<span class="total ' + cls + '">' + txt + '</span>';
}
function fresh(key, i) {
  var n = seen[key] || 0;
  return i >= n ? 'deal' : '';
}
function markSeen(key, n) { seen[key] = n; }
function renderDealer() {
  var cards = G.dealer, h = '';
  if (!cards.length) { $('dealerHand').innerHTML = ''; $('dealerTotal').innerHTML = ''; return; }
  var shownCount = G.dealerHole ? 2 : cards.length;
  h += K.cardHTML(cards[0], fresh('d', 0));
  if (G.dealerHole && cards.length > 1) h += K.cardHTML(null, fresh('d', 1));
  else for (var i = 1; i < cards.length; i++) h += K.cardHTML(cards[i], i === 1 ? 'flip' : fresh('d', i));
  markSeen('d', shownCount);
  $('dealerHand').innerHTML = h;
  $('dealerTotal').innerHTML = G.dealerHole
    ? '<span class="total">' + BJ.value([cards[0]]).total + ' showing</span>'
    : totalPill(cards, { cards: cards, fromSplit: false });
}
function renderSpots() {
  var h = '';
  for (var i = 0; i < SPOTS; i++) {
    var b = st.bets[i], sp = phase !== 'bet' ? G.spots.filter(function (x) { return x.seat === i; })[0] : null;
    var activeSpot = G.active && G.spots[G.active.spot] && G.spots[G.active.spot].seat === i;
    h += '<div class="spot' + (activeSpot ? ' active' : '') + (!b.bet && !sp ? ' empty' : '') + '" data-spot="' + i + '">';
    h += '<span class="seat">Seat ' + (i + 1) + '</span>';
    if (sp) {
      h += '<div class="hands">';
      sp.hands.forEach(function (hand, hi) {
        var on = activeSpot && G.active.hand === hi;
        var key = 's' + i + 'h' + hi;
        h += '<div class="hbox' + (on ? ' on' : '') + '"><div class="hand">'
          + hand.cards.map(function (c, ci) { return K.cardHTML(c, fresh(key, ci)); }).join('') + '</div>';
        markSeen(key, hand.cards.length);
        h += ''
          + totalPill(hand.cards, hand)
          + '<span class="bet"><i class="disc" style="background:' + K.chipColor(hand.bet)[0] + '"></i>' + money(hand.bet)
          + (hand.doubled ? ' dbl' : '') + (hand.surrendered ? ' surr' : '') + '</span></div>';
      });
      h += '</div>';
      var extra = [];
      if (sp.mtd) extra.push('MTD ' + money(sp.mtd));
      if (sp.buster) extra.push('Buster ' + money(sp.buster));
      if (sp.ins) extra.push('Insurance ' + money(sp.ins));
      if (extra.length) h += '<span class="seat">' + extra.join(' · ') + '</span>';
      var rows = lastResult ? lastResult.rows.filter(function (r) { return G.spots[r.spot] && G.spots[r.spot].seat === i; }) : [];
      if (rows.length) {
        var net = rows.reduce(function (a, r) { return a + r.net; }, 0);
        h += '<div class="res ' + (net > 0 ? 'win' : net < 0 ? 'lose' : 'push') + '">' + money(net, true) + '</div>';
      }
    } else {
      h += '<div class="circles">'
        + circle(i, 'bet', 'Main<br>bet', b.bet, 'main')
        + circle(i, 'mtd', 'Match<br>dealer', b.mtd, 'side')
        + circle(i, 'buster', 'Buster', b.buster, 'side')
        + '</div>';
    }
    h += '</div>';
  }
  $('spots').innerHTML = h;
}
function circle(i, kind, label, amount, cls) {
  var chip = '';
  if (amount) {
    var col = K.chipColor(amount);
    chip = '<span class="chipdisc" style="background:' + col[0] + ';color:' + col[1] + '">' + K.chipText(amount) + '</span>';
  }
  return '<button class="circle ' + cls + (amount ? ' has' : '') + '" data-bet="' + i + '|' + kind + '">'
    + '<span class="lbl">' + label + '</span>' + chip + '</button>';
}
function renderActions() {
  var el = $('actions');
  if (G.phase !== 'player') { el.hidden = true; return; }
  var o = BJ.options(G), h = '';
  var list = [['hit', 'Hit'], ['stand', 'Stand'], ['double', 'Double'], ['split', 'Split'], ['surrender', 'Surrender']];
  list.forEach(function (a) {
    if (!o[a[0]]) return;
    h += '<button class="act' + (a[0] === 'stand' ? ' primary' : '') + '" data-act="' + a[0] + '">' + a[1] + '</button>';
  });
  el.innerHTML = h;
  el.hidden = false;
}
function renderStatus() {
  var bk = $('bank'), prev = +bk.dataset.v;
  bk.textContent = money(bank());
  if (!isNaN(prev) && bk.dataset.v !== undefined && bank() !== prev) {
    var cls = bank() > prev ? 'bump' : 'dip';
    bk.classList.remove('bump', 'dip'); void bk.offsetWidth; bk.classList.add(cls);
  }
  bk.dataset.v = bank();
  $('atstake').textContent = money(phase === 'bet' ? atStake() : liveStake());
  var left = K.remaining(G.shoe), pct = Math.max(0, Math.min(100, (G.shoe.cut - G.shoe.pos) / G.shoe.cut * 100));
  $('shoeCount').textContent = left + ' cards';
  $('shoeBar').style.width = pct + '%';
  if (phase === 'bet') {
    $('headline').textContent = lastResult ? 'Place your bets' : 'Place your bets';
    $('subline').textContent = 'Six decks · 3:2 · dealer stands on all 17s · up to three hands';
  } else if (G.phase === 'player') {
    var sp = G.spots[G.active.spot];
    $('headline').textContent = 'Seat ' + (sp.seat + 1) + ' to act' + (sp.hands.length > 1 ? ' · hand ' + (G.active.hand + 1) : '');
    $('subline').textContent = 'Hit, stand, double' + (BJ.options(G).split ? ', split' : '') + (BJ.options(G).surrender ? ' or surrender' : '');
  } else if (lastResult) {
    var dt = BJ.total(G.dealer);
    $('headline').textContent = BJ.dealerBlackjack(G) ? 'Dealer blackjack' : dt > 21 ? 'Dealer busts with ' + dt : 'Dealer has ' + dt;
    $('subline').innerHTML = 'Round result: <b style="color:' + (lastResult.net > 0 ? 'var(--win)' : lastResult.net < 0 ? 'var(--lose)' : 'inherit') + '">' + money(lastResult.net, true) + '</b>';
  }
  $('events').innerHTML = lastResult ? lastResult.rows.map(function (r) {
    return '<span class="ev ' + r.kind + '">' + K.esc('Seat ' + (G.spots[r.spot].seat + 1) + ': ' + r.label) + ' ' + money(r.net, true) + '</span>';
  }).join('') : '';
  var s = K.load();
  $('sound').textContent = !s.sound ? 'Audio: Off' : s.voice ? 'Audio: All' : 'Audio: FX';
  $('deal').disabled = phase !== 'bet';
  $('rebet').disabled = phase !== 'bet' || !st.last;
  $('clear').disabled = phase !== 'bet' || !atStake();
}
function liveStake() {
  return G.spots.reduce(function (a, sp) {
    return a + sp.mtd + sp.buster + sp.ins + sp.hands.reduce(function (x, h) { return x + h.bet; }, 0);
  }, 0);
}
function renderGear() {
  $('shoeBox').innerHTML = K.shoeHTML(G.shoe, { label: '6 decks' });
  $('discardBox').innerHTML = K.discardHTML(G.shoe);
}
function render() {
  renderDealer(); renderSpots(); renderActions(); renderStatus(); renderGear();
  K.renderChips($('chips'), K.load().chip, function (c) { K.load().chip = c; K.save(); K.play('lay', 0, 0.4); render(); });
  $('rules').innerHTML = rulesHTML();
}
function rulesHTML() {
  return '<summary>House rules and side bets</summary><ul>'
    + '<li><b>Six-deck shoe</b>, shuffled when the cut card comes out at about three quarters through. Not a continuous shuffler, so the count carries.</li>'
    + '<li><b>Blackjack pays 3 to 2.</b> Dealer stands on all 17s, including soft 17, which is the version that favors you.</li>'
    + '<li>Double on any two cards, double after splitting, split up to four hands. Split aces get one card each.</li>'
    + '<li>Late surrender on your first two cards. Insurance pays 2 to 1. The dealer peeks for blackjack.</li>'
    + '<li><b>Match the Dealer:</b> each of your first two cards that matches the dealer’s up card pays 4 to 1, or 9 to 1 if the suit matches too. Both cards can pay.</li>'
    + '<li><b>Buster Blackjack:</b> pays when the dealer busts, by how many cards it took. 3 or 4 cards 2 to 1, 5 cards 4 to 1, 6 cards 18 to 1, 7 cards 50 to 1, 8 or more 250 to 1. It pays even if your own hand busted.</li>'
    + '<li>Table limits: ' + money(BJ.LIMITS.main) + ' on the main bet, ' + money(BJ.LIMITS.side) + ' on each side bet. Bankroll is shared with the Craps and Baccarat tables.</li></ul>';
}

/* ---------- reset dialog ---------- */
var MAX_BANK = 10000000;
function parseDollars(v) { var n = parseFloat(String(v).replace(/[$,\s]/g, '')); return isFinite(n) ? Math.round(n * 100) : NaN; }
function openReset() {
  if (phase !== 'bet') return K.toast('Finish the hand first');
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
  st.bets.forEach(function (b) { b.bet = b.mtd = b.buster = 0; });
  K.save();
  var d = $('resetDlg'); if (d.close) d.close(); else d.removeAttribute('open');
  K.play('stack', 0, 0.8); K.toast('Bankroll reset to ' + money(c)); render();
}

/* ---------- wiring ---------- */
$('nav').innerHTML = K.nav('blackjack');
$('spots').addEventListener('click', function (e) {
  var b = e.target.closest('[data-bet]'); if (!b) return;
  var p = b.dataset.bet.split('|');
  addBet(+p[0], p[1], K.load().chip);
});
$('spots').addEventListener('contextmenu', function (e) {
  var b = e.target.closest('[data-bet]'); if (!b) return;
  e.preventDefault();
  var p = b.dataset.bet.split('|');
  removeBet(+p[0], p[1]);
});
$('actions').addEventListener('click', function (e) {
  var b = e.target.closest('[data-act]'); if (b) act(b.dataset.act);
});
$('deal').addEventListener('click', deal);
$('rebet').addEventListener('click', rebet);
$('clear').addEventListener('click', clearBets);
$('sound').addEventListener('click', function () {
  var s = K.load();
  if (s.sound && s.voice) s.voice = false;
  else if (s.sound) { s.sound = false; if (window.speechSynthesis) speechSynthesis.cancel(); }
  else { s.sound = true; s.voice = true; }
  K.save(); render();
  if (s.sound) K.play('lay', 0, 0.6);
});
$('insRow').addEventListener('click', function (e) {
  var b = e.target.closest('[data-ins]'); if (!b) return;
  takeInsurance(b.dataset.ins === 'half' ? 1 : 0.5);
});
$('insNo').addEventListener('click', closeInsurance);
$('insDone').addEventListener('click', closeInsurance);
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
  if ($('resetDlg').open || $('insDlg').open || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  var k = e.key.toLowerCase();
  if (k === 'b') { e.preventDefault(); return openReset(); }
  if (e.code === 'Space' || k === 'enter') { e.preventDefault(); return phase === 'bet' ? deal() : null; }
  if (G.phase !== 'player') return;
  var map = { h: 'hit', s: 'stand', d: 'double', p: 'split', u: 'surrender' };
  if (map[k]) { e.preventDefault(); act(map[k]); }
});
document.addEventListener('pointerdown', function () { K.ac(); }, { once: true });
render();
})();
