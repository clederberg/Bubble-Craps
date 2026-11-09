/* Ultimate Texas Hold'em table. Rules and paytables live in uth.js; this file
   is the table: betting, the three decision points, and settling up. */
(function () {
  'use strict';
  var K = window.Casino, U = window.UTH;
  function $(id) { return document.getElementById(id); }
  var money = K.money;

  var S = K.load();
  if (typeof S.uthAnte !== 'number') S.uthAnte = 0;
  if (typeof S.uthTrips !== 'number') S.uthTrips = 0;
  if (typeof S.uthLast !== 'object' || !S.uthLast) S.uthLast = { ante: 0, trips: 0 };

  /* One deck, reshuffled every hand, which is how the game is dealt. */
  var shoe = K.newShoe(1, 1);
  var hand = null;          // the dealt cards, fixed before anyone acts
  var stage = 'bet';        // bet | preflop | flop | river | done
  var playMult = 0;
  var busy = false;
  /* How much is actually face up, kept apart from the stage so cards can be
     turned over one at a time instead of appearing all at once. */
  var shownHole = 0, shownBoard = 0, dealerUp = false, fresh = -1, revealing = false;
  var timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  var BEAT = 430;            // one board card
  function turnBoard(upTo, after) {
    revealing = true; busy = true;
    var t = 0;
    for (var n = shownBoard + 1; n <= upTo; n++) {
      (function (k) {
        /* the river gets an extra beat, because that is the one worth waiting on */
        t += BEAT + (k === 5 ? 260 : 0);
        later(function () {
          shownBoard = k; fresh = k - 1;
          K.play('deal', 0, 0.75);
          render();
        }, t);
      })(n);
    }
    t += BEAT;
    later(function () { fresh = -1; revealing = false; busy = false; if (after) after(); else render(); }, t);
  }

  /* ---------- betting ---------- */
  function atStake() {
    return S.uthAnte * 2 + S.uthTrips + S.uthAnte * playMult;
  }
  function canBet() { return stage === 'bet' && !busy; }

  function addTo(spot) {
    if (!canBet()) return;
    var chip = S.chip || 500;
    var cost = spot === 'ante' ? chip * 2 : chip;     // the blind matches the ante
    if (cost > K.bank()) return K.toast('Not enough in your bankroll for that');
    if (spot === 'ante') S.uthAnte += chip; else S.uthTrips += chip;
    K.addBank(-cost);
    K.play('lay', 0, 0.7);
    K.save(); render();
  }
  function clearBets() {
    if (!canBet()) return;
    K.addBank(S.uthAnte * 2 + S.uthTrips);
    S.uthAnte = 0; S.uthTrips = 0;
    K.play('handle', 0, 0.6);
    K.save(); render();
  }
  function rebet() {
    if (!canBet()) return;
    var want = (S.uthLast.ante * 2 + S.uthLast.trips) - (S.uthAnte * 2 + S.uthTrips);
    if (!S.uthLast.ante) return K.toast('No previous bet to repeat');
    if (want > K.bank()) return K.toast('Not enough in your bankroll for that');
    K.addBank(-want);
    S.uthAnte = S.uthLast.ante; S.uthTrips = S.uthLast.trips;
    K.play('lay', 0, 0.7);
    K.save(); render();
  }

  /* ---------- the hand ---------- */
  function deal() {
    if (stage !== 'bet' || busy) return;
    if (!S.uthAnte) return K.toast('Place an Ante first. The Blind matches it.');
    /* The biggest raise still to come is 4x, so the bankroll has to cover it
       before the cards are out rather than after. */
    if (S.uthAnte * 4 > K.bank()) return K.toast('Keep at least 4x your Ante back for the raise');
    K.ac();
    S.uthLast = { ante: S.uthAnte, trips: S.uthTrips };
    shoe = K.newShoe(1, 1);
    hand = U.deal(function () { return K.draw(shoe); });
    stage = 'preflop';
    playMult = 0;
    busy = true; revealing = true;
    shownHole = 0; shownBoard = 0; dealerUp = false; fresh = -1;
    clearTimers();
    K.save(); render();
    K.play('deal', 0, 0.7);
    later(function () { shownHole = 1; K.play('deal', 0, 0.72); render(); }, 260);
    later(function () { shownHole = 2; K.play('deal', 0, 0.74); render(); }, 560);
    later(function () { revealing = false; busy = false; render(); }, 880);
  }

  function raise(mult) {
    if (busy || stage === 'bet' || stage === 'done') return;
    var cost = S.uthAnte * mult;
    if (cost > K.bank()) return K.toast('Not enough in your bankroll for that raise');
    K.addBank(-cost);
    playMult = mult;
    K.play('lay', 0, 0.8);
    showdown(false);
  }
  function check() {
    if (busy || stage === 'done') return;
    K.play('handle', 0, 0.5);
    /* Hide the actions before drawing, or the next street's buttons sit there
       looking live for the length of the deal while every click is ignored. */
    revealing = true; busy = true;
    var upTo = stage === 'preflop' ? 3 : 5;
    stage = stage === 'preflop' ? 'flop' : 'river';
    render();
    turnBoard(upTo);
  }
  function fold() {
    if (busy || stage !== 'river') return;
    K.play('collide', 0, 0.6);
    showdown(true);
  }

  function showdown(folded) {
    busy = true; revealing = true;
    render();
    turnBoard(5, function () {
      revealing = true; busy = true;
      later(function () {
        dealerUp = true;
        K.play('deal', 0, 0.85);
        render();
        later(function () { revealing = false; finish(folded); }, 620);
      }, 380);
    });
  }

  function finish(folded) {
    stage = 'done';
    var res = U.settle({ ante: S.uthAnte, blind: S.uthAnte, trips: S.uthTrips }, playMult, folded, hand);
    /* The stakes already left the bankroll, so pay back the stake on anything
       that was not lost, plus the win on top. */
    var back = 0;
    back += res.ante > 0 ? S.uthAnte + res.ante : res.ante === 0 && !folded ? S.uthAnte : 0;
    back += res.blind > 0 ? S.uthAnte + res.blind : res.blind === 0 && !folded ? S.uthAnte : 0;
    back += res.playNet > 0 ? res.play + res.playNet : res.playNet === 0 ? res.play : 0;
    back += res.trips > 0 ? S.uthTrips + res.trips : 0;
    if (back) K.addBank(back);
    last = res;
    K.save();
    render();
    var net = res.total;
    if (net > 0) { K.play('stack', 0.1, 0.85); K.resultBanner($('felt'), 'win', net); }
    else if (net < 0) { K.play('collide', 0.1, 0.6); K.resultBanner($('felt'), 'lose', net); }
    else { K.play('handle', 0.1, 0.5); K.resultBanner($('felt'), 'push', 0); }
    setTimeout(function () { busy = false; render(); }, 600);
  }
  var last = null;

  function nextHand() {
    clearTimers();
    stage = 'bet';
    hand = null; playMult = 0; last = null;
    shownHole = 0; shownBoard = 0; dealerUp = false; fresh = -1; revealing = false;
    S.uthAnte = S.uthLast.ante; S.uthTrips = S.uthLast.trips;
    var cost = S.uthAnte * 2 + S.uthTrips;
    if (cost > K.bank()) { S.uthAnte = 0; S.uthTrips = 0; }
    else K.addBank(-cost);
    K.save(); render();
  }

  /* ---------- drawing ---------- */
  function render() {
    var b = $('board'), shown = shownBoard, h = '';
    for (var i = 0; i < 5; i++) {
      if (!hand) h += '<div class="slot"></div>';
      else if (i < shown) h += K.cardHTML(hand.board[i], i === fresh ? 'flip' : '', i);
      else h += K.cardHTML(null, '', i);
    }
    K.forceHTML(b, h);

    var hole = '';
    for (var j = 0; j < 2; j++) {
      if (!hand || j >= shownHole) hole += '';
      else hole += K.cardHTML(hand.hole[j], 'deal', j);
    }
    K.forceHTML($('playerHand'), hole);
    var dl = '';
    for (var k = 0; k < 2; k++) {
      if (!hand) dl += '';
      else dl += K.cardHTML(dealerUp ? hand.dealer[k] : null, dealerUp ? 'flip' : 'deal', k);
    }
    K.forceHTML($('dealerHand'), dl);

    K.setText($('playerName'), hand && shownHole === 2
      ? U.handName(U.score(hand.hole.concat(hand.board.slice(0, Math.max(shown, 0))))) : '');
    $('dealerName').className = 'handname' + (last && last.cmp > 0 ? ' lose' : '');
    K.setText($('dealerName'), last ? U.handName(last.dealer) + (last.dealerQualifies ? '' : ' · does not open') : '');

    paintSpot('spotAnte', S.uthAnte, stage === 'bet');
    paintSpot('spotBlind', S.uthAnte, false);
    paintSpot('spotTrips', S.uthTrips, stage === 'bet');
    paintSpot('spotPlay', S.uthAnte * playMult, false);

    K.setText($('bank'), money(K.bank()));
    K.setText($('atstake'), money(atStake()));
    K.setText($('shoeCount'), K.remaining(shoe) + ' cards');
    var bar = $('shoeBar'); if (bar) bar.style.width = Math.round(K.remaining(shoe) / 52 * 100) + '%';
    $('deal').textContent = stage === 'done' ? 'NEXT HAND' : 'DEAL';
    $('deal').disabled = busy || (stage !== 'bet' && stage !== 'done');
    paintActs();
    paintHead();
  }
  function paintSpot(id, amount, live) {
    var el = $(id);
    el.className = 'circle ' + (id === 'spotTrips' ? 'side' : 'main')
      + (amount ? '' : ' empty') + (live ? '' : ' locked') + (live && amount ? ' live' : '');
    el.querySelector('.amt').textContent = money(amount);
  }
  function paintActs() {
    var h = '';
    if (revealing) return K.setHTML($('acts'), '');
    if (stage === 'preflop') {
      h = btn('raise4', 'Bet 4x') + btn('raise3', 'Bet 3x') + btn('check', 'Check', 'quiet');
    } else if (stage === 'flop') {
      h = btn('raise2', 'Bet 2x') + btn('check', 'Check', 'quiet');
    } else if (stage === 'river') {
      h = btn('raise1', 'Bet 1x') + btn('fold', 'Fold', 'fold');
    }
    K.setHTML($('acts'), h);
  }
  function btn(act, label, cls) {
    return '<button type="button" class="act ' + (cls || '') + '" data-act="' + act + '"'
      + (busy ? ' disabled' : '') + '>' + label + '</button>';
  }
  function paintHead() {
    var head, sub = '';
    if (stage === 'bet') {
      head = S.uthAnte ? 'Deal when ready' : 'Place your Ante';
      sub = 'Ante and Blind match. One raise a hand, and the sooner you make it the more you may bet.';
    } else if (stage === 'preflop') {
      head = 'Your two cards'; sub = 'Raise 4x or 3x now, or check to see the flop for nothing.';
    } else if (stage === 'flop') {
      head = 'The flop'; sub = 'Raise 2x, or check again to see the turn and river.';
    } else if (stage === 'river') {
      head = 'Last call'; sub = 'Raise 1x or fold. Folding gives up the Ante and the Blind.';
    } else if (last) {
      head = last.folded ? 'Folded'
        : last.result === 'win' ? 'You win with ' + U.handName(last.player).toLowerCase()
        : last.result === 'lose' ? 'Dealer wins with ' + U.handName(last.dealer).toLowerCase()
        : 'Push';
      sub = summary(last);
    }
    K.setText($('headline'), head);
    K.setText($('subline'), sub);
    K.setHTML($('events'), last ? chips(last) : '');
  }
  function part(label, net, note) {
    var cls = net > 0 ? 'win' : net < 0 ? 'lose' : '';
    return '<span class="ev ' + cls + '">' + label + ' ' + (net > 0 ? money(net, true) : net < 0 ? money(net) : 'push')
      + (note ? ' · ' + note : '') + '</span>';
  }
  function chips(r) {
    var h = part('Ante', r.ante, !r.dealerQualifies && !r.folded ? 'dealer did not open' : '');
    h += part('Blind', r.blind, r.blindPay ? r.blindPay[0] + ':' + r.blindPay[1] : '');
    if (r.play) h += part('Play', r.playNet, '');
    if (S.uthTrips) h += part('Trips', r.trips, r.tripsPay ? r.tripsPay[0] + ':' + r.tripsPay[1] : '');
    return h;
  }
  function summary(r) {
    if (r.folded) return 'Ante and Blind forfeited. Trips still played.';
    return 'You: ' + U.handName(r.player) + ' · Dealer: ' + U.handName(r.dealer);
  }

  /* ---------- wiring ---------- */
  $('nav').innerHTML = K.nav('hold’em');
  K.renderChips($('chips'), S.chip, function (c) { S.chip = c; K.save(); K.play('lay', 0, 0.4); render(); });
  document.querySelectorAll('[data-spot]').forEach(function (el) {
    el.addEventListener('click', function () { addTo(el.dataset.spot); });
  });
  $('acts').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b || busy) return;
    var a = b.dataset.act;
    if (a === 'check') return check();
    if (a === 'fold') return fold();
    if (a === 'raise4') return raise(4);
    if (a === 'raise3') return raise(3);
    if (a === 'raise2') return raise(2);
    if (a === 'raise1') return raise(1);
  });
  $('deal').addEventListener('click', function () { stage === 'done' ? nextHand() : deal(); });

  /* bankroll reset, same shape as the other tables */
  function parseDollars(v) { var n = parseFloat(String(v).replace(/[$,\s]/g, '')); return isFinite(n) ? Math.round(n * 100) : NaN; }
  function openReset() {
    if (stage !== 'bet' && stage !== 'done') return K.toast('Wait for the hand to finish');
    var a = (S.startAmt || 100000) / 100;
    $('resetAmt').value = a.toLocaleString('en-US', { maximumFractionDigits: 2 });
    $('resetErr').textContent = '';
    var d = $('resetDlg'); if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  function doReset() {
    var c = parseDollars($('resetAmt').value);
    if (isNaN(c) || c < 100) { $('resetErr').textContent = 'Enter an amount of at least $1.'; return; }
    if (c > 100000000) { $('resetErr').textContent = 'The most you can start with is ' + money(100000000) + '.'; return; }
    S.bank = c; S.startAmt = c;
    S.uthAnte = 0; S.uthTrips = 0;
    stage = 'bet'; hand = null; playMult = 0; last = null;
    K.save();
    var d = $('resetDlg'); if (d.close) d.close(); else d.removeAttribute('open');
    K.play('stack', 0, 0.8); K.toast('Bankroll reset to ' + money(c)); render();
  }
  $('bankBtn').addEventListener('click', openReset);
  $('reset').addEventListener('click', openReset);
  $('resetGo').addEventListener('click', doReset);
  $('resetCancel').addEventListener('click', function () { var d = $('resetDlg'); if (d.close) d.close(); else d.removeAttribute('open'); });
  $('resetQuick').addEventListener('click', function (e) {
    var b = e.target.closest('[data-amt]'); if (!b) return;
    $('resetAmt').value = (+b.dataset.amt).toLocaleString('en-US'); $('resetErr').textContent = '';
  });
  $('audio').addEventListener('click', function () {
    if (S.sound && S.voice) S.voice = false;
    else if (S.sound) { S.sound = false; if (window.speechSynthesis) speechSynthesis.cancel(); }
    else { S.sound = true; S.voice = true; }
    K.save();
    $('audio').textContent = 'Audio: ' + (!S.sound ? 'Off' : S.voice ? 'All' : 'FX');
    if (S.sound) K.play('lay', 0, 0.6);
  });
  $('audio').textContent = 'Audio: ' + (!S.sound ? 'Off' : S.voice ? 'All' : 'FX');
  $('clearBets').addEventListener('click', clearBets);
  $('rebet').addEventListener('click', rebet);

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if ($('resetDlg').open) return;
    var k = e.key.toLowerCase();
    if (e.code === 'Space' || k === 'enter') {
      e.preventDefault();
      if (stage === 'done') return nextHand();
      if (stage === 'bet') return deal();
      if (stage === 'river') return raise(1);
      return check();
    }
    if (k === 'f' && stage === 'river') { e.preventDefault(); return fold(); }
    if (k === '4' && stage === 'preflop') { e.preventDefault(); return raise(4); }
    if (k === '3' && stage === 'preflop') { e.preventDefault(); return raise(3); }
    if (k === '2' && stage === 'flop') { e.preventDefault(); return raise(2); }
  });
  document.addEventListener('pointerdown', function () { K.ac(); }, { once: true });

  render();
})();
