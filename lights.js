(function () {
'use strict';
var K = window.Casino, S = window.Slots, G = window.Games, FX = window.SlotFX;
var g = G.lights();
var st = K.game('slots-lights', { lines: 25, lineBet: 100, auto: false, jp: null });
if (!st.lines) st.lines = 25;
if (!st.lineBet) st.lineBet = 100;
/* the four meters, held as multiples of the total bet */
if (!st.jp) st.jp = { grand: g.jackpots.seed.grand, major: g.jackpots.seed.major,
  minor: g.jackpots.seed.minor, mini: g.jackpots.seed.mini };
var spinning = false, timers = [], lastRows = null, freeBadge = '';

function $(id) { return document.getElementById(id); }
function money(c, s) { return K.money(c, s); }
function bank() { return K.bank(); }
function totalBet() { return st.lines * st.lineBet; }
function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
function clearTimers() { timers.forEach(clearTimeout); timers = []; }
function fx(name) { var a = arguments; return FX && FX[name] ? FX[name].apply(null, [].slice.call(a, 1)) : null; }

/* ---------- symbols ---------- */
function art(def) {
  return def.svg ? '<svg viewBox="0 0 48 48" aria-hidden="true">' + def.svg + '</svg>' : '<span>' + def.ch + '</span>';
}
function symHTML(sym, cls) {
  var def = g.symbols[sym] || { ch: '?', cls: '' };
  return '<div class="sym ' + def.cls + (cls ? ' ' + cls : '') + '" data-sym="' + sym + '"><i></i>' + art(def) + '</div>';
}
function reelColumn(reel, stop, rows, boost) {
  var out = '';
  for (var r = 0; r < rows; r++) {
    var sym = reel[(stop + r) % reel.length];
    if (boost && sym === g.free.token) sym = boost;
    out += symHTML(sym);
  }
  return out;
}

/* ---------- board ---------- */
function drawBoard(stops, reels, boost) {
  var set = reels || g.reels, h = '';
  set.forEach(function (reel, i) {
    h += '<div class="reel" data-col="' + i + '"><div class="col" data-reel="' + i + '">'
      + reelColumn(reel, stops[i], g.rows, boost) + '</div></div>';
  });
  K.setHTML($('reels'), h);
}
function markWins(cells) {
  var all = $('reels').querySelectorAll('.sym');
  all.forEach(function (el) { el.classList.add('dim'); el.classList.remove('win'); });
  cells.forEach(function (c) {
    var col = $('reels').querySelector('[data-reel="' + c[0] + '"]');
    if (!col) return;
    var el = col.children[c[1]];
    if (el) { el.classList.remove('dim'); el.classList.add('win'); }
  });
}
function clearMarks() {
  $('reels').querySelectorAll('.sym').forEach(function (el) { el.classList.remove('dim', 'win'); });
}
function cellsOf(wins) {
  var cells = [];
  wins.forEach(function (w) { w.path.forEach(function (row, i) { cells.push([i, row]); }); });
  return cells;
}

/* ---------- spin animation ---------- */
function spinReels(stops, opts, done) {
  opts = opts || {};
  var reels = opts.reels || g.reels, boost = opts.boost;
  var cell = parseFloat(getComputedStyle($('machine')).getPropertyValue('--cell')) || 76;
  var lead = 14, last = reels.length - 1;
  $('reels').querySelectorAll('.reel').forEach(function (el) {
    el.classList.remove('wildreel');
    var s = el.querySelector('.scrolldrop'); if (s) s.remove();
  });
  reels.forEach(function (reel, i) {
    var col = $('reels').querySelector('[data-reel="' + i + '"]');
    if (!col) return;
    var start = (stops[i] - lead + reel.length * 4) % reel.length;
    col.innerHTML = reelColumn(reel, start, lead + g.rows, boost);
    col.style.transition = 'none';
    col.style.transform = 'translateY(0)';
    void col.offsetWidth;
    var dur = 620 + i * 190 + (i === last && opts.tease ? 900 : 0);
    col.style.transition = 'transform ' + dur + 'ms cubic-bezier(.16,.72,.25,1)';
    col.style.transform = 'translateY(' + (-lead * cell) + 'px)';
    for (var t = 0; t < 7; t++) later(function () { fx('tick'); }, 80 + t * (dur / 8));
    if (i === last && opts.tease) later(function () { fx('anticipate', 0.85); }, 620 + (last - 1) * 190);
    later(function () {
      col.style.transition = 'none';
      col.style.transform = 'translateY(0)';
      col.innerHTML = reelColumn(reel, stops[i], g.rows, boost);
      if (i === last && opts.tease) fx('stopAnticipate');
      fx('reelStop', i);
      if (i === last) done();
    }, dur + 20);
  });
}
/* is the last reel worth a drum roll? two feature symbols already showing */
function teaseWorthy(stops) {
  var grid = S.gridAt(g, stops);
  var candles = 0, pans = 0, shofars = 0;
  for (var i = 0; i < grid.length - 1; i++) {
    grid[i].forEach(function (s) {
      if (s === g.coin) candles++;
      if (s === g.bonus) pans++;
      if (s === g.scatter) shofars++;
    });
  }
  return candles >= 4 || pans >= 2 || shofars >= 2;
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
  K.addBank(-bet);
  K.setHTML($('winline'), '');
  K.setHTML($('events'), '');
  freeBadge = '';
  $('spin').disabled = true;
  /* every spin feeds the meters */
  g.jackpots.order.forEach(function (t) { st.jp[t] += g.jackpots.rate[t]; });
  var res = S.play(g, st.lines, st.lineBet, st.jp);
  K.save();
  render();
  paintPanel(null);
  spinReels(res.stops, { tease: teaseWorthy(res.stops) }, function () { settle(res); });
}
function settle(res) {
  var cells = cellsOf(res.wins);
  if (cells.length) markWins(cells);
  if (res.lineTotal) {
    fx('coinRun', res.lineTotal / res.totalBet);
    K.setHTML($('winline'), 'Line wins ' + money(res.lineTotal) + (res.wins.length > 1 ? ' on ' + res.wins.length + ' lines' : ''));
  }
  paintPanel(res);
  var queue = [];
  if (res.hold) queue.push(function (next) { runHold(res.hold, next, 'Light the Menorah'); });
  if (res.latke) queue.push(function (next) { runLatke(res, next); });
  if (res.free) queue.push(function (next) { runFree(res, next); });
  (function step() {
    if (!queue.length) return finish(res);
    queue.shift()(step);
  })();
}
function finish(res) {
  K.addBank(res.total);
  /* a jackpot that was paid drops its meter back to the seed */
  res.jackpots.forEach(function (j) { st.jp[j.tier] = g.jackpots.seed[j.tier]; });
  spinning = false;
  freeBadge = '';
  $('spin').disabled = false;
  K.setHTML($('events'), res.wins.slice(0, 4).map(function (w) {
    return '<span class="ev win">' + K.esc(g.symbols[w.sym].name + ' x' + w.count) + ' ' + money(w.amount) + '</span>';
  }).join('') + (res.hold ? '<span class="ev win">Hold &amp; spin ' + money(res.hold.total) + '</span>' : '')
    + (res.latke ? '<span class="ev win">Latke bonus ' + money(res.latke.total) + '</span>' : '')
    + (res.free ? '<span class="ev win">Free games ' + money(res.free.total) + '</span>' : '')
    + res.jackpots.map(function (j) {
      return '<span class="ev win">' + j.tier.toUpperCase() + ' jackpot ' + money(j.amount) + '</span>';
    }).join(''));
  if (res.total > 0) {
    K.setHTML($('winline'), 'You win ' + money(res.total));
    if (res.total >= res.totalBet * 10) K.winBanner($('machine'), res.total);
  } else K.setHTML($('winline'), '');
  paintPanel(res);
  K.save(); render();
  if (st.auto && bank() >= totalBet()) later(spin, 900);
}

/* ---------- the win breakdown ---------- */
function rowIcon(sym) {
  var def = g.symbols[sym];
  if (!def) return '';
  return def.svg ? '<svg viewBox="0 0 48 48">' + def.svg + '</svg>' : '<span class="glyph">' + def.ch + '</span>';
}
function paintPanel(res) {
  var host = $('winpanel');
  if (!res) {
    lastRows = null;
    K.setHTML(host, '<h4>This spin</h4><div class="wp-rows"><div class="wp-empty">Spin to see every line that pays.</div></div>');
    return;
  }
  var rows = [];
  res.wins.forEach(function (w) {
    rows.push({ icon: rowIcon(w.sym), label: 'Line ' + (w.line + 1) + ' pays', amount: w.amount,
      note: g.symbols[w.sym].name + ' x' + w.count, path: w.path });
  });
  rows.sort(function (a, b) { return b.amount - a.amount; });
  if (res.scatterPay) rows.push({ icon: rowIcon(g.scatter), label: res.scatterCount + ' shofars pay', amount: res.scatterPay, feat: true });
  if (res.hold) rows.push({ icon: rowIcon(g.coin), label: 'Hold &amp; spin', amount: res.hold.total, feat: true });
  if (res.latke) rows.push({ icon: rowIcon(g.bonus), label: 'Latke bonus', amount: res.latke.total, feat: true });
  if (res.free) rows.push({ icon: rowIcon(g.scatter), label: 'Free games', amount: res.free.total, feat: true });
  var h = '<h4>This spin</h4><div class="wp-rows">';
  if (!rows.length) h += '<div class="wp-empty">No win this spin.</div>';
  rows.forEach(function (r, i) {
    h += '<div class="wp-row' + (r.feat ? ' feat' : '') + '" data-row="' + i + '">' + r.icon
      + '<span class="ln">' + r.label + (r.note ? ' <small>' + K.esc(r.note) + '</small>' : '') + '</span>'
      + '<span class="amt">' + money(r.amount) + '</span></div>';
  });
  h += '</div><div class="wp-total"><span>Total</span><b>' + money(res.total) + '</b></div>';
  K.setHTML(host, h);
  lastRows = rows;
}
$('winpanel').addEventListener('mouseover', function (e) {
  var row = e.target.closest('[data-row]');
  if (!row || !lastRows || spinning) return;
  var r = lastRows[+row.dataset.row];
  $('winpanel').querySelectorAll('.wp-row').forEach(function (el) { el.classList.remove('hot'); });
  row.classList.add('hot');
  if (r && r.path) markWins(r.path.map(function (rw, i) { return [i, rw]; }));
});
$('winpanel').addEventListener('mouseleave', function () {
  if (spinning || !lastRows) return;
  $('winpanel').querySelectorAll('.wp-row').forEach(function (el) { el.classList.remove('hot'); });
  clearMarks();
});

/* ---------- effects ---------- */
function flash() {
  var m = $('machine'), f = document.createElement('div');
  f.className = 'flash';
  m.appendChild(f);
  setTimeout(function () { f.remove(); }, 320);
}
function shake() {
  var m = $('machine');
  m.classList.remove('shake'); void m.offsetWidth; m.classList.add('shake');
  setTimeout(function () { m.classList.remove('shake'); }, 600);
}

/* ---------- hold and spin: one respin per press ---------- */
var FLAME = '<svg viewBox="0 0 48 48" aria-hidden="true">'
  + '<path d="M24 1.6c5.6 6.8 7.6 10.4 7.6 13.6a7.6 7.6 0 0 1-15.2 0c0-3.2 2-6.8 7.6-13.6z" fill="#ff9d2e"/>'
  + '<path d="M24 8.6c2.8 3.6 3.8 5.6 3.8 7.2a3.8 3.8 0 0 1-7.6 0c0-1.6 1-3.6 3.8-7.2z" fill="#fff0ae"/>'
  + '<rect x="19" y="19" width="10" height="24" rx="2.6" fill="#fdf4e0"/>'
  + '<rect x="19" y="19" width="3.4" height="24" rx="1.6" fill="#e6d7bb"/></svg>';
function runHold(hs, done, title) {
  var ov = $('overlay'), idx = 0, busy = false;
  ov.hidden = false;
  fx('arkOpen');
  K.setHTML(ov,
    '<h3>' + K.esc(title || 'Light the Menorah') + '</h3>'
    + '<div class="hold-head"><div class="pips" id="pips"></div><div class="meter" id="meter">' + money(0) + '</div></div>'
    + '<div class="hold-grid" id="hgrid"></div>'
    + '<div class="respins" id="respins"></div>'
    + '<button class="holdspin" id="holdspin">Spin</button>');
  var grid = $('hgrid'), meter = $('meter'), btn = $('holdspin');

  function cellHTML(v, fresh) {
    if (!v) return '<div class="hold-cell"></div>';
    return '<div class="hold-cell on' + (v.jackpot ? ' jp' : '') + (fresh ? ' fresh' : '') + '">'
      + FLAME + '<b>' + (v.jackpot ? v.label : money(v.amount)) + '</b></div>';
  }
  function paintPips(n) {
    K.setHTML($('pips'), [0, 1, 2].map(function (i) { return '<i class="' + (i < n ? 'on' : '') + '"></i>'; }).join(''));
  }
  function paintMeter(step, pop) {
    var sum = step.board.reduce(function (a, v) { return a + (v ? v.amount : 0); }, 0);
    meter.textContent = money(sum);
    if (pop) { meter.classList.remove('pop'); void meter.offsetWidth; meter.classList.add('pop'); }
  }
  function paintGrid(step, freshIdx) {
    var h = '';
    for (var i = 0; i < 15; i++) h += cellHTML(step.board[i], freshIdx && freshIdx.indexOf(i) >= 0);
    K.setHTML(grid, h);
  }
  function label(step) {
    K.setText($('respins'), step.respins === 1 ? 'Last respin' : step.respins + ' respins left');
    paintPips(step.respins);
  }
  paintGrid(hs.steps[0]); paintMeter(hs.steps[0]); label(hs.steps[0]);

  function reveal(step, prev, after) {
    var fresh = [], i;
    for (i = 0; i < 15; i++) if (step.board[i] && !prev[i]) fresh.push(i);
    var mix = prev.slice(), n = 0;
    function next() {
      if (n >= fresh.length) return after(fresh.length);
      var at = fresh[n++];
      mix[at] = step.board[at];
      paintGrid({ board: mix }, [at]);
      paintMeter({ board: mix }, true);
      if (step.board[at].jackpot) { fx('jackpot', step.board[at].jackpot); flash(); shake(); }
      else fx('candle', n);
      later(next, step.board[at].jackpot ? 900 : 260);
    }
    if (!fresh.length) return after(0);
    next();
  }
  function press() {
    if (busy || idx >= hs.steps.length - 1) return;
    busy = true; btn.disabled = true;
    idx++;
    var step = hs.steps[idx], prev = hs.steps[idx - 1].board;
    K.setText($('respins'), 'Spinning');
    grid.classList.add('frame-lit');
    fx('tick');
    later(function () {
      grid.classList.remove('frame-lit');
      reveal(step, prev, function (landed) {
        label(step);
        if (landed) { K.setText($('respins'), 'Respins reset to 3'); later(function () { label(step); }, 700); }
        busy = false;
        if (idx >= hs.steps.length - 1) return endHold();
        btn.disabled = false;
        if (st.auto) later(press, 500);
      });
    }, 520);
  }
  function endHold() {
    btn.disabled = true;
    var filled = hs.filled === 15;
    K.setHTML(ov, '<h3>' + (filled ? 'Grand Jackpot' : 'Hold &amp; Spin pays ' + money(hs.total)) + '</h3>'
      + '<div class="meter">' + money(hs.total) + '</div>'
      + '<p>' + (filled ? 'All fifteen lit.' : hs.filled + ' of 15 candles lit') + '</p>');
    fx(filled ? 'jackpot' : 'coinRun', filled ? 'grand' : hs.total / totalBet());
    if (filled) { flash(); shake(); K.winBanner($('machine'), hs.total); }
    later(function () { ov.hidden = true; done(); }, filled ? 2800 : 1500);
  }
  btn.addEventListener('click', press);
  if (st.auto) later(press, 800);
}

/* ---------- the latke round ---------- */
var LATKE_ART = '<svg class="latke-art" viewBox="0 0 48 48">' + G.ART.latke + '</svg>';
function runLatke(res, done) {
  var ov = $('overlay'), lr = res.latke, idx = 0, running = 0, busy = false;
  ov.hidden = false;
  fx('whoosh');
  K.setHTML(ov, '<h3>Latke Bonus</h3><p>Pick a pan. Every latke pays, an empty pan ends it.</p>'
    + '<div class="latke-meter"><div class="meter" id="lkmeter">' + money(0) + '</div></div>'
    + '<div class="latke-stage" id="lkstage"></div>');
  var stage = $('lkstage'), meter = $('lkmeter'), idleTimer = null;

  /* Five pans stay on the table and fill up as you pick. A fresh batch only
     flies in once they have all been used, so the stage is never empty. */
  var SPOTS = [[6, 8], [40, 4], [72, 12], [20, 50], [56, 52]];
  function deal(first) {
    var h = '';
    SPOTS.forEach(function (sp, i) {
      h += '<div class="panwrap" data-pan="' + i + '" style="left:' + sp[0] + '%;top:' + sp[1] + '%;width:23%;height:38%;'
        + 'animation:panin .45s ease-out ' + (i * 0.06).toFixed(2) + 's both">'
        + '<svg viewBox="0 0 48 48">' + G.ART.pan + '</svg>'
        + '<div class="latke">' + LATKE_ART + '</div><div class="tag"></div></div>';
    });
    K.setHTML(stage, h);
    later(function () {
      stage.querySelectorAll('.panwrap').forEach(function (el) { el.classList.add('float'); });
    }, 560);
    if (!first) fx('whoosh');
    armIdle();
  }
  function armIdle() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      var pan = stage.querySelector('.panwrap:not(.picked)');
      if (pan && !busy) pan.click();
    }, 20000);
    timers.push(idleTimer);
  }
  function bump() {
    meter.textContent = money(running);
    meter.classList.remove('pop'); void meter.offsetWidth; meter.classList.add('pop');
  }
  stage.addEventListener('click', function (e) {
    var pan = e.target.closest('[data-pan]');
    if (!pan || busy || pan.classList.contains('picked') || idx >= lr.picks.length) return;
    busy = true;
    if (idleTimer) clearTimeout(idleTimer);
    var pick = lr.picks[idx++];
    pan.classList.remove('float');
    pan.classList.add('picked', 'done');
    var tag = pan.querySelector('.tag');
    if (pick.empty) {
      pan.classList.add('empty');
      tag.textContent = 'EMPTY';
      fx('thud');
      return later(endLatke, 1400);
    }
    fx('sizzle');
    running += pick.amount;
    bump();
    if (pick.jackpot) {
      tag.textContent = pick.label;
      fx('jackpot', pick.jackpot);
      flash(); shake();
      return later(endLatke, 2200);
    }
    tag.textContent = money(pick.amount);
    later(function () {
      busy = false;
      if (idx >= lr.picks.length) return endLatke();
      /* only bring in a new batch once every pan has been used */
      if (!stage.querySelector('.panwrap:not(.picked)')) deal(false);
      else armIdle();
    }, 850);
  });
  function endLatke() {
    if (idleTimer) clearTimeout(idleTimer);
    K.setHTML(ov, '<h3>Latke bonus pays ' + money(lr.total) + '</h3><div class="meter">' + money(lr.total) + '</div>');
    fx('coinRun', lr.total / totalBet());
    later(function () { ov.hidden = true; done(); }, 1700);
  }
  later(function () { deal(true); }, 600);
}

/* ---------- free games ---------- */
function runFree(res, done) {
  var ov = $('overlay'), fg = res.free, i = 0;
  ov.hidden = false;
  var def = g.symbols[fg.boost];
  K.setHTML(ov, '<h3>Free Games</h3>'
    + '<div class="ark" id="ark"><svg viewBox="0 0 48 48">' + G.ART.ark + '</svg>'
    + '<div class="glow"></div><div class="door l"></div><div class="door r"></div>'
    + '<div class="pick">' + symHTML(fg.boost) + '</div></div>'
    + '<p id="arkline">The ark is opening</p>');
  fx('arkOpen');
  later(function () { $('ark').classList.add('open'); fx('scroll'); }, 500);
  later(function () {
    $('ark').classList.add('reveal');
    fx('reveal');
    K.setText($('arkline'), def.name + ' is boosted for ' + fg.spins + ' free games');
  }, 1500);
  later(function () {
    ov.hidden = true;
    freeBadge = '<span class="fgbadge">' + symHTML(fg.boost) + ' boosted</span> ';
    drawBoard(fg.rounds.length ? fg.rounds[0].stops : S.spinStops(g, g.freeReels), g.freeReels, fg.boost);
    play();
  }, 3000);

  function play() {
    if (i >= fg.rounds.length) return endFree();
    var round = fg.rounds[i++];
    K.setHTML($('winline'), freeBadge + 'Free game ' + i + ' of ' + round.of);
    spinReels(round.stops, { reels: g.freeReels, boost: fg.boost }, function () {
      round.wildReels.forEach(function (x) {
        var reel = $('reels').querySelector('[data-col="' + x + '"]');
        if (!reel) return;
        reel.classList.add('wildreel');
        var drop = document.createElement('div');
        drop.className = 'scrolldrop';
        drop.innerHTML = '<b>Wild</b>';
        reel.appendChild(drop);
        fx('scroll');
      });
      var cells = cellsOf(round.wins);
      if (cells.length) { markWins(cells); fx('coinRun', round.amount / totalBet()); }
      K.setHTML($('winline'), freeBadge + 'Free game ' + i + ' of ' + fg.spins
        + (round.amount ? ' · ' + money(round.amount) : ''));
      if (round.retrigger) K.toast('Three shofars: ' + g.free.retrigger + ' more free games, ' + round.of + ' in total');
      if (round.hold) {
        later(function () { runHold(round.hold, function () { later(play, 400); }, 'Hold &amp; Spin'); }, 500);
      } else later(play, round.amount ? 900 : 520);
    });
  }
  function endFree() {
    ov.hidden = false;
    K.setHTML(ov, '<h3>Free games pay ' + money(fg.total) + '</h3><div class="meter">' + money(fg.total) + '</div>'
      + (fg.topUp ? '<p>Topped up to the minimum ' + money(fg.floor) + '</p>' : ''));
    fx('coinRun', fg.total / totalBet());
    later(function () {
      ov.hidden = true;
      freeBadge = '';
      drawBoard(res.stops);
      var cells = cellsOf(res.wins);
      if (cells.length) markWins(cells);
      done();
    }, 1800);
  }
}

/* ---------- chrome ---------- */
function jackpotHTML() {
  var bet = totalBet();
  return [['grand', 'Grand'], ['major', 'Major'], ['minor', 'Minor'], ['mini', 'Mini']]
    .map(function (x) {
      return '<div class="jp ' + x[0] + '"><b>' + x[1] + '</b><span data-jp="' + x[0] + '">'
        + money(Math.round(st.jp[x[0]] * bet)) + '</span></div>';
    }).join('');
}
function payHTML() {
  var rows = '';
  g.order.forEach(function (s) {
    var p = g.pays[s], def = g.symbols[s];
    var icon = def.svg
      ? '<td class="ic ' + def.cls + '" style="color:' + iconColor(s) + '"><svg viewBox="0 0 48 48">' + def.svg + '</svg></td>'
      : '<td class="glyph" style="color:' + iconColor(s) + '">' + def.ch + '</td>';
    rows += '<tr>' + icon + '<td>' + def.name + '</td>'
      + '<td class="num">' + p[3] + '</td><td class="num">' + p[4] + '</td><td class="num">' + p[5] + '</td></tr>';
  });
  return '<table><tr><td></td><td></td><td class="num">3</td><td class="num">4</td><td class="num">5</td></tr>' + rows + '</table>'
    + '<p class="note">Pays are multiples of the bet per line, left to right on a played line. The star is wild and stands in for everything except candles, shofars and pans.</p>'
    + '<p class="note"><b>Candles:</b> six or more anywhere lock in place and start Light the Menorah with three respins. Press spin yourself for each respin — every new candle resets the count. Light all fifteen for the Grand.</p>'
    + '<p class="note"><b>Shofars:</b> three, four or five pay ' + g.scatterPays[3] + 'x, ' + g.scatterPays[4] + 'x and ' + g.scatterPays[5] + 'x the total bet and start '
    + g.free.spins[3] + ', ' + g.free.spins[4] + ' or ' + g.free.spins[5] + ' free games. The ark opens and a scroll picks one symbol to boost for the round: it lands in stacks, and a full stack turns that reel wild. Candles come thicker in free games and only '
    + g.free.holdTrigger + ' are needed for Hold &amp; Spin, so the feature can fire inside the round. Three more shofars add ' + g.free.retrigger + ' spins. <b>A free games round never pays nothing</b> — it pays at least the shofar award that started it.</p>'
    + '<p class="note"><b>Pans:</b> three or more start the Latke Bonus. Pick a flying pan, every latke pays and a pan can hold a jackpot. An empty pan ends the round.</p>'
    + '<p class="note"><b>Jackpots:</b> the four meters grow with every spin and reset to their seed when won. They are held as multiples of your bet, so the odds are the same whatever you bet and the figures shown rise with your bet.</p>';
}
function iconColor(s) {
  return ({ MENORAH: '#ffd970', DREIDEL: '#bcd9ff', POMEGRANATE: '#ff8a8a', CHALLAH: '#f0c07a', WILD: '#8fc4ff',
    ALEF: '#ffd970', SHIN: '#dbe6f5', HEY: '#a9c6f0', GIMEL: '#8fd8c4', NUN: '#c3b4ff' })[s] || '#dbe6f5';
}
function render() {
  K.setHTML($('jackpots'), jackpotHTML());
  K.setHTML($('lines'), g.lineOptions.map(function (n) {
    return '<button data-lines="' + n + '" aria-selected="' + (st.lines === n) + '">' + n + ' lines</button>';
  }).join(''));
  if (!$('bulbs').children.length) {
    K.setHTML($('bulbs'), new Array(14).join('.').split('.').map(function (x, i) {
      return '<i style="animation-delay:' + (i * 0.12).toFixed(2) + 's"></i>';
    }).join(''));
  }
  var bk = $('bank'), prev = +bk.dataset.v;
  bk.textContent = money(bank());
  if (!isNaN(prev) && bk.dataset.v !== undefined && bank() !== prev) {
    var cls = bank() > prev ? 'bump' : 'dip';
    bk.classList.remove('bump', 'dip'); void bk.offsetWidth; bk.classList.add(cls);
  }
  bk.dataset.v = bank();
  K.setText($('totalbet'), money(totalBet()));
  K.setText($('subline'), 'Five reels · ' + st.lines + ' lines at ' + money(st.lineBet)
    + ' · candles, shofars and pans all start something');
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
  if (!$('reels').children.length) { drawBoard(S.spinStops(g)); paintPanel(null); }
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
$('nav').innerHTML = K.nav('lights');
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
  if (e.code === 'Space' || k === 'enter') {
    e.preventDefault();
    var btn = document.getElementById('holdspin');
    if (btn && !$('overlay').hidden && !btn.disabled) return btn.click();
    spin();
  }
});
document.addEventListener('pointerdown', function () { K.ac(); }, { once: true });
st.lineBet = K.load().chip || st.lineBet;
render();
})();
