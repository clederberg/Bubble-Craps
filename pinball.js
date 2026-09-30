(function () {
'use strict';
var K = window.Casino, S = window.Slots, G = window.Games;
var g = G.pinball();
var st = K.game('slots-pinball', { bet: 100, auto: false });
var spinning = false, timers = [];

function $(id) { return document.getElementById(id); }
function money(c, s) { return K.money(c, s); }
function bank() { return K.bank(); }
function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
function clearTimers() { timers.forEach(clearTimeout); timers = []; }

var BARS = { BAR1: 1, BAR2: 2, BAR3: 3 };
function symHTML(sym) {
  var def = g.symbols[sym];
  var inner;
  if (BARS[sym]) { inner = ''; for (var i = 0; i < BARS[sym]; i++) inner += '<i class="bar"></i>'; }
  else if (sym === 'SEVEN') inner = '7';
  else if (sym === 'BELL') inner = 'BELL';
  else if (sym === 'CHERRY') inner = 'CHERRY';
  else if (sym === 'BALL') inner = 'BALL';
  else inner = '◆';
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
  var cell = parseFloat(getComputedStyle($('window')).getPropertyValue('--cell')) || 118;
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
    later(function () { K.play('shove', 0, 0.4); }, dur - 30);
    later(function () {
      col.style.transition = 'none'; col.style.transform = 'translateY(0)';
      col.innerHTML = column(reel, stops[i], 1);
      if (i === g.reels.length - 1) done();
    }, dur + 20);
  });
}

function spin() {
  if (spinning) return;
  if (st.bet > bank()) return K.toast('Not enough in your bankroll for that bet');
  K.ac(); clearTimers();
  spinning = true;
  K.addBank(-st.bet);
  K.setText($('lastwin'), 'WIN $0');
  K.setHTML($('events'), '');
  $('spin').disabled = true;
  K.play('lay', 0, 0.5);
  render();
  var stops = S.spinStops(g), grid = S.gridAt(g, stops);
  var res = G.pinballWin(g, grid, st.bet);
  spinReels(stops, function () {
    if (res.bonus) return runBonus(res);
    payOut(res, 0);
  });
}
function payOut(res, bonusAmount) {
  var total = res.total + bonusAmount;
  K.addBank(total);
  spinning = false;
  $('spin').disabled = false;
  K.setText($('lastwin'), 'WIN ' + money(total).replace('$', '$'));
  K.setHTML($('events'), res.wins.map(function (w) {
    return '<span class="ev win">' + K.esc(w.note) + ' ' + money(w.amount) + '</span>';
  }).join('') + (bonusAmount ? '<span class="ev win">Pinball bonus ' + money(bonusAmount) + '</span>' : ''));
  if (total) { K.play('stack', 0, 0.8); if (total >= st.bet * 40) K.winBanner($('window'), total); }
  K.save(); render();
  if (st.auto && bank() >= st.bet) later(spin, 900);
}

/* ---------- the pinball drop ---------- */
function runBonus(res) {
  var ov = $('overlay'), drop = G.pinballBonus(g, st.bet);
  ov.hidden = false;
  var rows = g.pins.rows, pegs = '';
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c <= r; c++) {
      var x = 50 + (c - r / 2) * (86 / rows), y = 8 + (r + 1) * (74 / (rows + 1));
      pegs += '<i class="peg" style="left:' + x + '%;top:' + y + '%"></i>';
    }
  }
  var slots = g.pins.slots.map(function (v, i) { return '<div data-slot="' + i + '">' + v + 'x</div>'; }).join('');
  K.setHTML(ov, '<h3 style="margin:0;font:600 20px Oswald,sans-serif;letter-spacing:.12em;color:#ffd970">PINBALL BONUS</h3>'
    + '<div class="pegboard" id="pegboard">' + pegs + '<div class="ball" id="ball" style="left:calc(50% - 8px);top:2%"></div>'
    + '<div class="slots">' + slots + '</div></div>');
  K.play('shuffle', 0, 0.4);
  var ball = $('ball'), pos = 0;
  var step = 0;
  (function fall() {
    if (step >= rows) {
      var idx = drop.slot;
      var cell = ov.querySelector('[data-slot="' + idx + '"]');
      if (cell) cell.classList.add('hit');
      K.play('stack', 0, 0.9);
      later(function () { ov.hidden = true; payOut(res, drop.amount); }, 1500);
      return;
    }
    pos += drop.path[step];
    var spread = (pos - (step + 1) / 2) * (86 / rows);
    ball.style.left = 'calc(' + (50 + spread) + '% - 8px)';
    ball.style.top = (8 + (step + 1) * (74 / (rows + 1))) + '%';
    K.play('shove', 0, 0.3);
    step++;
    later(fall, 260);
  })();
}

/* ---------- chrome ---------- */
function payTableHTML() {
  var b = st.bet;
  function row(label, mult) { return '<tr><td>' + label + '</td><td class="num">' + mult + 'x</td><td class="num">' + money(mult * b) + '</td></tr>'; }
  return '<table>'
    + row('Three sevens', g.pays.SEVEN[3])
    + row('Three triple bars', g.pays.BAR3[3])
    + row('Three double bars', g.pays.BAR2[3])
    + row('Three bars', g.pays.BAR1[3])
    + row('Any three bars', g.anyBar)
    + row('Three bells', g.pays.BELL[3])
    + row('Three cherries', g.pays.CHERRY[3])
    + row('Two cherries from the left', g.pays.CHERRY[2])
    + row('One cherry from the left', g.pays.CHERRY[1])
    + '<tr><td>Three silver balls</td><td class="num">bonus</td><td class="num">' + money(10 * b) + ' to ' + money(250 * b) + '</td></tr>'
    + '</table>';
}
function render() {
  var bk = $('bank'), prev = +bk.dataset.v;
  bk.textContent = money(bank());
  if (!isNaN(prev) && bk.dataset.v !== undefined && bank() !== prev) {
    var cls = bank() > prev ? 'bump' : 'dip';
    bk.classList.remove('bump', 'dip'); void bk.offsetWidth; bk.classList.add(cls);
  }
  bk.dataset.v = bank();
  K.setText($('totalbet'), money(st.bet));
  K.setText($('credit'), 'BET ' + money(st.bet));
  K.setHTML($('ptable'), payTableHTML());
  var s = K.load();
  K.setText($('sound'), !s.sound ? 'Audio: Off' : s.voice ? 'Audio: All' : 'Audio: FX');
  K.setText($('auto'), st.auto ? 'Auto: On' : 'Auto: Off');
  K.setText($('headline'), spinning ? 'Spinning' : 'Drop a coin and pull');
  $('spin').disabled = spinning;
  var chipSel = K.load().chip;
  if ($('chips').__chip !== chipSel) {
    $('chips').__chip = chipSel;
    K.renderChips($('chips'), chipSel, function (c) {
      K.load().chip = c;
      st.bet = Math.min(c, 2500000);
      K.save(); K.play('lay', 0, 0.4); render();
    });
  }
  if (!$('reels').children.length) drawBoard(S.spinStops(g));
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
$('maxbet').addEventListener('click', function () {
  if (spinning) return;
  var want = Math.min(2500000, bank());
  var chips = K.CHIPS.map(function (d) { return d * 100; }).filter(function (c) { return c <= want; });
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
  if (e.code === 'Space' || k === 'enter') { e.preventDefault(); spin(); }
});
document.addEventListener('pointerdown', function () { K.ac(); }, { once: true });
st.bet = K.load().chip || st.bet;
render();
})();
