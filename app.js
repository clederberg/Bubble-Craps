(function () {
'use strict';
var C = window.Craps, LY = window.CrapsLayout;
var START = 100000, KEY = 'bubblecraps.v1';
var CHIPS = [1, 5, 25, 100, 500, 1000];
var SVGNS = 'http://www.w3.org/2000/svg';

function fresh(mode, chip, sound) {
  return { bank: START, mode: mode || 'craps', chip: chip || 500, sound: sound !== false,
    tables: { craps: C.newTable('craps'), crapless: C.newTable('crapless') }, last: {}, dice: {},
    stats: { n: 0, totals: [0,0,0,0,0,0,0,0,0,0,0,0,0], faces: [0,0,0,0,0,0,0] } };
}
var S = load() || fresh();
if (!S.dice) S.dice = {};
if (S.sound === undefined) S.sound = true;
if (!S.stats) S.stats = { n: 0, totals: [0,0,0,0,0,0,0,0,0,0,0,0,0], faces: [0,0,0,0,0,0,0] };
var removeMode = false, rolling = false, L = null, hidden = {}, fresher = {};

function load() { try { var s = JSON.parse(localStorage.getItem(KEY)); return s && s.tables ? s : null; } catch (e) { return null; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function T() { return S.tables[S.mode]; }
function $(id) { return document.getElementById(id); }
function money(c, sign) {
  var neg = c < 0, v = Math.abs(c) / 100;
  var s = '$' + v.toLocaleString('en-US', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return (neg ? '-' : (sign && c > 0 ? '+' : '')) + s;
}
function chipText(c) { var d = c / 100; if (d >= 1000) return (Math.round(d / 100) / 10) + 'k'; return d % 1 ? d.toFixed(2).replace(/0$/, '') : String(d); }
function chipColor(c) {
  if (c >= 100000) return ['#d1a12f', '#221a03'];
  if (c >= 50000) return ['#6b3fa0', '#fff'];
  if (c >= 10000) return ['#1d1d1f', '#fff'];
  if (c >= 2500) return ['#2f8a4f', '#fff'];
  if (c >= 500) return ['#c9392f', '#fff'];
  return ['#ece6d6', '#222'];
}
function esc(s) { return String(s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
var toastTimer;
function toast(msg) { var el = $('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1900); }
// Unbiased 1-6 from the browser's cryptographic RNG (rejection sampling avoids modulo bias)
var RNG_LIMIT = 4294967292; // largest multiple of 6 below 2^32
function rnd() {
  var a = new Uint32Array(1);
  do { crypto.getRandomValues(a); } while (a[0] >= RNG_LIMIT);
  return 1 + (a[0] % 6);
}
function rand(a, b) { return a + Math.random() * (b - a); }

/* ---------------- sound ---------------- */
var actx = null;
function ac() {
  if (!S.sound) return null;
  try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); return actx; } catch (e) { return null; }
}
function clack(delay, vol) {
  var a = ac(); if (!a) return;
  var t = a.currentTime + (delay || 0), len = 0.05;
  var buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate), d = buf.getChannelData(0);
  for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  var src = a.createBufferSource(); src.buffer = buf;
  var f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = rand(1800, 3200); f.Q.value = 1.4;
  var g = a.createGain(); g.gain.value = vol || 0.5;
  src.connect(f); f.connect(g); g.connect(a.destination); src.start(t);
}
function chipClick() {
  var a = ac(); if (!a) return;
  [0, 0.035].forEach(function (dt, i) {
    var o = a.createOscillator(), g = a.createGain(), t = a.currentTime + dt;
    o.type = 'triangle'; o.frequency.value = i ? 2900 : 2300;
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 0.06);
  });
}
function winChime() {
  var a = ac(); if (!a) return;
  [660, 880, 1320].forEach(function (fr, i) {
    var o = a.createOscillator(), g = a.createGain(), t = a.currentTime + i * 0.07;
    o.type = 'sine'; o.frequency.value = fr;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 0.4);
  });
}

/* ---------------- table rendering ---------------- */
function isWide() { return $('tw').clientWidth >= 720; }
function scale() { return $('tw').clientWidth / L.W; }
function isOff(t, k) {
  var p = C.parse(k);
  return t.point === null && (p.type === 'place' || p.type === 'buy' || p.type === 'hard' || p.type === 'comeOdds');
}
function chipSVG(k, x, y, amount, R, off) {
  var col = chipColor(amount), h = '', stack = Math.min(3, Math.ceil(amount / 2500) - 1);
  for (var i = stack; i >= 1; i--) h += '<circle cx="0" cy="' + (i * 3) + '" r="' + R + '" fill="' + col[0] + '" stroke="rgba(0,0,0,.45)" stroke-width="1"/>';
  h += '<circle r="' + (R + 1) + '" cy="1.5" fill="rgba(0,0,0,.35)"/>'
    + '<circle r="' + R + '" fill="' + col[0] + '"/>'
    + '<circle r="' + (R - 1.5) + '" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="3" stroke-dasharray="' + (R * 0.42) + ' ' + (R * 0.42) + '"/>'
    + '<circle r="' + (R - 4.5) + '" fill="' + col[0] + '" stroke="rgba(255,255,255,.35)" stroke-width="1"/>'
    + '<text text-anchor="middle" dominant-baseline="central" font-size="' + (R * 0.62) + '" font-weight="700" fill="' + col[1] + '" font-family="Inter,sans-serif">' + chipText(amount) + '</text>';
  if (off) h += '<rect x="' + (-R + 2) + '" y="' + (-R - 11) + '" width="' + (2 * R - 4) + '" height="11" rx="3" fill="#111" stroke="#fff" stroke-width=".8"/><text y="' + (-R - 5.2) + '" text-anchor="middle" dominant-baseline="central" font-size="8" font-weight="700" fill="#fff">OFF</text>';
  var cls = 'chipg' + (hidden[k] ? ' hidden' : '') + (fresher[k] ? ' newchip' : '');
  return '<g class="' + cls + '" data-chip="' + k + '"><g transform="translate(' + x + ' ' + y + ')">' + h + '</g></g>';
}

function renderTable() {
  var t = S.tables[S.mode], wide = isWide();
  if (!L || L.mode !== S.mode || L.wide !== wide) L = LY.build(S.mode, wide);
  var h = '<svg xmlns="' + SVGNS + '" viewBox="0 0 ' + L.W + ' ' + L.H + '">' + L.decor;
  L.tracker.forEach(function (d) {
    var hit = t.atsHits.indexOf(d.n) >= 0;
    h += '<g class="trk' + (hit ? ' hit' : '') + '"><circle cx="' + d.x + '" cy="' + d.y + '" r="' + d.r + '"/>'
      + '<text x="' + d.x + '" y="' + (d.y + 0.5) + '" text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="700">' + d.n + '</text></g>';
  });
  L.spots.forEach(function (s) {
    var a = C.amt(t, s.k), na = removeMode ? !!C.canRemove(t, s.k) : (!!C.canAdd(t, s.k) && !a);
    var reason = C.canAdd(t, s.k);
    h += '<g class="spot' + (a ? ' has' : '') + (na ? ' na' : '') + '" data-k="' + s.k + '"><title>' + esc(s.tip + (reason && !a ? ' (' + reason + ')' : '')) + '</title>'
      + '<rect class="hit" x="' + s.x + '" y="' + s.y + '" width="' + s.w + '" height="' + s.h + '" rx="8"/>' + s.art + '</g>';
  });
  // chips on the table
  Object.keys(t.bets).forEach(function (k) {
    var an = L.anchors[k]; if (!an) return;
    if (/Odds:/.test(k) || k === 'passOdds' || k === 'dpOdds') { if (k === 'passOdds' || k === 'dpOdds') h += chipSVG(k, an.x, an.y, t.bets[k], L.chipR, false); return; }
    h += chipSVG(k, an.x, an.y, t.bets[k], L.chipR, isOff(t, k));
  });
  // odds targets for come / don't come bets
  L.odds.forEach(function (o) {
    if (!C.amt(t, o.base)) return;
    var a = C.amt(t, o.k), R = L.chipR;
    h += '<g class="oddsT spot" data-k="' + o.k + '"><title>' + esc(C.label(o.k)) + '</title><circle class="ring" cx="' + o.x + '" cy="' + o.y + '" r="' + R + '"/>'
      + (a ? '' : '<text x="' + o.x + '" y="' + (o.y + 0.5) + '" text-anchor="middle" dominant-baseline="central" font-size="8" font-weight="700" fill="#f2c75c">ODDS</text>') + '</g>';
    if (a) h += chipSVG(o.k, o.x, o.y, a, R, isOff(t, o.k));
  });
  h += '</svg>';
  $('svgHost').innerHTML = h;
  fresher = {};
  placePuck();
  placeDice(false);
}

function toPx(p) { var s = scale(); return { x: p.x * s, y: p.y * s }; }
function placePuck() {
  var t = T(), el = $('puck'), s = scale();
  var pk = Math.round((L.wide ? 40 : 34) * s);
  el.style.setProperty('--pk', pk + 'px');
  var at = t.point !== null ? L.puck[t.point] : L.puck.off;
  var p = toPx(at);
  el.style.transform = 'translate(' + (p.x - pk / 2) + 'px,' + (p.y - pk / 2) + 'px)';
  el.className = 'puck ' + (t.point !== null ? 'on' : 'off');
  el.textContent = t.point !== null ? 'ON' : 'OFF';
}

/* ---------------- dice ---------------- */
var dieEls = [];
function buildDice() {
  var layer = $('diceLayer'); layer.innerHTML = '';
  var P = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  dieEls = [0, 1].map(function () {
    var w = document.createElement('div'); w.className = 'dwrap';
    var sh = document.createElement('div'); sh.className = 'dshadow';
    var c = document.createElement('div'); c.className = 'cube';
    for (var v = 1; v <= 6; v++) {
      var f = document.createElement('div'); f.className = 'face f' + v;
      for (var i = 0; i < 9; i++) { var pip = document.createElement('i'); if (P[v].indexOf(i) >= 0) pip.className = 'on'; f.appendChild(pip); }
      c.appendChild(f);
    }
    w.appendChild(sh); w.appendChild(c); layer.appendChild(w);
    return { wrap: w, cube: c, shadow: sh };
  });
}
var BASE = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };
function rotStr(x, y, z) { return 'rotateZ(' + z + 'deg) rotateX(' + x + 'deg) rotateY(' + y + 'deg)'; }
function diceState() {
  var key = S.mode + (L.wide ? 'W' : 'N'), d = S.dice[key];
  if (!d) {
    var z = L.zone, cx = (z.x0 + z.x1) / 2, cy = z.y0 + L.ds;
    d = S.dice[key] = { v: [6, 6], pos: [{ x: cx - L.ds * 0.7, y: cy }, { x: cx + L.ds * 0.7, y: cy + 4 }], z: [8, -14] };
  }
  return d;
}
function wrapTransform(p, sc) { var s = scale(), ds = L.ds * s; return 'translate(' + (p.x * s - ds / 2) + 'px,' + (p.y * s - ds / 2) + 'px) scale(' + (sc || 1) + ')'; }
function placeDice() {
  if (rolling) return;
  var d = diceState(), ds = L.ds * scale();
  $('diceLayer').style.setProperty('--ds', ds + 'px');
  dieEls.forEach(function (e, i) {
    var b = BASE[d.v[i]];
    e.wrap.style.transform = wrapTransform(d.pos[i]);
    e.cube.style.transform = rotStr(b[0], b[1], d.z[i]);
    e.shadow.style.opacity = 1;
  });
}
function visibleRange() {
  var r = $('tw').getBoundingClientRect(), s = scale();
  var dockH = document.querySelector('.dock').getBoundingClientRect().height;
  var top = Math.max(0, -r.top) / s, bot = Math.min(r.height, window.innerHeight - dockH - r.top) / s;
  return { top: top, bot: bot };
}
function animateDice(v1, v2, done) {
  var d = diceState(), z = L.zone, vis = visibleRange(), ds = L.ds;
  var y0 = Math.max(z.y0, vis.top + ds), y1 = Math.min(z.y1, vis.bot - ds);
  if (y1 - y0 < ds) { y0 = Math.max(ds, vis.top + ds * 1.5); y1 = Math.max(y0 + ds, Math.min(L.H - ds, vis.bot - ds * 1.5)); }
  var ex = rand(z.x0, z.x1 - ds * 1.5), ey = rand(y0, y1);
  var ends = [{ x: ex, y: ey }, { x: ex + ds * rand(1.15, 1.6), y: ey + ds * rand(-0.5, 0.5) }];
  var startY = Math.min(L.H, vis.bot) + ds * 1.2, wallY = Math.max(vis.top, 0) + ds * 0.6;
  var startX = L.wide ? rand(L.W * 0.45, L.W * 0.7) : rand(L.W * 0.35, L.W * 0.65);
  var vals = [v1, v2], dur = 1250;
  var anims = [];
  dieEls.forEach(function (e, i) {
    var end = ends[i], sx = startX + i * ds * 0.9, wx = (sx + end.x) / 2 + rand(-60, 60), wy = wallY + rand(0, ds * 0.8);
    var bx = end.x + (wx - end.x) * 0.3, by = end.y + (wy - end.y) * 0.28;
    var s = { x: sx, y: startY };
    var fr = [
      { transform: wrapTransform(s, 1.9), offset: 0 },
      { transform: wrapTransform({ x: wx, y: wy }, 1.35), offset: 0.42 },
      { transform: wrapTransform({ x: bx, y: by }, 1.18), offset: 0.64 },
      { transform: wrapTransform({ x: end.x + rand(-6, 6), y: end.y + rand(-4, 4) }, 1.0), offset: 0.82 },
      { transform: wrapTransform(end, 1), offset: 1 }
    ];
    anims.push(e.wrap.animate(fr, { duration: dur, easing: 'cubic-bezier(.25,.7,.35,1)', fill: 'forwards' }));
    var b = BASE[vals[i]], zf = rand(-35, 35), sx1 = (i ? -1 : 1) * 360 * 3, sy1 = (i ? 1 : -1) * 360 * 2;
    anims.push(e.cube.animate([
      { transform: rotStr(rand(0, 360), rand(0, 360), rand(0, 180)), offset: 0 },
      { transform: rotStr(b[0] + sx1 * 0.55, b[1] + sy1 * 0.5, zf + 200), offset: 0.42 },
      { transform: rotStr(b[0] + sx1 * 0.15, b[1] + sy1 * 0.2, zf + 60), offset: 0.64 },
      { transform: rotStr(b[0], b[1], zf + 8), offset: 0.82 },
      { transform: rotStr(b[0], b[1], zf), offset: 1 }
    ], { duration: dur, easing: 'cubic-bezier(.25,.7,.35,1)', fill: 'forwards' }));
    d.z[i] = zf;
  });
  clack(dur * 0.42 / 1000, 0.7); clack(dur * 0.43 / 1000, 0.4);
  clack(dur * 0.64 / 1000, 0.45); clack(dur * 0.8 / 1000, 0.3); clack(dur * 0.9 / 1000, 0.15);
  setTimeout(function () {
    d.v = vals; d.pos = ends;
    rolling = false;
    anims.forEach(function (a) { a.cancel(); });
    placeDice();
    done();
  }, dur + 30);
}

/* ---------------- effects ---------------- */
function fxChip(amount, from, to, opt) {
  opt = opt || {};
  var s = scale(), R = L.chipR * s * 2, col = chipColor(amount);
  var el = document.createElement('div'); el.className = 'fxchip';
  el.style.width = el.style.height = R + 'px'; el.style.background = col[0]; el.style.color = col[1];
  el.style.fontSize = Math.max(9, R * 0.3) + 'px';
  el.textContent = chipText(amount);
  $('fx').appendChild(el);
  var a = toPx(from), b = toPx(to);
  var anim = el.animate([
    { transform: 'translate(' + (a.x - R / 2) + 'px,' + (a.y - R / 2) + 'px)', opacity: opt.fadeIn ? 0 : 1 },
    { transform: 'translate(' + (b.x - R / 2) + 'px,' + (b.y - R / 2) + 'px)', opacity: opt.fadeOut ? 0 : 1 }
  ], { duration: opt.dur || 520, delay: opt.delay || 0, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'both' });
  anim.onfinish = function () { el.remove(); if (opt.after) opt.after(); };
}
function fxText(txt, at, cls, delay) {
  var el = document.createElement('div'); el.className = 'fxtxt ' + cls; el.textContent = txt;
  var p = toPx(at);
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  $('fx').appendChild(el);
  var anim = el.animate([
    { transform: 'translate(-50%,-30%)', opacity: 0 },
    { transform: 'translate(-50%,-110%)', opacity: 1, offset: 0.2 },
    { transform: 'translate(-50%,-110%)', opacity: 1, offset: 0.75 },
    { transform: 'translate(-50%,-200%)', opacity: 0 }
  ], { duration: 1500, delay: delay || 0, fill: 'both' });
  anim.onfinish = function () { el.remove(); };
}
function bankPoint() {
  var tw = $('tw').getBoundingClientRect(), b = $('bank').getBoundingClientRect(), s = scale();
  return { x: (b.left + b.width / 2 - tw.left) / s, y: (b.top + b.height / 2 - tw.top) / s };
}
function showCall(main, small) {
  var el = $('call'), vis = visibleRange(), s = scale();
  el.style.top = Math.max(40, (vis.top + (vis.bot - vis.top) * 0.2) * s) + 'px';
  el.innerHTML = esc(main) + (small ? '<small>' + esc(small) + '</small>' : '');
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}
function playEffects(res, prevBets) {
  var house = L.house, bank = bankPoint(), anyWin = false;
  res.ev.forEach(function (e) {
    var an = L.anchors[e.k]; if (!an) return;
    if (e.r === 'lose') {
      fxChip(-e.net, an, house, { fadeOut: true, dur: 620 });
      fxText(money(e.net), an, 'lose');
    } else if (e.r === 'win') {
      anyWin = true;
      var stake = prevBets[e.k] || 0;
      var total = e.net + (e.keep ? 0 : stake);
      fxText(money(e.net, true), an, 'win', 150);
      fxChip(e.net, house, an, { dur: 480, delay: 250, fadeIn: true, after: function () {
        fxChip(total, an, bank, { dur: 560, delay: 250, fadeOut: true });
      } });
    } else if (e.r === 'move') {
      var dest = L.anchors[e.to];
      if (dest) {
        hidden[e.to] = true;
        fxChip(prevBets[e.k], an, dest, { dur: 600, delay: 150, after: function () { delete hidden[e.to]; renderTable(); } });
      }
    } else if (e.r === 'push' && !e.keep) {
      fxChip(prevBets[e.k] || 0, an, bank, { dur: 560, delay: 200, fadeOut: true });
    }
  });
  if (anyWin) setTimeout(winChime, 260);
}

/* ---------------- status + page ---------------- */
function callFor(res, mode) {
  var s = res.s, pb = res.pointBefore, pa = res.pointAfter, dont = C.MODES[mode].dont;
  var hardWay = res.hard && [4, 6, 8, 10].indexOf(s) >= 0;
  var nick = { 2: 'Aces', 3: 'Ace-deuce', 11: 'Yo-leven', 12: 'Boxcars' }[s];
  if (pb === null) {
    if (s === 7) return ['Seven!', 'Front line winner'];
    if (s === 11 && dont) return ['Yo-leven!', 'Front line winner'];
    if (dont && (s === 2 || s === 3 || s === 12)) return [nick + ', craps!', 'Line away' + (s === 12 ? ' · bar the 12' : '')];
    return ['The point is ' + s, 'Mark it'];
  }
  if (pa === null && s === 7) return ['Seven out!', 'Line away'];
  if (pa === null) return ['Winner! ' + s, 'Pay the line'];
  if (hardWay) return [s + ' the hard way', (s / 2) + ' and ' + (s / 2)];
  if (nick) return [nick + '!', s === 2 || s === 12 ? 'Pay the horn' : ''];
  if ([4, 6, 8, 10].indexOf(s) >= 0) return ['Easy ' + s, ''];
  return [String(s), s === 5 ? 'No field five' : s === 9 ? 'Center field nine' : ''];
}
function summarize(res) {
  var c = callFor(res, S.mode);
  var head = res.d1 + ' + ' + res.d2 + ' = ' + res.s + ' · ' + c[0].replace(/!$/, '');
  var sub = res.pointAfter !== null ? 'Point is ' + res.pointAfter + '.' : 'Coming out.';
  if (res.ev.length) sub += ' Roll result: <span class="net ' + (res.net > 0 ? 'pos' : res.net < 0 ? 'neg' : '') + '">' + money(res.net, true) + '</span>';
  var ev = res.ev.map(function (e) {
    var txt = C.label(e.k) + ' ';
    if (e.r === 'win') txt += money(e.net, true);
    else if (e.r === 'lose') txt += money(e.net);
    else if (e.r === 'move') txt += '→ ' + e.to.split(':')[1];
    else txt += e.why ? '(' + e.why + ')' : 'push';
    return '<span class="ev ' + e.r + '">' + esc(txt) + '</span>';
  }).join('');
  return { head: head, sub: sub, ev: ev };
}
var WAYS = [0,0,1,2,3,4,5,6,5,4,3,2,1];
function fairHTML() {
  var st = S.stats, n = st.n, max = 0, rows = '';
  for (var s = 2; s <= 12; s++) max = Math.max(max, WAYS[s] / 36, n ? st.totals[s] / n : 0);
  for (s = 2; s <= 12; s++) {
    var exp = WAYS[s] / 36, got = n ? st.totals[s] / n : 0;
    rows += '<div class="fr"><b>' + s + '</b><div class="fbar"><i style="width:' + (got / max * 100) + '%"></i><em style="left:' + (exp / max * 100) + '%"></em></div>'
      + '<span>' + (n ? (got * 100).toFixed(1) + '%' : '-') + '</span><span class="fexp">' + (exp * 100).toFixed(1) + '%</span></div>';
  }
  var faces = n ? [1,2,3,4,5,6].map(function (f) { return f + ': ' + (st.faces[f] / (2 * n) * 100).toFixed(1) + '%'; }).join(' · ') : '';
  return '<summary>Fair dice: how every roll works</summary>'
    + '<p>Every roll is random, and nothing you do at the table can change it.</p><ul>'
    + '<li><b>True randomness.</b> Each die comes from your browser\u2019s built-in cryptographic random number generator, the same source used to create encryption keys. Every face from 1 to 6 has exactly the same chance.</li>'
    + '<li><b>Decided before the throw.</b> Both dice are rolled independently the moment you press Roll. The tumbling animation only shows that result.</li>'
    + '<li><b>No thumb on the scale.</b> Your bets, bankroll and past rolls are never used to pick a number. There are no built-in hot or cold streaks.</li>'
    + '<li><b>Standard casino rules.</b> Every payout is printed on the table and matches common Las Vegas paytables.</li>'
    + '<li><b>Open for anyone to check.</b> The full code is public on GitHub, including an automated test suite for every payout.</li>'
    + '<li><b>Play money only.</b> Nothing is bought, wagered or paid out in real money.</li></ul>'
    + '<p class="fhead">Your rolls so far: <b>' + n.toLocaleString() + '</b> ' + (n === 1 ? 'roll' : 'rolls') + '. Bars show how often each total came up, and the line marks the mathematical expectation. The more you roll, the closer they get.</p>'
    + '<div class="fgrid"><div class="fr fh"><b>Total</b><div></div><span>Yours</span><span class="fexp">Expected</span></div>' + rows + '</div>'
    + (faces ? '<p class="fhead">Each face (expected 16.7%): ' + faces + '</p>' : '')
    + '<button class="ghost" id="resetStats" type="button">Reset roll stats</button>';
}
function rulesHTML() {
  if (S.mode === 'craps') return '<summary>How Craps works here</summary><ul>'
    + '<li><b>Come-out:</b> 7 or 11 wins Pass, 2, 3 or 12 loses. Don’t Pass wins on 2 or 3 and pushes on 12. Any other number becomes the point.</li>'
    + '<li><b>Point on:</b> roll the point before a 7 and Pass wins. A 7 first and Don’t Pass wins.</li>'
    + '<li><b>Come / Don’t Come</b> work the same way starting on the next roll, then travel to their own number. Tap the gold ODDS circle next to a traveled bet to add odds.</li>'
    + '<li><b>Odds (3-4-5x):</b> 3x on 4 and 10, 4x on 5 and 9, 5x on 6 and 8, paid at true odds. Don’t bettors can lay enough to win 6x their flat bet. Come odds are off on the come-out.</li>'
    + '<li><b>Place</b> pays 9:5 on 4/10, 7:5 on 5/9, 7:6 on 6/8. <b>Buy</b> and <b>Lay</b> pay true odds minus 5%.</li>'
    + '<li>Place, Buy and Hardways stay up after a win and are off on the come-out. Pass and Don’t Pass flats also stay up.</li></ul>';
  return '<summary>How Crapless Craps works here</summary><ul>'
    + '<li><b>Come-out:</b> only 7 wins. Nothing loses. 2, 3, 11 and 12 become points along with 4 through 10.</li>'
    + '<li><b>Point on:</b> roll the point before a 7 to win. No Don’t Pass or Don’t Come.</li>'
    + '<li><b>Odds (3-4-5x):</b> 3x on 2, 3, 4, 10, 11, 12 · 4x on 5 and 9 · 5x on 6 and 8. True odds pay 6:1 on 2/12, 3:1 on 3/11, 2:1 on 4/10, 3:2 on 5/9, 6:5 on 6/8.</li>'
    + '<li><b>Place</b> 2/12 pays 11:2 and 3/11 pays 11:4, plus the usual 9:5, 7:5 and 7:6.</li>'
    + '<li>Everything else works like the Craps tab.</li></ul>';
}
function render() {
  var t = T();
  document.querySelectorAll('.tab').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.mode === S.mode); });
  var bk = $('bank'), prevBank = +bk.dataset.v;
  bk.textContent = money(S.bank);
  if (!isNaN(prevBank) && bk.dataset.v !== undefined && S.bank !== prevBank && !rolling) {
    var cls = S.bank > prevBank ? 'bump' : 'dip';
    bk.classList.remove('bump', 'dip'); void bk.offsetWidth; bk.classList.add(cls);
  }
  bk.dataset.v = S.bank;
  $('ontable').textContent = money(C.onTable(t));
  var Ls = S.last[S.mode];
  if (Ls) { $('headline').textContent = Ls.head; $('subline').innerHTML = Ls.sub; $('events').innerHTML = Ls.ev; }
  else {
    $('headline').textContent = t.point !== null ? 'Point is ' + t.point : 'Coming out · place your bets';
    $('subline').textContent = C.MODES[S.mode].dont ? 'Odds 3x-4x-5x.' : 'Crapless: every number but 7 is a point. Odds 3x-4x-5x.';
    $('events').innerHTML = '';
  }
  $('hist').innerHTML = t.rolls.slice(0, 20).map(function (r) {
    return '<span class="' + (r.s === 7 ? 'seven' : '') + (r.d1 === r.d2 && r.s !== 2 && r.s !== 12 ? ' hardx' : '') + '" title="' + r.d1 + '-' + r.d2 + '">' + r.s + '</span>';
  }).join('');
  $('chips').innerHTML = CHIPS.map(function (d) { var c = d * 100; return '<button class="chip c' + d + '" data-chip="' + c + '" aria-pressed="' + (S.chip === c) + '" aria-label="$' + d + ' chip">' + chipText(c) + '</button>'; }).join('');
  $('removeMode').setAttribute('aria-pressed', removeMode);
  $('removeMode').textContent = removeMode ? 'Taking down' : 'Take down';
  $('sound').textContent = S.sound ? 'Sound on' : 'Sound off';
  $('rules').innerHTML = rulesHTML();
  $('fair').innerHTML = fairHTML();
  renderTable();
}

/* ---------------- actions ---------------- */
function clickBet(k, forceRemove) {
  if (rolling) return;
  var t = T();
  if (removeMode || forceRemove) {
    var r = C.remove(t, k, S.chip);
    if (!r.ok) return toast(r.reason);
    S.bank += r.removed;
    chipClick();
    var an = L.anchors[k] || oddsAnchor(k);
    save(); render();
    if (an) fxChip(r.removed, an, bankPoint(), { dur: 450, fadeOut: true });
    return;
  }
  var c = Math.min(S.chip, S.bank);
  if (c <= 0) return toast('Out of chips. Take bets down or reset your bankroll.');
  var a = C.add(t, k, c);
  if (!a.ok) return toast(a.reason);
  S.bank -= a.added;
  if (a.added < S.chip) toast(a.added < c ? 'Max odds reached: ' + money(a.added) + ' added' : 'Added your last ' + money(a.added));
  chipClick();
  fresher[k] = true;
  save(); render();
}
function oddsAnchor(k) { for (var i = 0; i < L.odds.length; i++) if (L.odds[i].k === k) return L.odds[i]; return null; }

function doRoll() {
  if (rolling) return;
  rolling = true;
  $('roll').disabled = true;
  ac();
  var d1 = rnd(), d2 = rnd();
  animateDice(d1, d2, function () {
    var t = T(), prev = JSON.parse(JSON.stringify(t.bets));
    var res = C.roll(t, d1, d2);
    S.bank += res.back;
    S.stats.n++; S.stats.totals[res.s]++; S.stats.faces[d1]++; S.stats.faces[d2]++;
    S.last[S.mode] = summarize(res);
    var c = callFor(res, S.mode);
    save();
    playEffects(res, prev);
    render();
    showCall(c[0], c[1]);
    $('roll').disabled = false;
  });
}

/* ---------------- wiring ---------------- */
var press = null;
function spotFrom(e) { var g = e.target.closest && e.target.closest('[data-k]'); return g ? g.dataset.k : null; }
var host = $('svgHost');
host.addEventListener('click', function (e) {
  if (press && press.fired) { press = null; return; }
  var k = spotFrom(e); if (k) clickBet(k);
});
host.addEventListener('contextmenu', function (e) { var k = spotFrom(e); if (k) { e.preventDefault(); clickBet(k, true); } });
host.addEventListener('pointerdown', function (e) {
  if (e.pointerType === 'mouse') return;
  var k = spotFrom(e); if (!k) return;
  press = { k: k, fired: false, x: e.clientX, y: e.clientY };
  press.timer = setTimeout(function () { if (press) { press.fired = true; clickBet(k, true); } }, 480);
});
['pointerup', 'pointercancel'].forEach(function (ev) { host.addEventListener(ev, function () { if (press) clearTimeout(press.timer); if (press && !press.fired) press = null; }); });
host.addEventListener('pointermove', function (e) { if (press && !press.fired && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) { clearTimeout(press.timer); press = null; } });

$('chips').addEventListener('click', function (e) { var b = e.target.closest('[data-chip]'); if (b) { S.chip = +b.dataset.chip; chipClick(); save(); render(); } });
document.querySelector('.tabs').addEventListener('click', function (e) {
  var b = e.target.closest('[data-mode]'); if (!b || rolling) return;
  S.mode = b.dataset.mode; removeMode = false; save(); render();
});
$('removeMode').addEventListener('click', function () { removeMode = !removeMode; render(); });
$('clear').addEventListener('click', function () {
  if (rolling) return;
  var back = C.removeAll(T());
  S.bank += back; save(); render();
  toast(back ? 'Returned ' + money(back) + '. Contract bets stay up.' : 'Nothing to take down');
});
$('sound').addEventListener('click', function () { S.sound = !S.sound; save(); render(); if (S.sound) chipClick(); });
$('reset').addEventListener('click', function () {
  if (rolling) return;
  var keepStats = S.stats;
  S = fresh(S.mode, S.chip, S.sound);
  S.stats = keepStats;
  removeMode = false; save(); render(); toast('Bankroll reset to $1,000');
});
$('roll').addEventListener('click', doRoll);
$('fair').addEventListener('click', function (e) {
  if (e.target.id !== 'resetStats') return;
  S.stats = { n: 0, totals: [0,0,0,0,0,0,0,0,0,0,0,0,0], faces: [0,0,0,0,0,0,0] };
  save(); render();
});
$('fairLink').addEventListener('click', function (e) {
  e.preventDefault(); var f = $('fair'); f.open = true; f.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.addEventListener('keydown', function (e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === 'Space' || e.key === 'r' || e.key === 'R') { e.preventDefault(); doRoll(); }
});
var rz;
window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (!rolling) renderTable(); }, 120); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!rolling) renderTable(); });

buildDice();
render();
})();
