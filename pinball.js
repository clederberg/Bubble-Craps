(function () {
'use strict';
var K = window.Casino, S = window.Slots, G = window.Games, FX = window.SlotFX;
function fx(name) { var a = arguments; return FX && FX[name] ? FX[name].apply(null, [].slice.call(a, 1)) : null; }
var g = G.pinball();
var st = K.game('slots-pinball', { bet: 100, credits: 1, auto: false });
if (!st.credits) st.credits = 1;
var spinning = false, timers = [];
var MAX_TOTAL = 2500000;

function $(id) { return document.getElementById(id); }
function money(c, s) { return K.money(c, s); }
function bank() { return K.bank(); }
function totalBet() { return st.bet * st.credits; }
function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
function clearTimers() { timers.forEach(clearTimeout); timers = []; }

/* ---------- reel symbols ---------- */
var BARS = { BAR1: 1, BAR2: 2, BAR3: 3 };
function symHTML(sym) {
  var def = g.symbols[sym];
  var inner;
  if (BARS[sym]) { inner = ''; for (var i = 0; i < BARS[sym]; i++) inner += '<i class="bar"></i>'; }
  else if (sym === 'SEVEN') inner = '7';
  else if (sym === 'BELL') inner = '<svg viewBox="0 0 48 48" fill="currentColor"><path d="M24 5a3 3 0 0 1 3 3v1.6c6.3 1.4 10 6.4 10 13.4 0 7 1 10 3.4 12.6.9 1 .2 2.4-1.1 2.4H8.7c-1.3 0-2-1.4-1.1-2.4C10 33 11 30 11 23c0-7 3.7-12 10-13.4V8a3 3 0 0 1 3-3z"/><path d="M19 40h10a5 5 0 0 1-10 0z"/></svg>';
  else if (sym === 'CHERRY') inner = '<svg viewBox="0 0 48 48" fill="currentColor"><path d="M25 8c6 0 11 4 14 10-4-3-8-3-11 0-2 2-3 5-3 8h-2c0-4-1-8-3-11-3-4-8-5-12-3 4-3 9-4 17-4z" opacity=".75"/><circle cx="15" cy="34" r="8"/><circle cx="33" cy="36" r="7"/></svg>';
  else if (sym === 'BALL') inner = '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="14" fill="currentColor"/><circle cx="19" cy="19" r="4.5" fill="#fff" opacity=".85"/></svg>';
  else inner = '&#9670;';
  return '<div class="psym ' + def.cls + '">' + inner + '</div>';
}
function column(reel, stop, rows) {
  var out = '';
  for (var r = 0; r < rows; r++) out += symHTML(reel[(stop + r) % reel.length]);
  return out;
}
function drawBoard(stops) {
  K.setHTML($('reels'), g.reels.map(function (reel, i) {
    return '<div class="preel"><div class="col" data-reel="' + i + '">' + column(reel, stops[i], 1) + '</div></div>';
  }).join(''));
}
function spinReels(stops, done) {
  var cell = parseFloat(getComputedStyle($('window')).getPropertyValue('--cell')) || 112;
  var lead = 16;
  g.reels.forEach(function (reel, i) {
    var col = $('reels').querySelector('[data-reel="' + i + '"]');
    var start = (stops[i] - lead + reel.length * 4) % reel.length;
    col.innerHTML = column(reel, start, lead + 1);
    col.style.transition = 'none'; col.style.transform = 'translateY(0)';
    void col.offsetWidth;
    var dur = 700 + i * 320;
    col.style.transition = 'transform ' + dur + 'ms cubic-bezier(.18,.7,.24,1)';
    col.style.transform = 'translateY(' + (-lead * cell) + 'px)';
    for (var t = 0; t < 8; t++) later(function () { fx('tick'); }, 70 + t * (dur / 9));
    later(function () {
      col.style.transition = 'none'; col.style.transform = 'translateY(0)';
      col.innerHTML = column(reel, stops[i], 1);
      fx('reelStop', i);
      if (i === g.reels.length - 1) done();
    }, dur + 20);
  });
}

/* ---------- the playfield up top ---------- */
/* Where each target sits, in the same order as the paytable: the big award is
   up at the top where the ball has to work to reach it. */
var SPOTS = [
  { x: 14, y: 70 }, { x: 62, y: 74 }, { x: 24, y: 44 },
  { x: 74, y: 44 }, { x: 44, y: 56 }, { x: 49, y: 20 }
];
var LAUNCH = { x: 93, y: 90 };
function targetHTML() {
  return g.shot.targets.map(function (t, i) {
    var sp = SPOTS[i] || { x: 50, y: 50 };
    return '<div class="target' + (t.credits >= 50 ? ' big' : '') + '" data-target="' + i + '"'
      + ' style="left:' + sp.x + '%;top:' + sp.y + '%"><b>' + t.credits + '</b><small>credits</small></div>';
  }).join('');
}
function drawPlayfield() {
  var h = '<div class="bonuslamp">Shot bonus</div>';
  h += '<i class="bumper" style="left:18%;top:24%"></i><i class="bumper" style="left:80%;top:24%"></i>';
  h += '<i class="bumper" style="left:49%;top:37%"></i>';
  h += '<div class="lane"></div>';
  h += targetHTML();
  h += '<div class="shotline" id="shotline"></div>';
  h += '<i class="ball" id="ball" style="left:' + LAUNCH.x + '%;top:' + LAUNCH.y + '%;opacity:.45"></i>';
  K.setHTML($('playfield'), h);
}
function resetTargets() {
  $('playfield').querySelectorAll('.target').forEach(function (el) { el.classList.remove('hit'); });
}
function runBonus(res) {
  var pf = $('playfield'), bonus = G.pinballBonus(g, st.bet, st.credits);
  resetTargets();
  pf.classList.remove('idle'); pf.classList.add('live');
  var ball = $('ball'), line = $('shotline'), i = 0, running = 0;
  ball.style.opacity = '1';
  K.setText($('headline'), 'Shot bonus');
  function say(txt) { K.setHTML(line, txt); }
  function park() {
    ball.style.transitionDuration = '.25s';
    ball.style.left = LAUNCH.x + '%';
    ball.style.top = LAUNCH.y + '%';
  }
  function shoot() {
    if (i >= bonus.shots.length) return finishBonus();
    var sh = bonus.shots[i++];
    var sp = SPOTS[sh.target] || { x: 50, y: 50 };
    say('Shot ' + i + ' of ' + bonus.count + (running ? ' \u00b7 ' + money(running) + ' so far' : ''));
    fx('ratchet');
    // up the lane first, then across to the target
    ball.style.transitionDuration = '.34s';
    ball.style.left = LAUNCH.x + '%';
    ball.style.top = '34%';
    later(function () {
      ball.style.transitionDuration = '.42s';
      ball.style.left = sp.x + '%';
      ball.style.top = sp.y + '%';
    }, 340);
    later(function () {
      var el = pf.querySelector('[data-target="' + sh.target + '"]');
      if (el) {
        el.classList.add('hit');
        var tag = document.createElement('div');
        tag.className = 'award';
        tag.textContent = '+' + sh.credits;
        tag.style.left = sp.x + '%';
        tag.style.top = sp.y + '%';
        pf.appendChild(tag);
        setTimeout(function () { tag.remove(); }, 1100);
      }
      running += sh.amount;
      fx(sh.credits >= 50 ? 'pocket' : 'bumper');
      say('Shot ' + i + ' of ' + bonus.count + ' \u00b7 ' + sh.credits + ' credits \u00b7 ' + money(running));
      later(function () {
        if (el) el.classList.remove('hit');
        park();
        later(shoot, 320);
      }, 620);
    }, 800);
  }
  function finishBonus() {
    say(bonus.count + (bonus.count === 1 ? ' shot paid ' : ' shots paid ') + money(bonus.total)
      + (bonus.maxed ? '' : ' \u00b7 play max credits for all five'));
    fx('coinRun', bonus.total / totalBet());
    later(function () {
      pf.classList.remove('live'); pf.classList.add('idle');
      ball.style.opacity = '.45';
      K.setHTML(line, '');
      resetTargets();
      payOut(res, bonus.total);
    }, 1900);
  }
  later(shoot, 500);
}

/* ---------- a spin ---------- */
function spin() {
  if (spinning) return;
  if (totalBet() > bank()) return K.toast('Not enough in your bankroll for that bet');
  K.ac(); clearTimers();
  spinning = true;
  K.addBank(-totalBet());
  K.setText($('lastwin'), 'WIN $0');
  $('winrow').className = 'winrow none';
  K.setHTML($('winrow'), '<span class="lbl">Line</span><span class="pay">Spinning</span>');
  K.setHTML($('events'), '');
  $('spin').disabled = true;
  pullLever();
  fx('ratchet');
  render();
  var stops = S.spinStops(g), grid = S.gridAt(g, stops);
  var res = G.pinballWin(g, grid, st.bet, st.credits);
  spinReels(stops, function () {
    if (res.bonus) return runBonus(res);
    payOut(res, 0);
  });
}
function winRowHTML(res, bonusAmount) {
  var total = (res ? res.total : 0) + (bonusAmount || 0);
  if (!res) return '<span class="lbl">Line</span><span class="pay">Pull to play</span>';
  var parts = res.wins.map(function (w) { return K.esc(w.note) + ' pays ' + money(w.amount); });
  if (bonusAmount) parts.push('ball bonus pays ' + money(bonusAmount));
  if (!parts.length) return '<span class="lbl">Line</span><span class="pay">No win</span>';
  return '<span class="lbl">Line</span><span class="pay">' + parts.join(' &middot; ') + '</span>';
}
function payOut(res, bonusAmount) {
  var total = res.total + bonusAmount;
  K.addBank(total);
  spinning = false;
  $('spin').disabled = false;
  K.setText($('lastwin'), 'WIN ' + money(total));
  var wr = $('winrow');
  wr.className = 'winrow' + (total ? '' : ' none');
  K.setHTML(wr, winRowHTML(res, bonusAmount));
  K.setHTML($('events'), res.wins.map(function (w) {
    return '<span class="ev win">' + K.esc(w.note) + ' ' + money(w.amount) + '</span>';
  }).join('') + (bonusAmount ? '<span class="ev win">Ball bonus ' + money(bonusAmount) + '</span>' : ''));
  if (total) { fx('coinRun', total / totalBet()); if (total >= totalBet() * 40) K.winBanner($('window'), total); }
  K.save(); render();
  if (st.auto && bank() >= totalBet()) later(spin, 900);
}

/* ---------- the handle ---------- */
var arm = null, dragging = false, startY = 0, PULL = 78;
function setArm(px) { arm.style.transform = 'translateY(' + px + 'px)'; }
function pullLever() {
  if (!arm) return;
  arm.classList.remove('snap'); setArm(PULL);
  void arm.offsetWidth;
  arm.classList.add('snap'); setArm(0);
}
function wireLever() {
  arm = $('arm');
  var knob = $('knob'), lever = $('lever');
  knob.addEventListener('pointerdown', function (e) {
    if (spinning) return;
    dragging = true; startY = e.clientY;
    knob.setPointerCapture(e.pointerId);
    lever.classList.add('pulling');
    arm.classList.remove('snap');
    e.preventDefault();
  });
  knob.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var dy = Math.max(0, Math.min(PULL, e.clientY - startY));
    setArm(dy);
    e.preventDefault();
  });
  function release(e) {
    if (!dragging) return;
    dragging = false;
    lever.classList.remove('pulling');
    var dy = Math.max(0, Math.min(PULL, (e.clientY || 0) - startY));
    arm.classList.add('snap');
    setArm(0);
    if (dy >= PULL * 0.5) { fx('ratchet'); spin(); }
  }
  knob.addEventListener('pointerup', release);
  knob.addEventListener('pointercancel', release);
  knob.addEventListener('click', function () { if (!spinning && !dragging) spin(); });
}

/* ---------- chrome ---------- */
function payTableHTML() {
  var b = st.bet, cr = st.credits;
  function row(label, mult, cls) {
    return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + label + '</td><td class="num">' + mult + 'x</td>'
      + '<td class="num">' + money(mult * b * (cls === 'maxrow' ? 1 : cr)) + '</td></tr>';
  }
  var sevens = cr >= g.maxCredits
    ? row('Three sevens &middot; max credits', g.pays.SEVEN.max, 'maxrow')
    : row('Three sevens', g.pays.SEVEN[3]) + '<tr class="maxrow"><td>Three sevens on 2 credits</td><td class="num">'
      + g.pays.SEVEN.max + 'x</td><td class="num">' + money(g.pays.SEVEN.max * b) + '</td></tr>';
  var lo = g.shot.targets[0].credits, hi = g.shot.targets[g.shot.targets.length - 1].credits;
  var shots = g.shot.shots[cr] || 1;
  return '<table>'
    + sevens
    + row('Three triple bars', g.pays.BAR3[3])
    + row('Three double bars', g.pays.BAR2[3])
    + row('Three bars', g.pays.BAR1[3])
    + row('Any three bars', g.anyBar)
    + row('Three bells', g.pays.BELL[3])
    + row('Three cherries', g.pays.CHERRY[3])
    + row('Two cherries from the left', g.pays.CHERRY[2])
    + row('One cherry from the left', g.pays.CHERRY[1])
    + '<tr class="' + (cr >= g.maxCredits ? '' : 'maxrow') + '"><td>Silver ball on the third reel</td>'
      + '<td class="num">' + shots + (shots === 1 ? ' shot' : ' shots') + '</td>'
      + '<td class="num">' + money(lo * b) + ' to ' + money(hi * b) + ' a shot</td></tr>'
    + '</table>'
    + '<p class="note" style="margin:8px 0 0;font-size:12px;color:#cfd8e0">The ball is launched at the lit targets, worth '
      + lo + ' to ' + hi + ' credits each. <b>Max credits gets all five shots</b>, a single credit gets one.</p>';
}
function render() {
  var bk = $('bank'), prev = +bk.dataset.v;
  bk.textContent = money(bank());
  if (!isNaN(prev) && bk.dataset.v !== undefined && bank() !== prev) {
    var cls = bank() > prev ? 'bump' : 'dip';
    bk.classList.remove('bump', 'dip'); void bk.offsetWidth; bk.classList.add(cls);
  }
  bk.dataset.v = bank();
  K.setText($('totalbet'), money(totalBet()));
  K.setText($('credit'), st.credits + (st.credits > 1 ? ' CREDITS ' : ' CREDIT ') + money(totalBet()));
  $('c1').className = st.credits >= 1 ? 'on' : '';
  $('c2').className = st.credits >= 2 ? 'on' : '';
  $('bet1').setAttribute('aria-pressed', String(st.credits === 1));
  $('betmax').setAttribute('aria-pressed', String(st.credits >= 2));
  K.setHTML($('ptable'), payTableHTML());
  K.setText($('subline'), 'Three reels · ' + st.credits + (st.credits > 1 ? ' credits at ' : ' credit at ')
    + money(st.bet) + ' · a silver ball on the third reel drops the ball');
  var s = K.load();
  K.setText($('sound'), !s.sound ? 'Audio: Off' : s.voice ? 'Audio: All' : 'Audio: FX');
  K.setText($('auto'), st.auto ? 'Auto: On' : 'Auto: Off');
  K.setText($('headline'), spinning ? 'Spinning' : 'Pull the handle');
  $('spin').disabled = spinning;
  var chipSel = K.load().chip;
  if ($('chips').__chip !== chipSel) {
    $('chips').__chip = chipSel;
    K.renderChips($('chips'), chipSel, function (c) {
      K.load().chip = c;
      st.bet = Math.min(c, Math.floor(MAX_TOTAL / st.credits));
      if (st.bet < c) K.toast('Table max is ' + money(MAX_TOTAL) + ' a spin');
      K.save(); K.play('lay', 0, 0.4); render();
    });
  }
  if (!$('reels').children.length) drawBoard(S.spinStops(g));
  if (!$('playfield').children.length) drawPlayfield();
  if (!$('winrow').children.length) { $('winrow').className = 'winrow none'; K.setHTML($('winrow'), winRowHTML(null)); }
}
function setCredits(n, andSpin) {
  if (spinning) return;
  st.credits = n;
  if (totalBet() > MAX_TOTAL) { st.bet = Math.floor(MAX_TOTAL / st.credits); K.toast('Table max is ' + money(MAX_TOTAL) + ' a spin'); }
  K.save(); K.play('place', 0, 0.55); render();
  if (andSpin) spin();
}

/* ---------- reset ---------- */
var MAX_BANK = 10000000;
function parseDollars(v) { var n = parseFloat(String(v).replace(/[$,\s]/g, '')); return isFinite(n) ? Math.round(n * 100) : NaN; }
function openReset() {
  if (spinning) return K.toast('Wait for the reels to stop');
  var s = K.load(), a = (s.startAmt || 100000) / 100;
  $('resetAmt').value = a.toLocaleString('en-US', { minimumFractionDigits: a % 1 ? 2 : 0, maximumFractionDigits: 2 });
  $('resetErr').textContent = '';
  var d = $('resetDlg'); if (d.showModal) d.showModal(); else d.setAttribute('open', '');
}
function doReset() {
  var c = parseDollars($('resetAmt').value);
  if (isNaN(c) || c < 100) { $('resetErr').textContent = 'Enter an amount of at least $1.'; return; }
  if (c > MAX_BANK) { $('resetErr').textContent = 'The most you can start with is ' + money(MAX_BANK) + '.'; return; }
  var s = K.load(); s.bank = c; s.startAmt = c; K.save();
  var d = $('resetDlg'); if (d.close) d.close(); else d.removeAttribute('open');
  K.play('stack', 0, 0.8); K.toast('Bankroll reset to ' + money(c)); render();
}

$('nav').innerHTML = K.nav('pinball');
$('spin').addEventListener('click', spin);
$('bet1').addEventListener('click', function () { setCredits(1, false); });
$('betmax').addEventListener('click', function () { setCredits(g.maxCredits, true); });
$('maxbet').addEventListener('click', function () {
  if (spinning) return;
  st.credits = g.maxCredits;
  var want = Math.min(MAX_TOTAL, bank());
  var chips = K.CHIPS.map(function (d) { return d * 100; }).filter(function (c) { return c * st.credits <= want; });
  st.bet = chips.length ? chips[chips.length - 1] : 100;
  K.load().chip = st.bet;
  K.save(); K.play('stack', 0, 0.7); render();
});
$('auto').addEventListener('click', function () { st.auto = !st.auto; K.save(); render(); if (st.auto && !spinning) spin(); });
$('sound').addEventListener('click', function () {
  var s = K.load();
  if (s.sound && s.voice) s.voice = false;
  else if (s.sound) { s.sound = false; if (window.speechSynthesis) speechSynthesis.cancel(); }
  else { s.sound = true; s.voice = true; }
  K.save(); render();
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
  if (k === '1') { e.preventDefault(); return setCredits(1, false); }
  if (k === '2' || k === 'm') { e.preventDefault(); return setCredits(g.maxCredits, false); }
  if (e.code === 'Space' || k === 'enter') { e.preventDefault(); spin(); }
});
document.addEventListener('pointerdown', function () { K.ac(); }, { once: true });
st.bet = K.load().chip || st.bet;
if (totalBet() > MAX_TOTAL) st.bet = Math.floor(MAX_TOTAL / st.credits);
wireLever();
render();
})();
