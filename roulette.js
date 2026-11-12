/* The roulette table.

   The cloth is drawn as one SVG from the bet table in roul.js, so the layout
   and the engine can never disagree about what a corner covers: every hit area
   on screen is generated from a bet that exists, and every bet that exists gets
   a hit area. Chips are drawn at each bet's anchor, which for a split is the
   middle of the line the two numbers share, for a corner the point where four
   of them meet, and so on, exactly as you would lay them by hand.

   The wheel is honest in the way that matters: the pocket is chosen first, by
   the same unbiased generator the other games use, and the ball is then
   animated to land on it. Nothing the animation does can change the result. */
(function () {
  'use strict';
  var C = window.Casino, R = window.Roul;
  var money = C.money, toast = C.toast, $ = function (id) { return document.getElementById(id); };

  /* ---------------- state ---------------- */
  var S = C.game('roulette', { mode: 'euro', chip: 500, last: null });
  if (S.mode !== 'american') S.mode = 'euro';
  var G = R.newGame(S.mode);
  var spinning = false, lastBets = null;

  function bank() { return C.bank(); }
  function save() { C.save(); }

  /* ---------------- the cloth ---------------- */
  var ZW = 58, CW = 62, CH = 82, X0 = ZW, GRID = 246, COLW = 78;
  var DOZ_Y = GRID, DOZ_H = 62, EVEN_Y = DOZ_Y + DOZ_H, EVEN_H = 62;
  var WIDE = X0 + CW * 12;              /* 802: right edge of the numbers */

  function numBox(v) {
    var c = R.cell(v);
    return { x: X0 + c.s * CW, y: (2 - c.p) * CH, w: CW, h: CH };
  }
  /* where a chip for this bet sits, which is also where you click for it */
  function anchor(mode, key) {
    var bet = R.table(mode)[key], nums = bet.nums, i;
    var pre = key.split(':')[0];
    if (key === 'basket') return [X0, GRID];
    if (pre === 'col') { i = +key.slice(4); return [WIDE + COLW / 2, (3 - i) * CH + CH / 2]; }
    if (pre === 'doz') { i = +key.slice(4); return [X0 + (i - 0.5) * (WIDE - X0) / 3, DOZ_Y + DOZ_H / 2]; }
    if (['low', 'even', 'red', 'black', 'odd', 'high'].indexOf(key) >= 0) {
      i = ['low', 'even', 'red', 'black', 'odd', 'high'].indexOf(key);
      return [X0 + (i + 0.5) * (WIDE - X0) / 6, EVEN_Y + EVEN_H / 2];
    }
    /* anything touching a green sits on the zero cell's own edges */
    var greens = nums.filter(R.isZero).length;
    if (greens) {
      if (mode === 'euro') {
        if (key === 's:0') return [ZW / 2, GRID / 2];
        if (key === 'p:0-1') return [X0, 2 * CH + CH / 2];
        if (key === 'p:0-2') return [X0, CH + CH / 2];
        if (key === 'p:0-3') return [X0, CH / 2];
        if (key === 't:0-1-2') return [X0, 2 * CH];
        if (key === 't:0-2-3') return [X0, CH];
      } else {
        if (key === 's:00') return [ZW / 2, GRID / 4];
        if (key === 's:0') return [ZW / 2, GRID * 3 / 4];
        if (key === 'p:0-00') return [ZW / 2, GRID / 2];
        if (key === 'p:0-1') return [X0, 2 * CH + CH / 2];
        if (key === 'p:0-2') return [X0, (GRID / 2 + 2 * CH) / 2];
        if (key === 'p:2-00') return [X0, (CH + GRID / 2) / 2];
        if (key === 'p:3-00') return [X0, CH / 2];
        if (key === 't:0-1-2') return [X0, 2 * CH];
        if (key === 't:2-3-00') return [X0, CH];
      }
    }
    if (pre === 's') { var b = numBox(nums[0]); return [b.x + b.w / 2, b.y + b.h / 2]; }
    if (pre === 'p') {
      var a = R.cell(nums[0]), z = R.cell(nums[1]);
      if (a.s === z.s) return [X0 + a.s * CW + CW / 2, (2 - Math.min(a.p, z.p)) * CH];
      return [X0 + Math.max(a.s, z.s) * CW, (2 - a.p) * CH + CH / 2];
    }
    if (pre === 't') { return [X0 + R.cell(nums[0]).s * CW + CW / 2, GRID]; }
    if (pre === 'c') {
      var cs = nums.map(R.cell);
      var smax = Math.max.apply(null, cs.map(function (q) { return q.s; }));
      var pmin = Math.min.apply(null, cs.map(function (q) { return q.p; }));
      return [X0 + smax * CW, (2 - pmin) * CH];
    }
    if (pre === 'l') {
      var ls = nums.map(R.cell).map(function (q) { return q.s; });
      return [X0 + Math.max.apply(null, ls) * CW, GRID];
    }
    return [WIDE / 2, GRID / 2];
  }

  var SVGNS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, cls) {
    var e = document.createElementNS(SVGNS, name), k;
    for (k in attrs) e.setAttribute(k, attrs[k]);
    if (cls) e.setAttribute('class', cls);
    return e;
  }

  function buildCloth() {
    var svg = $('cloth'), t = R.table(S.mode), i, k;
    svg.innerHTML = '';
    svg.setAttribute('viewBox', '0 0 ' + (WIDE + COLW + 2) + ' ' + (EVEN_Y + EVEN_H + 2));
    var cells = el('g'), tops = el('g'), chips = el('g');
    chips.setAttribute('id', 'clothChips');
    var glow = el('g'); glow.setAttribute('id', 'clothGlow');

    function cellRect(key, x, y, w, h, cls, label, small) {
      var r = el('rect', { x: x, y: y, width: w, height: h, rx: 3 }, 'cell ' + cls + ' live cellhit');
      r.dataset.key = key;
      cells.appendChild(r);
      if (label != null) {
        var tx = el('text', { x: x + w / 2, y: y + h / 2 }, small ? 'out-t sm' : (cls === 'out' ? 'out-t' : 'num-t'));
        tx.textContent = label;
        cells.appendChild(tx);
      }
    }
    /* the greens */
    if (S.mode === 'euro') cellRect('s:0', 1, 0, ZW - 1, GRID, 'green', '0');
    else {
      cellRect('s:00', 1, 0, ZW - 1, GRID / 2, 'green', '00');
      cellRect('s:0', 1, GRID / 2, ZW - 1, GRID / 2, 'green', '0');
    }
    /* the numbers */
    for (i = 1; i <= 36; i++) {
      var b = numBox(i);
      cellRect('s:' + i, b.x, b.y, b.w, b.h, R.isRed(i) ? 'red' : 'black', String(i));
    }
    /* columns, dozens, even money */
    for (i = 1; i <= 3; i++) cellRect('col:' + i, WIDE, (3 - i) * CH, COLW, CH, 'out', '2 to 1', true);
    for (i = 1; i <= 3; i++) {
      cellRect('doz:' + i, X0 + (i - 1) * (WIDE - X0) / 3, DOZ_Y, (WIDE - X0) / 3, DOZ_H, 'out', t['doz:' + i].label);
    }
    ['low', 'even', 'red', 'black', 'odd', 'high'].forEach(function (key, j) {
      var x = X0 + j * (WIDE - X0) / 6, w = (WIDE - X0) / 6;
      var cls = key === 'red' ? 'red' : key === 'black' ? 'black' : 'out';
      cellRect(key, x, EVEN_Y, w, EVEN_H, cls, key === 'red' ? 'RED' : key === 'black' ? 'BLACK' : t[key].label.toUpperCase());
    });

    /* the edge bets go on top, so a click near a line takes the line */
    Object.keys(t).forEach(function (key) {
      var kind = t[key].kind;
      if (kind === 'straight' || kind === 'column' || kind === 'dozen' || kind === 'even') return;
      var a = anchor(S.mode, key);
      var hw = 15, hh = 15;
      var r = el('rect', { x: a[0] - hw, y: a[1] - hh, width: hw * 2, height: hh * 2, rx: 4 }, 'hit');
      r.dataset.key = key;
      r.setAttribute('aria-label', t[key].label);
      tops.appendChild(r);
    });

    svg.appendChild(cells);
    svg.appendChild(tops);
    svg.appendChild(glow);
    svg.appendChild(chips);
    paintChips();
  }

  function paintChips() {
    var host = $('clothChips');
    if (!host) return;
    host.innerHTML = '';
    Object.keys(G.bets).forEach(function (key) {
      var amt = G.bets[key];
      if (!amt) return;
      var a = anchor(S.mode, key);
      /* chipColor hands back the face and the ink, in that order */
      var col = C.chipColor(amt);
      var g = el('g', {}, 'chip-g');
      g.appendChild(el('circle', { cx: a[0], cy: a[1], r: 17, fill: col[0] }));
      g.appendChild(el('circle', { cx: a[0], cy: a[1], r: 12, fill: 'none', stroke: 'rgba(255,255,255,.6)', 'stroke-width': 2, 'stroke-dasharray': '5 5' }));
      var tx = el('text', { x: a[0], y: a[1] + 0.5, fill: col[1] });
      tx.textContent = C.chipText(amt);
      g.appendChild(tx);
      host.appendChild(g);
    });
  }

  /* light up every cell the winning number belongs to */
  function glowWin(n) {
    var host = $('clothGlow');
    if (!host) return;
    host.innerHTML = '';
    if (R.isZero(n)) {
      var h = S.mode === 'euro' ? GRID : GRID / 2;
      var y = (S.mode === 'euro' || n === '00') ? 0 : GRID / 2;
      host.appendChild(el('rect', { x: 1, y: y, width: ZW - 1, height: h, rx: 3 }, 'winglow on'));
    } else {
      var b = numBox(n);
      host.appendChild(el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 3 }, 'winglow on'));
    }
  }

  /* ---------------- the wheel ---------------- */
  var wheelAngle = 0, ballAngle = 0, ballR = 176, anim = null;
  var RIM = 196, R1 = 128, R2 = 176, HUB = 112;

  function buildWheel() {
    var svg = $('wheel'), w = R.wheel(S.mode), N = w.length, i;
    svg.innerHTML = '';
    var defs = el('defs');
    defs.innerHTML = '<radialGradient id="hubg"><stop offset="0" stop-color="#6a4a22"/>'
      + '<stop offset=".7" stop-color="#3a2512"/><stop offset="1" stop-color="#1b1109"/></radialGradient>'
      + '<radialGradient id="rimg"><stop offset=".86" stop-color="#2a1a10"/><stop offset=".93" stop-color="#8a6a30"/>'
      + '<stop offset="1" stop-color="#4a3418"/></radialGradient>';
    svg.appendChild(defs);
    svg.appendChild(el('circle', { cx: 200, cy: 200, r: RIM, fill: 'url(#rimg)' }));
    var rot = el('g', { id: 'wheelRot' });
    for (i = 0; i < N; i++) {
      var a0 = (i / N) * 360 - 90 - 180 / N, a1 = a0 + 360 / N;
      var p = el('path', {
        d: arc(200, 200, R1, R2, a0, a1),
        fill: R.colour(w[i]) === 'red' ? '#9e2a20' : R.colour(w[i]) === 'black' ? '#1a1820' : '#0f6b40',
        stroke: 'rgba(240,210,150,.5)', 'stroke-width': 1
      });
      rot.appendChild(p);
      var mid = (a0 + a1) / 2;
      var tp = polar(200, 200, (R1 + R2) / 2, mid);
      var tx = el('text', {
        x: tp[0], y: tp[1], fill: '#fff6e0', 'font-size': N > 37 ? 13 : 14,
        'font-family': 'Oswald, sans-serif', 'font-weight': 600,
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        transform: 'rotate(' + (mid + 90) + ' ' + tp[0] + ' ' + tp[1] + ')'
      });
      tx.textContent = w[i];
      rot.appendChild(tx);
    }
    /* the cone and the frets */
    rot.appendChild(el('circle', { cx: 200, cy: 200, r: HUB, fill: 'url(#hubg)', stroke: 'rgba(240,210,150,.45)', 'stroke-width': 2 }));
    for (i = 0; i < 8; i++) {
      var q = polar(200, 200, HUB - 8, i * 45);
      rot.appendChild(el('line', { x1: 200, y1: 200, x2: q[0], y2: q[1], stroke: 'rgba(240,210,150,.3)', 'stroke-width': 3 }));
    }
    rot.appendChild(el('circle', { cx: 200, cy: 200, r: 26, fill: '#c9962b', stroke: '#6a4a22', 'stroke-width': 3 }));
    svg.appendChild(rot);
    var ball = el('circle', { id: 'ball', cx: 200, cy: 200 - R2, r: 9, fill: '#fffdf4', stroke: 'rgba(0,0,0,.4)', 'stroke-width': 1 });
    svg.appendChild(ball);
    placeBall();
    spinWheelTo(wheelAngle);
  }
  function polar(cx, cy, r, deg) {
    var a = (deg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }
  function arc(cx, cy, r1, r2, a0, a1) {
    var p1 = polar(cx, cy, r2, a0 + 90), p2 = polar(cx, cy, r2, a1 + 90);
    var p3 = polar(cx, cy, r1, a1 + 90), p4 = polar(cx, cy, r1, a0 + 90);
    var big = (a1 - a0) > 180 ? 1 : 0;
    return 'M' + p1[0] + ' ' + p1[1] + 'A' + r2 + ' ' + r2 + ' 0 ' + big + ' 1 ' + p2[0] + ' ' + p2[1]
      + 'L' + p3[0] + ' ' + p3[1] + 'A' + r1 + ' ' + r1 + ' 0 ' + big + ' 0 ' + p4[0] + ' ' + p4[1] + 'Z';
  }
  function spinWheelTo(deg) {
    var g = $('wheelRot');
    if (g) g.setAttribute('transform', 'rotate(' + deg.toFixed(2) + ' 200 200)');
  }
  function placeBall() {
    var b = $('ball');
    if (!b) return;
    var p = polar(200, 200, ballR, ballAngle);
    b.setAttribute('cx', p[0].toFixed(2));
    b.setAttribute('cy', p[1].toFixed(2));
  }
  function pocketDeg(idx) {
    var N = R.wheel(S.mode).length;
    return (idx / N) * 360;
  }

  /* ---------------- rendering ---------------- */
  function renderHistory() {
    var h = $('history');
    h.innerHTML = G.history.slice(0, 18).map(function (x) {
      return '<i class="' + x.colour + '">' + x.n + '</i>';
    }).join('');
    var N = R.wheel(S.mode).length;
    var reds = 0, blacks = 0, greens = 0;
    G.history.forEach(function (x) {
      if (x.colour === 'red') reds++; else if (x.colour === 'black') blacks++; else greens++;
    });
    $('statline').innerHTML = G.history.length
      ? 'Last ' + G.history.length + ' · <b>' + reds + '</b> red · <b>' + blacks + '</b> black · <b>' + greens + '</b> green'
      : N + ' pockets · one ball';
  }
  function renderCalled(res) {
    var c = $('called');
    if (!res) { c.innerHTML = '<span class="say">No number yet</span>'; return; }
    c.innerHTML = '<div class="num ' + res.colour + '" id="calledNum">' + res.n + '</div>'
      + '<span class="say">' + res.colour + (R.isZero(res.n) ? '' : (res.n % 2 ? ' · odd' : ' · even')
        + (res.n <= 18 ? ' · low' : ' · high')) + '</span>';
    var n = $('calledNum');
    if (n) { requestAnimationFrame(function () { n.classList.add('pop'); setTimeout(function () { n.classList.remove('pop'); }, 260); }); }
  }
  function renderLedger(res) {
    var l = $('ledger');
    if (!res) { l.innerHTML = ''; return; }
    var parts = res.ev.filter(function (x) { return x.won; }).slice(0, 7).map(function (x) {
      return '<span class="win">' + C.esc(labelFor(x)) + ' paid ' + money(x.returned - x.amount) + '</span>';
    });
    var lost = res.ev.filter(function (x) { return !x.won; });
    if (lost.length) {
      var total = lost.reduce(function (a, b) { return a + b.amount; }, 0);
      parts.push('<span>' + lost.length + (lost.length === 1 ? ' bet' : ' bets') + ' lost ' + money(total) + '</span>');
    }
    if (res.staked) {
      parts.push('<span class="tot' + (res.net < 0 ? ' down' : '') + '">'
        + (res.net >= 0 ? 'Up ' : 'Down ') + money(Math.abs(res.net)) + ' on the spin</span>');
    }
    l.innerHTML = parts.join('');
  }
  function labelFor(x) {
    if (x.key.indexOf('s:') === 0) return 'Straight ' + x.nums[0];
    if (x.key.indexOf('p:') === 0) return 'Split ' + x.nums.join('/');
    if (x.key.indexOf('t:') === 0) return (x.label === 'Trio' ? 'Trio ' : 'Street ') + x.nums.join('/');
    if (x.key.indexOf('c:') === 0) return 'Corner ' + x.nums.join('/');
    if (x.key.indexOf('l:') === 0) return 'Six line ' + x.nums[0] + '-' + x.nums[5];
    return x.label;
  }
  function render() {
    $('bank').textContent = money(bank());
    $('atstake').textContent = money(R.staked(G));
    $('spin').disabled = spinning || R.staked(G) === 0;
    $('clear').disabled = spinning || R.staked(G) === 0;
    $('repeat').disabled = spinning || !lastBets;
    $('double').disabled = spinning || R.staked(G) === 0;
    document.querySelectorAll('.mode').forEach(function (b) {
      b.classList.toggle('on', b.dataset.mode === S.mode);
      b.setAttribute('aria-selected', b.dataset.mode === S.mode);
    });
    var e = S.mode === 'euro' ? 1 / 37 : 2 / 38;
    $('edge').textContent = (e * 100).toFixed(2) + '%';
    $('edgeBar').style.width = (e * 100 / 8 * 100).toFixed(0) + '%';
    $('subline').textContent = (S.mode === 'euro' ? 'Single zero · 37 pockets' : 'Zero and double zero · 38 pockets')
      + ' · straight up pays 35 to 1';
    document.querySelector('.cloth').classList.toggle('spinning', spinning);
    paintChips();
    renderHistory();
  }

  /* ---------------- betting ---------------- */
  function lay(key, takeOff) {
    if (spinning) { toast('No more bets'); return; }
    if (takeOff) {
      var r = R.remove(G, key, S.chip);
      if (r.removed) {
        C.addBank(r.removed);
        if (!C.play('handle', 0, 0.6)) C.play('lay', 0, 0.5);
      }
      render();
      return;
    }
    var want = Math.min(S.chip, bank());
    if (want <= 0) { toast('Out of chips'); return; }
    var a = R.place(G, key, want, bank());
    if (!a.added) {
      toast(a.reason === 'limit' ? 'That bet is at the table limit' : 'Not enough left');
      return;
    }
    C.addBank(-a.added);
    if (a.added < S.chip) toast('Put down your last ' + money(a.added));
    C.play('lay', 0, 0.7);
    $('headline').textContent = 'Bets down · spin when ready';
    render();
  }

  function clearAll() {
    if (spinning) return;
    var back = R.clear(G);
    if (back) { C.addBank(back); C.play('handle', 0, 0.7); toast('Took down ' + money(back)); }
    render();
  }
  function repeatBets() {
    if (spinning || !lastBets) return;
    var want = 0, k;
    for (k in lastBets) want += lastBets[k];
    if (want > bank()) { toast('Not enough for the same bets'); return; }
    for (k in lastBets) {
      var a = R.place(G, k, lastBets[k], bank());
      C.addBank(-a.added);
    }
    C.play('lay', 0, 0.7);
    render();
  }
  function doubleUp() {
    if (spinning) return;
    var k, want = R.staked(G);
    if (want > bank()) { toast('Not enough to double'); return; }
    var keys = Object.keys(G.bets);
    for (var i = 0; i < keys.length; i++) {
      k = keys[i];
      var a = R.place(G, k, G.bets[k], bank());
      C.addBank(-a.added);
    }
    C.play('stack', 0, 0.8);
    render();
  }

  /* ---------------- the spin ---------------- */
  function doSpin() {
    if (spinning || !R.staked(G)) return;
    lastBets = JSON.parse(JSON.stringify(G.bets));
    var out = R.spin(G);
    spinning = true;
    $('headline').textContent = 'No more bets';
    $('ledger').innerHTML = '';
    render();
    C.play('shake', 0, 0.4);

    var T = 5.4, t0 = performance.now() / 1000;
    var w0 = wheelAngle, b0 = ballAngle;
    var wTurns = 2.3 * 360;
    var wEnd = w0 + wTurns;
    /* the ball must come to rest on the chosen pocket, wherever the wheel has
       got to by then, so the distance it travels is solved for, not guessed */
    var target = wEnd + pocketDeg(out.idx);
    var drop = b0 - target;
    var turns = 7 * 360;
    var B = drop + Math.ceil((turns - drop) / 360) * 360;

    function step(now) {
      var u = Math.min(1, (now / 1000 - t0) / T);
      wheelAngle = w0 + wTurns * (1 - Math.pow(1 - u, 1.5));
      ballAngle = b0 - B * (1 - Math.pow(1 - u, 2.3));
      var fall = u < 0.58 ? 0 : (u - 0.58) / 0.42;
      ballR = 176 - 48 * (fall * fall * (3 - 2 * fall));
      if (u > 0.74 && u < 0.97) ballR += Math.abs(Math.sin((u - 0.74) * 38)) * 7 * (1 - (u - 0.74) / 0.23);
      spinWheelTo(wheelAngle);
      placeBall();
      if (u < 1) { anim = requestAnimationFrame(step); return; }
      anim = null;
      /* park the ball in the pocket and keep the wheel turning gently after */
      ballAngle = target;
      ballR = 128 + 24;
      placeBall();
      land(out);
    }
    anim = requestAnimationFrame(step);
  }

  function land(out) {
    var res = R.settle(G, out);
    spinning = false;
    C.addBank(res.returned);
    G.bets = {};
    S.last = { n: res.n, colour: res.colour };
    save();
    renderCalled(res);
    glowWin(res.n);
    renderLedger(res);
    C.play('collide', 0, 0.5);
    if (res.net > 0) {
      C.play('stack', 0.25, 0.9);
      C.resultBanner(document.querySelector('.felt'), 'win', res.net);
      $('headline').textContent = res.n + ' · ' + money(res.net) + ' good';
    } else if (res.net === 0 && res.staked) {
      $('headline').textContent = res.n + ' · all square';
    } else {
      $('headline').textContent = res.n + ' · the house takes it';
    }
    C.say(String(res.n) + ' ' + res.colour);
    render();
    idleSpin();
  }

  /* the wheel never quite stops between spins, which is how a real one looks */
  var idle = null;
  function idleSpin() {
    if (idle) cancelAnimationFrame(idle);
    var last = performance.now();
    function step(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!spinning) {
        wheelAngle += dt * 9;
        spinWheelTo(wheelAngle);
        ballAngle += dt * 9;
        placeBall();
      }
      idle = requestAnimationFrame(step);
    }
    idle = requestAnimationFrame(step);
  }

  /* ---------------- wiring ---------------- */
  function keyFrom(e) {
    var t = e.target.closest('[data-key]');
    return t ? t.dataset.key : null;
  }
  var holdTimer = null;
  function wireCloth() {
    var svg = $('cloth');
    svg.addEventListener('click', function (e) {
      var k = keyFrom(e);
      if (k) lay(k, false);
    });
    svg.addEventListener('contextmenu', function (e) {
      var k = keyFrom(e);
      if (!k) return;
      e.preventDefault();
      lay(k, true);
    });
    /* long press takes a chip off on a touchscreen */
    svg.addEventListener('touchstart', function (e) {
      var k = keyFrom(e);
      if (!k) return;
      holdTimer = setTimeout(function () { holdTimer = null; lay(k, true); }, 520);
    }, { passive: true });
    ['touchend', 'touchmove', 'touchcancel'].forEach(function (ev) {
      svg.addEventListener(ev, function () { clearTimeout(holdTimer); }, { passive: true });
    });
  }

  function setMode(m) {
    if (spinning || m === S.mode) return;
    var back = R.clear(G);
    if (back) C.addBank(back);
    S.mode = m;
    save();
    G = R.newGame(m);
    lastBets = null;
    buildWheel();
    buildCloth();
    renderCalled(null);
    renderLedger(null);
    $('headline').textContent = 'Place your bets';
    render();
  }

  function rules() {
    var t = R.table(S.mode);
    var rows = [
      ['Straight up', '1 number', '35 to 1'],
      ['Split', '2 numbers', '17 to 1'],
      ['Street', '3 numbers', '11 to 1'],
      ['Corner', '4 numbers', '8 to 1'],
      ['Six line', '6 numbers', '5 to 1'],
      ['Column or dozen', '12 numbers', '2 to 1'],
      ['Red, black, odd, even, high, low', '18 numbers', 'even money']
    ];
    if (S.mode === 'american') rows.splice(5, 0, ['Top line', '0, 00, 1, 2, 3', '6 to 1']);
    else rows.splice(4, 0, ['First four', '0, 1, 2, 3', '8 to 1']);
    $('rules').innerHTML = '<summary>How it pays</summary><div class="rulebody"><table>'
      + rows.map(function (r) {
        return '<tr><th>' + r[0] + '</th><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>';
      }).join('')
      + '</table><p>' + (S.mode === 'euro'
        ? 'One green pocket in thirty-seven, so the house keeps 2.70% of everything staked, whatever you bet on.'
        : 'Two green pockets in thirty-eight, so the house keeps 5.26% &mdash; and 7.89% of anything on the top line, the one bet on the cloth that pays short.')
      + '</p></div>';
  }

  /* ---------------- boot ---------------- */
  C.setHTML($('nav'), C.nav('roulette'));
  (function bindChips() {
    C.renderChips($('chips'), S.chip, function (c) {
      S.chip = c; save(); bindChips(); C.play('lay', 0, 0.45);
    });
  })();

  buildWheel();
  buildCloth();
  wireCloth();
  renderCalled(null);
  renderHistory();
  rules();
  render();
  idleSpin();

  $('spin').addEventListener('click', doSpin);
  $('clear').addEventListener('click', clearAll);
  $('repeat').addEventListener('click', repeatBets);
  $('double').addEventListener('click', doubleUp);
  document.querySelectorAll('.mode').forEach(function (b) {
    b.addEventListener('click', function () { setMode(b.dataset.mode); rules(); });
  });
  $('sound').addEventListener('click', function () {
    var s = C.load();
    if (s.sound && s.voice !== false) s.voice = false;
    else if (s.sound) { s.sound = false; if (window.speechSynthesis) speechSynthesis.cancel(); }
    else { s.sound = true; s.voice = true; }
    C.save();
    $('sound').textContent = 'Audio: ' + (s.sound ? (s.voice === false ? 'Effects' : 'All') : 'Off');
  });
  (function () {
    var s = C.load();
    $('sound').textContent = 'Audio: ' + (s.sound ? (s.voice === false ? 'Effects' : 'All') : 'Off');
  })();

  addEventListener('keydown', function (e) {
    if (e.target.matches('input,textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); doSpin(); }
    else if (e.key === 'r' || e.key === 'R') repeatBets();
    else if (e.key === 'c' || e.key === 'C') clearAll();
    else if (e.key === 'b' || e.key === 'B') openReset();
  });

  /* ---------------- bankroll dialog ---------------- */
  function openReset() {
    var d = $('resetDlg');
    $('resetErr').textContent = '';
    $('resetAmt').value = (bank() / 100).toLocaleString('en-US');
    if (d.showModal) d.showModal();
  }
  $('reset').addEventListener('click', openReset);
  $('bankBtn').addEventListener('click', openReset);
  $('resetCancel').addEventListener('click', function () { $('resetDlg').close(); });
  $('resetPresets').addEventListener('click', function (e) {
    var b = e.target.closest('[data-amt]');
    if (b) $('resetAmt').value = (+b.dataset.amt).toLocaleString('en-US');
  });
  $('resetForm').addEventListener('submit', function () {
    var v = parseFloat(String($('resetAmt').value).replace(/[^0-9.]/g, ''));
    if (!isFinite(v) || v <= 0) { $('resetErr').textContent = 'Enter an amount.'; return; }
    R.clear(G);
    C.setBank(Math.round(v * 100));
    lastBets = null;
    renderLedger(null);
    render();
  });

  addEventListener('resize', function () { paintChips(); });

  /* a window onto the table for the test harness; the page never reads it */
  window.ROULETTE = {
    bets: function () { return G.bets; },
    staked: function () { return R.staked(G); },
    last: function () { return G.last; },
    busy: function () { return spinning; },
    mode: function () { return S.mode; },
    lay: lay, spin: doSpin
  };
})();
