(function () {
'use strict';
var K = window.Casino, S = window.Slots, G = window.Games;
var g = G.lanterns();
var st = K.game('slots-lanterns', { lines: 25, lineBet: 100, auto: false, last: null });
if (!st.lines) st.lines = 25;
if (!st.lineBet) st.lineBet = 100;
var spinning = false, result = null, timers = [];

function $(id) { return document.getElementById(id); }
function money(c, s) { return K.money(c, s); }
function bank() { return K.bank(); }
function totalBet() { return st.lines * st.lineBet; }
function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
function clearTimers() { timers.forEach(clearTimeout); timers = []; }

/* ---------- symbols ---------- */
function symHTML(sym, cls) {
  var def = g.symbols[sym] || { cn: '?', cls: '' };
  return '<div class="sym ' + def.cls + (cls ? ' ' + cls : '') + '" data-sym="' + sym + '"><i></i><span>' + def.cn + '</span></div>';
}
function reelColumn(reel, stop, rows) {
  var out = '';
  for (var r = 0; r < rows; r++) out += symHTML(reel[(stop + r) % reel.length]);
  return out;
}

/* ---------- board ---------- */
function drawBoard(stops, winCells) {
  var h = '';
  g.reels.forEach(function (reel, i) {
    h += '<div class="reel"><div class="col" data-reel="' + i + '">' + reelColumn(reel, stops[i], g.rows) + '</div></div>';
  });
  K.setHTML($('reels'), h);
  if (winCells) markWins(winCells);
}
function markWins(cells) {
  var all = $('reels').querySelectorAll('.sym');
  all.forEach(function (el) { el.classList.add('dim'); });
  cells.forEach(function (c) {
    var col = $('reels').querySelector('[data-reel="' + c[0] + '"]');
    if (!col) return;
    var el = col.children[c[1]];
    if (el) { el.classList.remove('dim'); el.classList.add('win'); }
  });
}

/* ---------- spin animation ---------- */
function spinReels(stops, done) {
  var cell = parseFloat(getComputedStyle($('machine')).getPropertyValue('--cell')) || 76;
  var lead = 14;
  g.reels.forEach(function (reel, i) {
    var col = $('reels').querySelector('[data-reel="' + i + '"]');
    if (!col) return;
    var start = (stops[i] - lead + reel.length * 4) % reel.length;
    col.innerHTML = reelColumn(reel, start, lead + g.rows);
    col.style.transition = 'none';
    col.style.transform = 'translateY(0)';
    void col.offsetWidth;
    var dur = 620 + i * 190;
    col.style.transition = 'transform ' + dur + 'ms cubic-bezier(.16,.72,.25,1)';
    col.style.transform = 'translateY(' + (-lead * cell) + 'px)';
    later(function () { K.play('shove', 0, 0.35); }, dur - 40);
    later(function () {
      col.style.transition = 'none';
      col.style.transform = 'translateY(0)';
      col.innerHTML = reelColumn(reel, stops[i], g.rows);
      if (i === g.reels.length - 1) done();
    }, dur + 20);
  });
}

/* ---------- a spin ---------- */
function spin() {
  if (spinning) return;
  var bet = totalBet();
  if (bet > bank()) return K.toast('Not enough in your bankroll for that bet');
  if (bet <= 0) return;
  K.ac();
  clearTimers();
  spinning = true;
  result = null;
  K.addBank(-bet);
  K.setHTML($('winline'), '');
  K.setHTML($('events'), '');
  $('spin').disabled = true;
  K.play('lay', 0, 0.5);
  var res = S.play(g, st.lines, st.lineBet);
  st.last = { lines: st.lines, lineBet: st.lineBet };
  K.save();
  render();
  spinReels(res.stops, function () { settle(res); });
}
function settle(res) {
  result = res;
  var cells = [];
  res.wins.forEach(function (w) { w.path.forEach(function (row, i) { cells.push([i, row]); }); });
  if (cells.length) markWins(cells);
  var lineWin = res.lineTotal;
  if (lineWin) {
    K.play('stack', 0, 0.7);
    K.setHTML($('winline'), 'Line wins ' + money(lineWin) + (res.wins.length > 1 ? ' on ' + res.wins.length + ' lines' : ''));
  }
  var queue = [];
  if (res.hold) queue.push(function (next) { runHold(res, next); });
  if (res.free) queue.push(function (next) { runFree(res, next); });
  (function step() {
    if (!queue.length) return finish(res);
    queue.shift()(step);
  })();
}
function finish(res) {
  K.addBank(res.total);
  spinning = false;
  $('spin').disabled = false;
  var net = res.total - res.totalBet;
  K.setHTML($('events'), res.wins.slice(0, 6).map(function (w) {
    return '<span class="ev win">' + K.esc(g.symbols[w.sym].name + ' x' + w.count) + ' ' + money(w.amount) + '</span>';
  }).join('') + (res.hold ? '<span class="ev win">Hold &amp; spin ' + money(res.hold.total) + '</span>' : '')
    + (res.free ? '<span class="ev win">Free games ' + money(res.free.total) + '</span>' : ''));
  if (res.total > 0) {
    K.setHTML($('winline'), 'You win ' + money(res.total));
    if (res.total >= res.totalBet * 10) K.winBanner($('machine'), res.total);
  } else K.setHTML($('winline'), '');
  K.save(); render();
  if (st.auto && bank() >= totalBet()) later(spin, 900);
}

/* ---------- hold & spin ---------- */
function runHold(res, done) {
  var ov = $('overlay'), hs = res.hold, idx = 0;
  ov.hidden = false;
  K.play('shuffle', 0, 0.4);
  function cellHTML(v) {
    if (!v) return '<div class="hold-cell"></div>';
    return '<div class="hold-cell on' + (v.jackpot ? ' jp' : '') + '">' + (v.jackpot ? v.label : money(v.amount)) + '</div>';
  }
  function paint(step) {
    var h = '<h3>Hold &amp; Spin</h3><p>Every coin that lands resets the respins. Fill all fifteen for the Grand.</p>';
    h += '<div class="hold-grid">';
    for (var i = 0; i < 15; i++) h += cellHTML(step.board[i]);
    h += '</div><div class="respins">Respins left: ' + step.respins + '</div>';
    K.setHTML(ov, h);
  }
  paint(hs.steps[0]);
  function nextStep() {
    idx++;
    if (idx >= hs.steps.length) {
      var tail = '<h3>' + (hs.grand ? 'GRAND JACKPOT' : 'Hold &amp; Spin pays ' + money(hs.total)) + '</h3>'
        + (hs.grand ? '<p>All fifteen positions filled. ' + money(hs.total) + '</p>' : '<p>' + hs.filled + ' coins collected</p>');
      K.setHTML(ov, tail);
      K.play('stack', 0, 0.9);
      if (hs.grand) K.winBanner($('machine'), hs.total);
      later(function () { ov.hidden = true; done(); }, hs.grand ? 2600 : 1600);
      return;
    }
    paint(hs.steps[idx]);
    if (hs.steps[idx].landed) K.play('lay', 0, 0.6); else K.play('shove', 0, 0.35);
    later(nextStep, hs.steps[idx].landed ? 780 : 560);
  }
  later(nextStep, 900);
}

/* ---------- free games ---------- */
function runFree(res, done) {
  var ov = $('overlay'), fg = res.free, i = 0;
  ov.hidden = false;
  K.setHTML(ov, '<h3>' + fg.spins + ' Free Games</h3><p>All wins pay ' + fg.multiplier + 'x</p>');
  K.play('shuffle', 0, 0.4);
  later(function () {
    ov.hidden = true;
    (function next() {
      if (i >= fg.rounds.length) {
        ov.hidden = false;
        K.setHTML(ov, '<h3>Free games pay ' + money(fg.total) + '</h3>');
        later(function () { ov.hidden = true; done(); }, 1700);
        return;
      }
      var round = fg.rounds[i++];
      K.setHTML($('winline'), 'Free game ' + i + ' of ' + fg.spins);
      spinReels(round.stops, function () {
        var cells = [];
        round.wins.forEach(function (w) { w.path.forEach(function (row, x) { cells.push([x, row]); }); });
        if (cells.length) { markWins(cells); K.play('stack', 0, 0.6); }
        K.setHTML($('winline'), 'Free game ' + i + ' of ' + fg.spins + (round.amount ? ' · ' + money(round.amount) : ''));
        later(next, round.amount ? 900 : 500);
      });
    })();
  }, 1600);
}

/* ---------- chrome ---------- */
function jackpotHTML() {
  var j = g.hold.jackpots, bet = totalBet();
  return [['grand', 'Grand', j.grand], ['major', 'Major', j.major], ['minor', 'Minor', j.minor], ['mini', 'Mini', j.mini]]
    .map(function (x) { return '<div class="jp ' + x[0] + '"><b>' + x[1] + '</b><span>' + money(x[2] * bet) + '</span></div>'; }).join('');
}
function payHTML() {
  var rows = '';
  ['DRAGON', 'PHOENIX', 'KOI', 'LANTERN', 'A', 'K', 'Q', 'J', 'T', 'WILD'].forEach(function (s) {
    var p = g.pays[s];
    rows += '<tr><td>' + g.symbols[s].cn + '</td><td>' + g.symbols[s].name + '</td>'
      + '<td class="num">' + p[3] + '</td><td class="num">' + p[4] + '</td><td class="num">' + p[5] + '</td></tr>';
  });
  return '<table><tr><td></td><td></td><td class="num">3</td><td class="num">4</td><td class="num">5</td></tr>' + rows + '</table>'
    + '<p class="note">Pays are multiples of the bet per line, left to right on a played line. Pearl is wild and stands in for everything except coins and temples.</p>'
    + '<p class="note"><b>Gold coins:</b> six or more anywhere lock in place and start Hold &amp; Spin with three respins. Every new coin resets the respins. Fill all fifteen for the Grand.</p>'
    + '<p class="note"><b>Temples:</b> three, four or five pay ' + g.scatterPays[3] + 'x, ' + g.scatterPays[4] + 'x and ' + g.scatterPays[5] + 'x the total bet and start '
    + g.free.spins[3] + ', ' + g.free.spins[4] + ' or ' + g.free.spins[5] + ' free games at ' + g.free.multiplier + 'x.</p>';
}
function render() {
  K.setHTML($('jackpots'), jackpotHTML());
  K.setHTML($('lines'), g.lineOptions.map(function (n) {
    return '<button data-lines="' + n + '" aria-selected="' + (st.lines === n) + '">' + n + ' lines</button>';
  }).join(''));
  var bk = $('bank'), prev = +bk.dataset.v;
  bk.textContent = money(bank());
  if (!isNaN(prev) && bk.dataset.v !== undefined && bank() !== prev) {
    var cls = bank() > prev ? 'bump' : 'dip';
    bk.classList.remove('bump', 'dip'); void bk.offsetWidth; bk.classList.add(cls);
  }
  bk.dataset.v = bank();
  K.setText($('totalbet'), money(totalBet()));
  K.setText($('subline'), 'Five reels · ' + st.lines + ' lines at ' + money(st.lineBet) + ' · hold & spin on six coins');
  K.setText($('headline'), spinning ? 'Good luck' : 'Pick your lines and spin');
  var s = K.load();
  K.setText($('sound'), !s.sound ? 'Audio: Off' : s.voice ? 'Audio: All' : 'Audio: FX');
  K.setText($('auto'), st.auto ? 'Auto: On' : 'Auto: Off');
  $('spin').disabled = spinning;
  var chipSel = K.load().chip;
  if ($('chips').__chip !== chipSel) {
    $('chips').__chip = chipSel;
    K.renderChips($('chips'), chipSel, function (c) {
      K.load().chip = c; st.lineBet = c;
      if (totalBet() > 2500000) { st.lineBet = Math.floor(2500000 / st.lines); K.toast('Table max is ' + money(2500000)); }
      K.save(); K.play('lay', 0, 0.4); render();
    });
  }
  if (!$('reels').children.length) drawBoard(S.spinStops(g));
}

/* ---------- reset dialog ---------- */
var MAX_BANK = 10000000;
function parseDollars(v) { var n = parseFloat(String(v).replace(/[$,\s]/g, '')); return isFinite(n) ? Math.round(n * 100) : NaN; }
function openReset() {
  if (spinning) return K.toast('Wait for the spin to finish');
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

/* ---------- wiring ---------- */
$('nav').innerHTML = K.nav('lanterns');
$('lines').addEventListener('click', function (e) {
  var b = e.target.closest('[data-lines]'); if (!b || spinning) return;
  st.lines = +b.dataset.lines;
  if (totalBet() > 2500000) { st.lineBet = Math.floor(2500000 / st.lines); K.toast('Table max is ' + money(2500000)); }
  K.save(); K.play('lay', 0, 0.4); render();
});
$('spin').addEventListener('click', spin);
$('maxbet').addEventListener('click', function () {
  if (spinning) return;
  st.lines = g.lineOptions[g.lineOptions.length - 1];
  var want = Math.min(2500000, bank());
  var per = Math.floor(want / st.lines);
  var chips = K.CHIPS.map(function (d) { return d * 100; }).filter(function (c) { return c <= per; });
  st.lineBet = chips.length ? chips[chips.length - 1] : 100;
  K.load().chip = st.lineBet;
  K.save(); K.play('stack', 0, 0.7); render();
});
$('auto').addEventListener('click', function () {
  st.auto = !st.auto; K.save(); render();
  if (st.auto && !spinning) spin();
});
$('sound').addEventListener('click', function () {
  var s = K.load();
  if (s.sound && s.voice) s.voice = false;
  else if (s.sound) { s.sound = false; if (window.speechSynthesis) speechSynthesis.cancel(); }
  else { s.sound = true; s.voice = true; }
  K.save(); render();
});
$('paytableBtn').addEventListener('click', function () {
  K.setHTML($('payBody'), payHTML());
  K.setText($('payNote'), 'Return to player about 94%. ' + st.lines + ' lines at ' + money(st.lineBet) + ' is ' + money(totalBet()) + ' a spin.');
  var d = $('payDlg'); if (d.showModal) d.showModal(); else d.setAttribute('open', '');
});
$('payClose').addEventListener('click', function () { var d = $('payDlg'); if (d.close) d.close(); else d.removeAttribute('open'); });
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
  if ($('resetDlg').open || $('payDlg').open || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  var k = e.key.toLowerCase();
  if (k === 'b') { e.preventDefault(); return openReset(); }
  if (e.code === 'Space' || k === 'enter') { e.preventDefault(); spin(); }
});
document.addEventListener('pointerdown', function () { K.ac(); }, { once: true });
st.lineBet = K.load().chip || st.lineBet;
render();
})();
