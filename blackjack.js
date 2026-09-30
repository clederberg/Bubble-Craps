(function () {
'use strict';
var K = window.Casino, BJ = window.BJ;
var SPOTS = 3;
var st = K.game('bj', { bets: [], last: null, shoe: null });
if (!st.bets || st.bets.length !== SPOTS) st.bets = [];
while (st.bets.length < SPOTS) st.bets.push({ bet: 0, mtd: 0, buster: 0 });

var G = BJ.newGame();
restoreShoe();
var phase = 'bet', lastResult = null, pending = false, seen = {}, limits = null, animating = false, timers = [];

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
/* After a hand the same bet stays on the table, so Deal just repeats it. */
function restoreBets() {
  if (!st.last) return;
  var want = st.last.reduce(function (t, b) { return t + b.bet + b.mtd + b.buster; }, 0);
  if (!want) return;
  if (want > bank()) {
    st.bets.forEach(function (b) { b.bet = b.mtd = b.buster = 0; });
    K.toast('Not enough left to repeat that bet');
    return;
  }
  st.bets = st.last.map(function (b) { return { bet: b.bet, mtd: b.mtd, buster: b.buster }; });
}
function doubleAndDeal() {
  if (phase !== 'bet') return;
  var base = atStake() ? st.bets : (st.last || null);
  if (!base || !base.reduce(function (t, b) { return t + b.bet + b.mtd + b.buster; }, 0)) return K.toast('Place a bet first');
  var capped = false;
  var next = base.map(function (b) {
    function cap(v, lim) { var d = v * 2; if (d > lim) { d = lim; if (v) capped = true; } return d; }
    return { bet: cap(b.bet, BJ.LIMITS.main), mtd: cap(b.mtd, BJ.LIMITS.side), buster: cap(b.buster, BJ.LIMITS.side) };
  });
  var total = next.reduce(function (t, b) { return t + b.bet + b.mtd + b.buster; }, 0);
  if (total > bank()) return K.toast('Not enough in your bankroll to double that bet');
  st.bets = next;
  if (capped) K.toast('Held at the table maximum');
  K.play('stack', 0, 0.8);
  K.save(); render();
  deal();
}
function rebet(andDeal) {
  if (phase !== 'bet') return;
  if (!st.last) return K.toast('No previous bet to repeat');
  var total = st.last.reduce(function (a, b) { return a + b.bet + b.mtd + b.buster; }, 0);
  if (total > bank()) return K.toast('Not enough in your bankroll to repeat that');
  st.bets = st.last.map(function (b) { return { bet: b.bet, mtd: b.mtd, buster: b.buster }; });
  K.play('stack', 0, 0.7); K.save(); render();
  if (andDeal !== false) deal();
}

/* ---------- staged dealing ---------- */
var STEP = 400, FLIP = 650, DRAW = 850, SPLIT_STEP = 340;
function clearTimers() { timers.forEach(clearTimeout); timers = []; }
function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
function handKey(si, hi) { return 's' + si + 'h' + hi; }
function limitFor(key, full) { return limits && limits[key] !== undefined ? limits[key] : full; }
function fullLimits(keepDealer) {
  var dealerShown = keepDealer ? Math.min((limits && limits.d) || 2, 2) : G.dealer.length;
  limits = { d: dealerShown };
  G.spots.forEach(function (sp, si) { sp.hands.forEach(function (h, hi) { limits[handKey(si, hi)] = h.cards.length; }); });
}
/* Reveal a list of cards one at a time. */
function stageReveal(steps, gap, done) {
  animating = true;
  render();
  steps.forEach(function (s, i) {
    later(function () {
      limits[s.key] = s.to;
      K.play('deal', 0, 0.75);
      K.dealer.state('dealing');
      render();
      if (i === steps.length - 1) { animating = false; render(); if (done) done(); }
    }, (gap || STEP) * (i + 1));
  });
}
function runDealSequence(done) {
  limits = { d: 0 };
  G.spots.forEach(function (sp, si) { limits[handKey(si, 0)] = 0; });
  var steps = [];
  for (var round = 0; round < 2; round++) {
    G.spots.forEach(function (sp, si) { steps.push(handKey(si, 0)); });
    steps.push('d');
  }
  animating = true;
  render();
  steps.forEach(function (key, i) {
    later(function () {
      limits[key]++;
      K.play('deal', 0, 0.75);
      K.dealer.state('dealing');
      render();
      if (i === steps.length - 1) { animating = false; render(); done(); }
    }, STEP * (i + 1));
  });
}
function revealDealer(done) {
  animating = true;
  if (!limits) limits = { d: 2 };
  limits.d = Math.min(limits.d || 2, 2);
  render();
  later(function () {
    G.dealerHole = false;
    K.play('shove', 0, 0.55);
    K.dealer.state('dealing');
    render();
    var extra = G.dealer.length - 2;
    for (var i = 0; i < extra; i++) {
      (function (n) {
        later(function () {
          limits.d = 3 + n;
          K.play('deal', 0, 0.75);
          K.dealer.state('dealing');
          render();
        }, DRAW * (n + 1));
      })(i);
    }
    later(function () { animating = false; done(); }, DRAW * extra + 320);
  }, FLIP);
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
  lastResult = null;
  seen = {};
  phase = 'play';
  clearTimers();
  saveShoe();
  var pendingPhase = G.phase;
  runDealSequence(function () {
    if (pendingPhase === 'insurance') return openInsurance();
    if (pendingPhase === 'payout') return revealDealer(finish);
    announceTurn();
    render();
  });
}
function announceTurn() {
  if (G.phase !== 'player') return;
  var h = BJ.current(G);
  if (h && h.cards.length === 2 && BJ.total(h.cards) === 21) K.dealer.speak('Blackjack!');
  else K.dealer.speak('Your play', true);
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
  if (action === 'split') {
    var sp2 = G.spots[G.active ? G.active.spot : 0] || sp;
    fullLimits(true);
    var keys = [];
    sp2.hands.forEach(function (hnd, hi) {
      var key = handKey(sp2.seat, hi);
      if (hnd.cards.length === 2 && limits[key] === 2 && keys.length < 2 && hnd.fromSplit) {
        limits[key] = 1;
        keys.push({ key: key, to: 2 });
      }
    });
    if (keys.length) {
      return stageReveal(keys, SPLIT_STEP, function () {
        if (G.phase !== 'player') return revealDealer(finish);
        render();
      });
    }
  }
  fullLimits(true);
  if (G.phase !== 'player') { render(); return revealDealer(finish); }
  render();
}
function finish() {
  phase = 'result';
  var out = BJ.settle(G);
  K.addBank(out.back);
  lastResult = out;
  fullLimits();
  var dt = BJ.total(G.dealer);
  var line = dt > 21 ? 'Dealer busts with ' + dt : BJ.dealerBlackjack(G) ? 'Dealer blackjack' : 'Dealer has ' + dt;
  K.dealer.speak(line + (out.net > 0 ? '. You win ' + money(out.net) : out.net < 0 ? '' : '. Push'));
  K.dealer.state(out.net > 0 ? 'win' : out.net < 0 ? 'lose' : 'idle');
  var felt = document.querySelector('.felt');
  if (out.net > 0) { K.play('stack', 0.15, 0.85); K.resultBanner(felt, 'win', out.net); }
  else if (out.net < 0) { K.play('collide', 0.15, 0.6); K.resultBanner(felt, 'lose', out.net); }
  else { K.play('handle', 0.15, 0.5); K.resultBanner(felt, 'push', out.back); }
  saveShoe(); render();
  setTimeout(function () {
    if (phase !== 'result') return;
    phase = 'bet';
    limits = null;
    restoreBets();
    K.save(); render();
  }, 2200);
}

/* ---------- insurance ---------- */
function openInsurance() {
  var evens = BJ.evenMoneySpots(G);
  var spots = G.spots.filter(function (sp) { return sp.bet > 0; });
  var plain = spots.filter(function (sp, i) { return evens.indexOf(i) < 0; });
  var max = plain.reduce(function (a, sp) { return a + Math.floor(sp.bet / 2); }, 0);
  var h = '';
  if (evens.length) {
    var evenPay = evens.reduce(function (t, i) { return t + G.spots[i].bet; }, 0);
    h += '<button type="button" data-even="all" class="even">Take even money on ' + (evens.length > 1 ? evens.length + ' hands' : 'seat ' + (G.spots[evens[0]].seat + 1))
      + ' &middot; ' + money(evenPay) + '</button>';
  }
  if (max > 0) {
    h += '<button type="button" data-ins="half">Insure for ' + money(max) + '</button>'
      + '<button type="button" data-ins="halfhalf">Insure for ' + money(Math.floor(max / 2)) + '</button>';
  }
  $('insRow').innerHTML = h;
  $('insTitle').textContent = evens.length ? 'Even money?' : 'Insurance?';
  $('insNote').textContent = evens.length
    ? 'The dealer shows an ace and you have a blackjack. Even money pays 1 to 1 right now. Turn it down and you get 3 to 2, unless the dealer also has blackjack, which pushes.'
    : 'The dealer shows an ace. Insurance pays 2 to 1 and costs up to half your bet (' + money(max) + ' for your ' + (spots.length > 1 ? spots.length + ' hands' : 'hand') + ').';
  $('insNo').textContent = evens.length && max <= 0 ? 'No, take the 3 to 2' : 'No thanks';
  $('insDone').style.display = (evens.length && max <= 0) ? 'none' : '';
  var d = $('insDlg');
  if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  K.dealer.speak(evens.length ? 'Even money?' : 'Insurance?');
}
function takeEvenMoney() {
  BJ.evenMoneySpots(G).forEach(function (i) { BJ.takeEvenMoney(G, i); });
  K.play('stack', 0, 0.8);
  closeInsurance();
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
  if (G.phase === 'payout') return revealDealer(finish);
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
  if (!cards.length) { K.setHTML($('dealerHand'), ''); K.setHTML($('dealerTotal'), ''); return; }
  var lim = limitFor('d', cards.length);
  if (!lim) { K.setHTML($('dealerHand'), ''); K.setHTML($('dealerTotal'), ''); return; }
  var upTo = Math.min(lim, cards.length);
  h += K.cardHTML(cards[0], fresh('d', 0), 0);
  if (G.dealerHole && upTo > 1) h += K.cardHTML(null, fresh('d', 1), 1);
  else for (var i = 1; i < upTo; i++) h += K.cardHTML(cards[i], i === 1 && !G.dealerHole ? 'flip' : fresh('d', i), i);
  markSeen('d', upTo);
  K.setHTML($('dealerHand'), h);
  var visible = cards.slice(0, upTo);
  K.setHTML($('dealerTotal'), G.dealerHole
    ? '<span class="total">' + BJ.value([cards[0]]).total + ' showing</span>'
    : totalPill(visible, { cards: visible, fromSplit: false }));
}
function renderSpots() {
  var h = '';
  for (var i = 0; i < SPOTS; i++) {
    var b = st.bets[i], sp = phase !== 'bet' ? G.spots.filter(function (x) { return x.seat === i; })[0] : null;
    var activeSpot = G.active && G.spots[G.active.spot] && G.spots[G.active.spot].seat === i;
    var seatClass = '';
    var seatRows = lastResult ? lastResult.rows.filter(function (r) { return G.spots[r.spot] && G.spots[r.spot].seat === i; }) : [];
    if (seatRows.length) {
      var seatNet = seatRows.reduce(function (t, r) { return t + r.net; }, 0);
      seatClass = ' out-' + (seatNet > 0 ? 'win' : seatNet < 0 ? 'lose' : 'push');
    }
    h += '<div class="spot' + (activeSpot ? ' active' : '') + seatClass + (!b.bet && !sp ? ' empty' : '') + '" data-spot="' + i + '">';
    h += '<span class="seat">Seat ' + (i + 1) + '</span>';
    h += '<div class="hands">';
    if (sp) {
      sp.hands.forEach(function (hand, hi) {
        var on = activeSpot && G.active.hand === hi;
        var key = handKey(sp.seat, hi);
        var vis = hand.cards.slice(0, limitFor(key, hand.cards.length));
        h += '<div class="hbox' + (on ? ' on' : '') + '"><div class="hand">'
          + vis.map(function (c, ci) { return K.cardHTML(c, fresh(key, ci), ci); }).join('') + '</div>';
        markSeen(key, vis.length);
        h += (vis.length ? totalPill(vis, vis.length === hand.cards.length ? hand : { cards: vis, fromSplit: true }) : '<span class="total ghost">&nbsp;</span>')
          + '<span class="bet"><i class="disc" style="background:' + K.chipColor(hand.bet)[0] + '"></i>' + money(hand.bet)
          + (hand.doubled ? ' dbl' : '') + (hand.surrendered ? ' surr' : '') + '</span></div>';
      });
    }
    h += '</div>';
    var main = sp ? sp.bet : b.bet, mtd = sp ? sp.mtd : b.mtd, buster = sp ? sp.buster : b.buster;
    h += '<div class="circles' + (sp ? ' locked' : '') + '">'
      + circle(i, 'bet', 'Main<br>bet', main, 'main')
      + circle(i, 'mtd', 'Match<br>dealer', mtd, 'side')
      + circle(i, 'buster', 'Buster', buster, 'side')
      + '</div>';
    if (sp && sp.ins) h += '<span class="seat">Insurance ' + money(sp.ins) + '</span>';
    else if (sp && sp.even) h += '<span class="seat">Even money</span>';
    else h += '<span class="seat sub">&nbsp;</span>';
    var rows = lastResult ? lastResult.rows.filter(function (r) { return G.spots[r.spot] && G.spots[r.spot].seat === i; }) : [];
    if (rows.length) {
      var net = rows.reduce(function (a, r) { return a + r.net; }, 0);
      var kind = net > 0 ? 'win' : net < 0 ? 'lose' : 'push';
      var word = net > 0 ? 'WIN ' + money(net) : net < 0 ? 'LOSE ' + money(-net) : 'PUSH';
      h += '<div class="res ' + kind + '">' + word + '</div>';
    } else h += '<div class="res">&nbsp;</div>';
    h += '</div>';
  }
  K.setHTML($('spots'), h);
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
  if (G.phase !== 'player' || animating) { el.hidden = true; return; }
  var o = BJ.options(G), h = '';
  var list = [['hit', 'Hit'], ['stand', 'Stand'], ['double', 'Double'], ['split', 'Split'], ['surrender', 'Surrender']];
  list.forEach(function (a) {
    if (!o[a[0]]) return;
    h += '<button class="act" data-act="' + a[0] + '">' + a[1] + '</button>';
  });
  K.setHTML(el, h);
  el.hidden = false;
}
function setText(id, txt) { K.setText($(id), txt); }
function renderStatus() {
  var bk = $('bank'), prev = +bk.dataset.v;
  bk.textContent = money(bank());
  if (!isNaN(prev) && bk.dataset.v !== undefined && bank() !== prev) {
    var cls = bank() > prev ? 'bump' : 'dip';
    bk.classList.remove('bump', 'dip'); void bk.offsetWidth; bk.classList.add(cls);
  }
  bk.dataset.v = bank();
  setText('atstake', money(phase === 'bet' ? atStake() : liveStake()));
  var left = K.remaining(G.shoe), pct = Math.max(0, Math.min(100, (G.shoe.cut - G.shoe.pos) / G.shoe.cut * 100));
  setText('shoeCount', left + ' cards');
  $('shoeBar').style.width = pct + '%';
  if (phase === 'bet') {
    setText('headline', 'Place your bets');
    setText('subline', 'Six decks \u00b7 3:2 \u00b7 dealer stands on all 17s \u00b7 up to three hands');
  } else if (G.phase === 'player') {
    var sp = G.spots[G.active.spot];
    setText('headline', 'Seat ' + (sp.seat + 1) + ' to act' + (sp.hands.length > 1 ? ' \u00b7 hand ' + (G.active.hand + 1) : ''));
    setText('subline', 'Hit, stand, double' + (BJ.options(G).split ? ', split' : '') + (BJ.options(G).surrender ? ' or surrender' : ''));
  } else if (lastResult) {
    var dt = BJ.total(G.dealer);
    setText('headline', BJ.dealerBlackjack(G) ? 'Dealer blackjack' : dt > 21 ? 'Dealer busts with ' + dt : 'Dealer has ' + dt);
    K.setHTML($('subline'), 'Round result: <b style="color:' + (lastResult.net > 0 ? 'var(--win)' : lastResult.net < 0 ? 'var(--lose)' : 'inherit') + '">' + money(lastResult.net, true) + '</b>');
  }
  K.setHTML($('events'), lastResult ? lastResult.rows.map(function (r) {
    return '<span class="ev ' + r.kind + '">' + K.esc('Seat ' + (G.spots[r.spot].seat + 1) + ': ' + r.label) + ' ' + money(r.net, true) + '</span>';
  }).join('') : '');
  var s = K.load();
  setText('sound', !s.sound ? 'Audio: Off' : s.voice ? 'Audio: All' : 'Audio: FX');
  $('deal').disabled = phase !== 'bet';
  $('rebet').disabled = phase !== 'bet' || (!atStake() && !st.last);
  $('clear').disabled = phase !== 'bet' || !atStake();
}
function liveStake() {
  return G.spots.reduce(function (a, sp) {
    return a + sp.mtd + sp.buster + sp.ins + sp.hands.reduce(function (x, h) { return x + h.bet; }, 0);
  }, 0);
}
var DEALER_NAMES = ['Nadia', 'Marco', 'Jules', 'Rhea', 'Sonny'];
function mountDealer() {
  if (document.querySelector('.dealer-stage')) return;
  K.dealer.mount($('dealerStage'), K.load().dealerName || (K.load().dealerName = DEALER_NAMES[Math.floor(Math.random() * DEALER_NAMES.length)]));
}
function renderGear() {
  K.setHTML($('shoeBox'), K.shoeHTML(G.shoe, { label: '6 decks' }));
  K.setHTML($('discardBox'), K.discardHTML(G.shoe));
}
function render() {
  mountDealer(); renderDealer(); renderSpots(); renderActions(); renderStatus(); renderGear();
  var chipSel = K.load().chip;
  if ($('chips').__chip !== chipSel) {
    $('chips').__chip = chipSel;
    K.renderChips($('chips'), chipSel, function (c) { K.load().chip = c; K.save(); K.play('lay', 0, 0.4); render(); });
  }
  K.setHTML($('rules'), rulesHTML());
}
function rulesHTML() {
  return '<summary>House rules and side bets</summary><ul>'
    + '<li><b>Six-deck shoe</b>, shuffled when the cut card comes out at about three quarters through. Not a continuous shuffler, so the count carries.</li>'
    + '<li><b>Blackjack pays 3 to 2.</b> Dealer stands on all 17s, including soft 17, which is the version that favors you.</li>'
    + '<li>Double on any two cards, double after splitting, split up to four hands. Split aces get one card each.</li>'
    + '<li>Late surrender on your first two cards. Insurance pays 2 to 1. The dealer peeks for blackjack.</li>'
    + '<li><b>Even money:</b> hold a blackjack against an ace and you are offered 1 to 1 on the spot instead of the 3 to 2 that pushes when the dealer has blackjack too.</li>'
    + '<li><b>Match the Dealer:</b> each of your first two cards that matches the dealer’s up card pays 4 to 1, or 9 to 1 if the suit matches too. Both cards can pay.</li>'
    + '<li><b>Buster Blackjack:</b> pays when the dealer busts, by how many cards it took. 3 or 4 cards 2 to 1, 5 cards 4 to 1, 6 cards 18 to 1, 7 cards 50 to 1, 8 or more 250 to 1. It pays even if your own hand busted.</li>'
    + '<li>Table limits: ' + money(BJ.LIMITS.main) + ' on the main bet, ' + money(BJ.LIMITS.side) + ' on each side bet. Bankroll is shared with the Craps and Baccarat tables.</li></ul>';
}

/* ---------- the book: basic strategy ---------- */
var UPS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
function hardPlay(t, up) {
  if (t >= 17) return 'S';
  if (t >= 13) return up <= 6 ? 'S' : (t === 16 && up >= 9 ? 'R' : 'H');
  if (t === 12) return (up >= 4 && up <= 6) ? 'S' : 'H';
  if (t === 11) return 'D';
  if (t === 10) return up <= 9 ? 'D' : 'H';
  if (t === 9) return (up >= 3 && up <= 6) ? 'D' : 'H';
  if (t === 15 && up === 10) return 'R';
  return 'H';
}
function hard(t, up) {
  if (t === 16 && (up === 9 || up === 10 || up === 11)) return 'R';
  if (t === 15 && up === 10) return 'R';
  return hardPlay(t, up);
}
function soft(t, up) { // t is the total with the ace as 11
  if (t >= 19) return 'S';
  if (t === 18) return up <= 6 ? (up >= 3 ? 'D' : 'S') : (up <= 8 ? 'S' : 'H');
  if (t === 17) return (up >= 3 && up <= 6) ? 'D' : 'H';
  if (t === 16 || t === 15) return (up >= 4 && up <= 6) ? 'D' : 'H';
  return (up === 5 || up === 6) ? 'D' : 'H';
}
function pair(r, up) {
  if (r === 'A' || r === '8') return 'P';
  if (r === '10') return 'S';
  if (r === '9') return (up === 7 || up === 10 || up === 11) ? 'S' : 'P';
  if (r === '7') return up <= 7 ? 'P' : 'H';
  if (r === '6') return up <= 6 ? 'P' : 'H';
  if (r === '5') return up <= 9 ? 'D' : 'H';
  if (r === '4') return (up === 5 || up === 6) ? 'P' : 'H';
  return up <= 7 ? 'P' : 'H';
}
function chartTable(title, rows, fn) {
  var h = '<h3>' + title + '</h3><table class="chart"><tr><th></th>';
  UPS.forEach(function (u) { h += '<th>' + (u === 11 ? 'A' : u) + '</th>'; });
  h += '</tr>';
  rows.forEach(function (r) {
    h += '<tr><td class="rowlbl">' + r.label + '</td>';
    UPS.forEach(function (u) { var p = fn(r.key, u); h += '<td class="' + p + '">' + p + '</td>'; });
    h += '</tr>';
  });
  return h + '</table>';
}
function renderBook() {
  var hardRows = [], i;
  for (i = 17; i >= 8; i--) hardRows.push({ label: i === 17 ? '17+' : String(i), key: i });
  var softRows = [];
  for (i = 9; i >= 2; i--) softRows.push({ label: 'A,' + i + (i === 9 ? '+' : ''), key: 11 + i });
  var pairRows = ['A', '10', '9', '8', '7', '6', '5', '4', '3', '2'].map(function (r) { return { label: r + ',' + r, key: r }; });
  $('chartWrap').innerHTML = chartTable('Hard totals', hardRows, hard)
    + chartTable('Soft totals', softRows, function (t, up) { return soft(t, up); })
    + chartTable('Pairs', pairRows, pair);
}
function openBook() {
  renderBook();
  var d = $('bookDlg'); if (d.showModal) d.showModal(); else d.setAttribute('open', '');
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
$('bookBtn').addEventListener('click', openBook);
$('bookClose').addEventListener('click', function () { var d = $('bookDlg'); if (d.close) d.close(); else d.removeAttribute('open'); });
$('bookDlg').addEventListener('click', function (e) { if (e.target === this) { var d = $('bookDlg'); if (d.close) d.close(); else d.removeAttribute('open'); } });
$('rebet').addEventListener('click', doubleAndDeal);
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
  var b = e.target.closest('[data-ins],[data-even]'); if (!b) return;
  if (b.dataset.even) return takeEvenMoney();
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
  if ($('resetDlg').open || $('insDlg').open || $('bookDlg').open || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  var k = e.key.toLowerCase();
  if (k === 'b') { e.preventDefault(); return openReset(); }
  if (e.code === 'Space' || k === 'enter') { e.preventDefault(); return phase === 'bet' ? deal() : null; }
  if (k === '?' || k === '/') { e.preventDefault(); return openBook(); }
  if (G.phase !== 'player' || animating) return;
  var map = { h: 'hit', s: 'stand', d: 'double', p: 'split', u: 'surrender' };
  if (map[k]) { e.preventDefault(); act(map[k]); }
});
document.addEventListener('pointerdown', function () { K.ac(); }, { once: true });
render();
})();
