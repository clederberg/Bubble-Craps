/* Sukkah Nights: the machine. The rules are in sukkah.js; this spins the
   reels, puts the street up night by night, turns the wheel and walks the
   guests through at the end. Nothing here decides anything, it only shows
   what the engine already settled. */
(function (root) {
  'use strict';
  var C = root.Casino, K = root.Sukkah;
  var SYM = ['sukkah', 'ushpizin', 'feast', 'grape', 'fig', 'date', 'pomegranate', 'olive', 'barley', 'wheat'];
  var ALL = SYM.concat([K.WILD, K.BUILD, K.SAW, K.GOLD]);
  var JPNAME = { chai: 'Chai', simcha: 'Simcha', hoshana: 'Hoshana', shalom: 'Shalom' };
  var MODE = {
    frames: ['Ushpizin Nights', 'Six nights to build the street'],
    etrog: ['Etrog Nights', 'The etrogim stay out and keep laying frames'],
    mega: ['Mega Lulav', 'One frond puts up a whole block'],
    schach: ['Schach Nights', 'Every etrog is a finished sukkah already']
  };

  function $(id) { return document.getElementById(id); }
  var timers = [];
  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function reduced() {
    return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ---------------- state ---------------- */
  var St = C.game('sukkot', { chip: 500, jp: null });
  if (!St.jp) { St.jp = {}; K.JP.forEach(function (t) { St.jp[t] = K.SEED[t]; }); C.save(); }
  var busy = false, lastGrid = null;

  function totalBet() { return St.chip * 5; }
  function art(key) { return '<svg viewBox="0 0 64 64"><use href="#s-' + key + '"/></svg>'; }

  /* ---------------- the reels ---------------- */
  function buildReels() {
    var h = '';
    for (var r = 0; r < 5; r++) {
      h += '<div class="reel" id="r' + r + '"><div class="strip" id="s' + r + '"></div></div>';
    }
    C.setHTML($('reels'), h);
  }
  function showGrid(grid) {
    lastGrid = grid;
    for (var r = 0; r < 5; r++) {
      var h = '';
      for (var y = 0; y < 3; y++) h += cell(grid[r][y]);
      C.setHTML($('s' + r), h);
    }
  }
  function cell(sym, extra) {
    return '<div class="cell' + (extra ? ' ' + extra : '') + '" data-sym="' + sym + '">' + art(sym) + '</div>';
  }
  function randomSym() { return ALL[Math.floor(Math.random() * ALL.length)]; }

  /* A reel spins by running a tall strip of filler past the window and landing
     on the three the engine picked. */
  function spinReel(i, final, dur, done) {
    var strip = $('s' + i), reel = $('r' + i);
    var pad = reduced() ? 3 : 14, h = '';
    for (var k = 0; k < pad; k++) h += cell(randomSym());
    for (var y = 0; y < 3; y++) h += cell(final[y]);
    C.setHTML(strip, h);
    var cellH = reel.clientHeight / 3;
    reel.classList.add('blur');
    strip.style.transition = 'none';
    strip.style.transform = 'translateY(' + (-pad * cellH) + 'px)';
    /* let the browser take the start position before the run begins */
    strip.offsetHeight;
    strip.style.transition = 'transform ' + dur + 'ms cubic-bezier(.16,.62,.2,1)';
    strip.style.transform = 'translateY(0)';
    later(function () {
      reel.classList.remove('blur');
      strip.style.transition = 'none';
      var hh = '';
      for (var y = 0; y < 3; y++) hh += cell(final[y]);
      C.setHTML(strip, hh);
      strip.style.transform = 'translateY(0)';
      C.play('handle', 0, 0.22, 1.4);
      if (done) done();
    }, dur + 40);
  }
  function spinReels(grid, done) {
    var left = 5;
    for (var i = 0; i < 5; i++) {
      (function (i) {
        var dur = (reduced() ? 180 : 620) + i * (reduced() ? 40 : 190);
        spinReel(i, grid[i], dur, function () { if (--left === 0 && done) done(); });
      })(i);
    }
  }

  /* ---------------- the meters ---------------- */
  function paintMeters(lit) {
    var h = K.JP.map(function (t) {
      return '<div class="meter m-' + t + (lit === t ? ' lit' : '') + '"><small>' + JPNAME[t] + '</small>'
        + '<b>' + C.money(Math.round(St.jp[t] * totalBet())) + '</b></div>';
    }).join('');
    C.setHTML($('meters'), h);
  }
  function bumpMeters() {
    /* the two that climb do so out of the hold, a little every spin */
    St.jp.hoshana += 0.03;
    St.jp.shalom += 0.12;
    C.save();
  }
  function resetMeter(tier) { St.jp[tier] = K.SEED[tier]; C.save(); }

  /* ---------------- the night board ---------------- */
  function boardEl(title, sub, rows, inner) {
    var o = document.createElement('div');
    o.className = 'board';
    o.id = 'ov';
    o.innerHTML = '<div class="boardin"><h2></h2><p class="sub"></p>'
      + '<div class="street" id="street"></div>'
      + '<div class="nights" id="nightline"></div>'
      + '<div class="tally" id="tally"></div>'
      + (inner || '') + '</div>';
    document.body.appendChild(o);
    C.setText(o.querySelector('h2'), title);
    C.setText(o.querySelector('.sub'), sub);
    var st = $('street');
    st.style.gridTemplateColumns = 'repeat(5, 1fr)';
    st.style.maxWidth = rows > 3 ? '560px' : '460px';
    return o;
  }
  function closeBoard() { var o = $('ov'); if (o) o.remove(); }

  /* the street as it stands: one plot a square, drawn at whatever stage it
     has reached */
  function paintStreet(board, rows, popAt) {
    var st = $('street');
    if (!st) return;
    var h = '';
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < 5; x++) {
        var i = x * rows + y, v = board[i];
        var pop = popAt && popAt.indexOf(i) >= 0 ? ' up' : '';
        h += '<div class="plot' + pop + '" id="p' + i + '">'
          + (v ? art(K.TIER_NAME[v]) : '') + '</div>';
      }
    }
    C.forceHTML(st, h);
  }
  function nightLine(n, of) {
    C.setHTML($('nightline'), 'Night <b>' + n + '</b> of <b>' + of + '</b>');
  }

  /* run the build back, a night at a time */
  function playBuild(round, rows, after) {
    var step = 0, pace = reduced() ? 90 : 620;
    paintStreet(round.log[0].board, rows, null);
    nightLine(0, round.nights);
    function next() {
      step++;
      if (step >= round.log.length) { later(after, pace / 2); return; }
      var L = round.log[step];
      paintStreet(L.board, rows, L.hits || []);
      nightLine(L.night, L.nights);
      if (L.landed) C.play('place', 0, 0.5, 1 + Math.min(L.landed, 4) * 0.06);
      if (L.landed >= 3) C.toast('Another night');
      later(next, pace);
    }
    later(next, pace);
  }

  /* and then the guests come through, frames first */
  function playGuests(guests, rows, after) {
    var wave = 0, total = 0, pace = reduced() ? 120 : 760;
    C.setHTML($('tally'), '');
    function next() {
      if (wave >= guests.waves.length) {
        if (guests.full) {
          C.toast('The whole street finished');
          C.play('stack', 0, 1);
        }
        C.setHTML($('tally'), C.money(guests.total));
        later(after, 1200);
        return;
      }
      var w = guests.waves[wave++];
      w.cells.forEach(function (c, k) {
        later(function () {
          var el = $('p' + c.at);
          if (!el) return;
          el.classList.add('paid');
          var v = c.value;
          var label = v.jackpot ? JPNAME[v.jackpot] : C.money(v.amount);
          el.insertAdjacentHTML('beforeend',
            '<span class="val' + (v.jackpot ? ' jp' : '') + '">' + C.esc(label) + '</span>');
          total += v.amount;
          C.setHTML($('tally'), C.money(total));
          C.play(v.jackpot ? 'stack' : 'lay', 0, v.jackpot ? 0.9 : 0.45, 1 + k * 0.03);
        }, k * (reduced() ? 30 : 110));
      });
      later(next, pace + w.cells.length * (reduced() ? 30 : 110));
    }
    later(next, pace / 2);
  }

  /* ---------------- the wheel ---------------- */
  /* The face is cut by weight, not into equal slices, so a segment is as wide
     on the wheel as it is likely on the spin. The Shalom really is a hairline
     of gold, which is the honest way to draw a one in a thousand. */
  function arcs(segs) {
    var MIN = 1.3, total = 0, i;
    for (i = 0; i < segs.length; i++) total += segs[i].w;
    /* give the slivers a visible width and take it back off the rest */
    var spans = segs.map(function (s) { return Math.max(MIN, s.w / total * 360); });
    var sum = spans.reduce(function (a, b) { return a + b; }, 0);
    var over = sum - 360;
    if (over > 0) {
      var big = spans.reduce(function (a, v) { return v > MIN ? a + v : a; }, 0);
      spans = spans.map(function (v) { return v > MIN ? v - over * (v / big) : v; });
    }
    var out = [], at = -90;
    spans.forEach(function (sp, k) { out.push({ a0: at, a1: at + sp, span: sp, seg: segs[k] }); at += sp; });
    return out;
  }
  function wheelSVG(segs, id) {
    var R = 100, p = '';
    arcs(segs).forEach(function (a) {
      var rad = Math.PI / 180;
      var x0 = 100 + R * Math.cos(a.a0 * rad), y0 = 100 + R * Math.sin(a.a0 * rad);
      var x1 = 100 + R * Math.cos(a.a1 * rad), y1 = 100 + R * Math.sin(a.a1 * rad);
      var big = a.span > 180 ? 1 : 0;
      var seg = a.seg;
      var fill = seg.jackpot ? '#f0c460' : seg.mode ? '#3f7d4a' : '#1b2d4a';
      p += '<path d="M100 100 L' + x0.toFixed(2) + ' ' + y0.toFixed(2)
        + ' A100 100 0 ' + big + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' Z" fill="' + fill
        + '" stroke="#0a1220" stroke-width="0.9"/>';
      if (a.span < 13) return;                       /* no room to letter it */
      var mid = (a.a0 + a.a1) / 2;
      var tx = 100 + 64 * Math.cos(mid * rad), ty = 100 + 64 * Math.sin(mid * rad);
      var size = a.span > 30 ? 8.5 : 6.6;
      p += '<text x="' + tx.toFixed(1) + '" y="' + ty.toFixed(1) + '" fill="'
        + (seg.jackpot ? '#2a1205' : '#fff3dc') + '" font-size="' + size + '" font-family="Oswald, sans-serif"'
        + ' text-anchor="middle" dominant-baseline="central" transform="rotate('
        + (mid + 90).toFixed(1) + ' ' + tx.toFixed(1) + ' ' + ty.toFixed(1) + ')">'
        + C.esc(seg.label) + '</text>';
    });
    return '<g class="wheel-face ' + id + '" id="face-' + id + '" style="transform-origin:100px 100px">'
      + p + '</g>';
  }
  function showWheel(pair, segsA, segsB) {
    var h = '<svg viewBox="0 0 ' + (pair ? 420 : 220) + ' 220" class="' + (pair ? 'pair' : '') + '">';
    h += '<g transform="translate(10,10)">' + wheelSVG(segsA, 'a')
      + '<circle cx="100" cy="100" r="16" fill="#0a1220" stroke="#f0c460" stroke-width="2"/>'
      + '<path d="M100 -4 L94 12 L106 12 Z" fill="#f0c460"/></g>';
    if (pair) {
      h += '<g transform="translate(210,10)">' + wheelSVG(segsB, 'b')
        + '<circle cx="100" cy="100" r="16" fill="#0a1220" stroke="#dbe04f" stroke-width="2"/>'
        + '<path d="M100 -4 L94 12 L106 12 Z" fill="#dbe04f"/></g>';
    }
    h += '</svg>';
    return h;
  }
  /* land the chosen segment under the pointer at the top */
  function landOn(id, segs, label, turns) {
    var list = arcs(segs), hit = list[0];
    for (var k = 0; k < list.length; k++) if (list[k].seg.label === label) { hit = list[k]; break; }
    /* bring the middle of that arc round to the pointer at the top */
    var mid = (hit.a0 + hit.a1) / 2;
    var target = turns * 360 - (mid + 90);
    var el = $('face-' + id);
    if (el) el.style.transform = 'rotate(' + target + 'deg)';
  }

  function playWheel(res, after) {
    var pair = res.superMode;
    var segsA = K.WHEEL, segsB = K.SUPER_WHEEL;
    var o = document.createElement('div');
    o.className = 'board';
    o.id = 'ov';
    o.innerHTML = '<div class="boardin"><h2></h2><p class="sub"></p>'
      + '<div class="wheelwrap">' + showWheel(pair, segsA, segsB) + '</div>'
      + '<div class="tally" id="tally"></div></div>';
    document.body.appendChild(o);
    C.setText(o.querySelector('h2'), pair ? 'The pitom etrog' : 'The wheel');
    C.setText(o.querySelector('.sub'), pair ? 'Both wheels turn' : 'Three etrogim');
    C.play('shuffle', 0, 0.6);
    later(function () {
      /* the plain wheel decides it; on the pair, the second is the one that
         carries the result and the first keeps turning behind it */
      landOn('a', segsA, pair ? segsA[0].label : res.label, 4);
      if (pair) landOn('b', segsB, res.label, 5);
      later(function () {
        C.setHTML($('tally'), C.esc(res.label));
        later(after, 900);
      }, pair ? 5300 : 4700);
    }, 80);
  }

  /* ---------------- a spin ---------------- */
  function settleJackpots(list) {
    list.forEach(function (j) {
      C.toast(JPNAME[j.tier] + '  ' + C.money(j.amount));
      paintMeters(j.tier);
      if (j.tier === 'hoshana' || j.tier === 'shalom') resetMeter(j.tier);
    });
  }

  function spin() {
    if (busy) return;
    var bet = totalBet();
    if (bet > C.bank()) { C.toast('Not enough in the bankroll'); return; }
    busy = true;
    clearTimers();
    closeBoard();
    C.addBank(-bet);
    bumpMeters();
    paintMeters();
    paint();
    C.setText($('status'), '');
    C.play('handle', 0, 0.7);

    var res = K.play({ totalBet: bet, meters: St.jp });
    spinReels(res.grid, function () {
      markFeatures(res);
      if (res.wheel) {
        later(function () { runWheel(res); }, 400);
      } else if (res.build) {
        later(function () { runBuild(res); }, 400);
      } else {
        finish(res);
      }
    });
  }

  function markFeatures(res) {
    var cells = $('reels').querySelectorAll('.cell');
    [].forEach.call(cells, function (el) {
      var s = el.getAttribute('data-sym');
      if (s === K.BUILD) el.classList.add('feat');
      if (s === K.SAW) el.classList.add('feat');
      if (s === K.GOLD) el.classList.add('gold');
    });
    if (res.ways.length) {
      /* light the reels a way ran across, which is as close as a ways game
         gets to drawing a payline */
      res.ways.forEach(function (w) {
        for (var r = 0; r < w.count; r++) {
          for (var y = 0; y < 3; y++) {
            var el = $('s' + r).children[y];
            if (!el) continue;
            var s = el.getAttribute('data-sym');
            if (s === w.sym || s === K.WILD) el.classList.add('win');
          }
        }
      });
    }
  }

  function runWheel(res) {
    playWheel(res.wheel, function () {
      closeBoard();
      if (!res.wheel.build) { finish(res); return; }
      var m = MODE[res.wheel.mode] || ['Sukkah Nights', ''];
      var rows = res.wheel.guests.rows;
      boardEl((res.wheel.superMode ? 'Super ' : '') + m[0], m[1], rows);
      playBuild(res.wheel.build, rows, function () {
        playGuests(res.wheel.guests, rows, function () { closeBoard(); finish(res); });
      });
    });
  }
  function runBuild(res) {
    boardEl('Ushpizin Nights', 'Six lulavim, six nights', 3);
    playBuild(res.build.round, 3, function () {
      playGuests(res.build.guests, 3, function () { closeBoard(); finish(res); });
    });
  }

  function finish(res) {
    C.addBank(res.total);
    St.lastWin = res.total;
    C.save();
    settleJackpots(res.jackpots);
    var msg;
    if (res.total <= 0) msg = 'No win';
    else if (res.wheel || res.build) msg = '<span class="hit">' + C.esc(C.money(res.total)) + '</span> for the night';
    else msg = '<span class="hit">' + C.esc(C.money(res.total)) + '</span>';
    C.setHTML($('status'), msg);
    if (res.total > 0) C.play(res.total > totalBet() * 10 ? 'stack' : 'lay', 0, 0.7);
    busy = false;
    paint();
  }

  /* ---------------- chrome ---------------- */
  function paint() {
    C.setText($('bank'), C.money(C.bank()));
    C.setText($('bet'), C.money(totalBet()));
    C.setText($('win'), C.money(St.lastWin || 0));
    paintMeters();
  }
  function rules() {
    var d = $('rules');
    if (!d) return;
    var rowsFor = function (t) {
      return K.SYMS.map(function (s) {
        return '<tr><td>' + s + '</td><td>' + K.PAYS[s][3] + '</td><td>' + K.PAYS[s][4]
          + '</td><td>' + K.PAYS[s][5] + '</td></tr>';
      }).join('');
    };
    C.setHTML(d, '<summary>How it pays</summary>'
      + '<p>Five reels, 243 ways. A symbol pays when it is on reel one and every reel after it, '
      + 'as many times over as there are ways to pick one from each. The wind stands in for anything '
      + 'but the lulav, the etrog and the pitom.</p>'
      + '<p><b>Six lulavim</b> build. Each one puts up a frame, adds walls to a frame, or lays the schach '
      + 'on a walled one. You get six nights, and three lulavim in a night buys another. On the last '
      + 'night the ushpizin come through and pay out what is in each sukkah, frames first and finished '
      + 'ones last. A street where every sukkah is roofed pays the Shalom.</p>'
      + '<p><b>Three etrogim</b> spin the wheel, which either pays outright or picks the kind of night '
      + 'you are about to have. The <b>pitom etrog</b>, the one with its crown tip unbroken, turns it '
      + 'into both wheels and opens the sukkah from three rows to six.</p>'
      + '<table class="pay"><tr><th>Symbol</th><th>3</th><th>4</th><th>5</th></tr>' + rowsFor() + '</table>'
      + '<p class="note">Pays are multiples of a twenty-fifth of the total bet, times the ways. '
      + 'Everything in a night is a multiple of the whole bet. Play money only.</p>');
  }

  function boot() {
    C.setHTML($('nav'), C.nav('sukkah'));
    buildReels();
    var g = [];
    for (var r = 0; r < 5; r++) {
      var colm = [];
      for (var y = 0; y < 3; y++) colm.push(SYM[Math.floor(Math.random() * SYM.length)]);
      g.push(colm);
    }
    showGrid(g);
    C.renderChips($('chips'), St.chip, function (c) {
      St.chip = c; C.save();
      C.renderChips($('chips'), St.chip, arguments.callee);
      paint();
    });
    paint();
    rules();
    $('spin').addEventListener('click', spin);
    addEventListener('keydown', function (e) {
      if (e.code === 'Space' && !/input|textarea/i.test((e.target.tagName || ''))) {
        e.preventDefault(); spin();
      }
    });
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
  else boot();
})(this);
