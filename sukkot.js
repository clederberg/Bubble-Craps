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

  /* A reel runs a tall strip of filler past the window and lands on the three
     the engine picked. It overshoots by a fraction of a cell and settles back,
     which is the whole difference between a reel stopping and a reel being
     switched off. */
  function cellHeight() {
    var probe = $('s0') && $('s0').firstChild;
    return probe ? probe.getBoundingClientRect().height : 84;
  }
  function spinReel(i, final, dur, done) {
    var strip = $('s' + i), reel = $('r' + i);
    if (reduced()) {
      C.setHTML(strip, final.map(function (sy) { return cell(sy, 'drop'); }).join(''));
      strip.style.transform = 'translateY(0)';
      later(function () { if (done) done(); }, 60);
      return;
    }
    var pad = 16 + i * 3, h = '', k, y;
    for (k = 0; k < pad; k++) h += cell(randomSym());
    for (y = 0; y < 3; y++) h += cell(final[y]);
    C.setHTML(strip, h);
    var cellH = cellHeight();
    strip.style.transition = 'none';
    strip.style.transform = 'translateY(' + (-pad * cellH) + 'px)';
    strip.offsetHeight;                               /* take the start pose */
    /* out past the stop and back: the band of a real reel settling */
    var over = Math.round(cellH * 0.16);
    strip.style.transition = 'transform ' + dur + 'ms cubic-bezier(.2,.56,.24,1)';
    strip.style.transform = 'translateY(' + over + 'px)';
    later(function () {
      strip.style.transition = 'transform 190ms cubic-bezier(.3,1.5,.5,1)';
      strip.style.transform = 'translateY(0)';
      C.play('handle', 0, 0.2, 1.5 + i * 0.05);
    }, dur);
    later(function () {
      strip.style.transition = 'none';
      var hh = '';
      for (var y2 = 0; y2 < 3; y2++) hh += cell(final[y2], 'drop');
      C.setHTML(strip, hh);
      strip.style.transform = 'translateY(0)';
      if (done) done();
    }, dur + 200);
  }
  /* All five start together and stop left to right. If what has already come
     down could still turn into a feature, the reel that would settle it is
     held back and lit, which is the part of a slot machine that makes you
     lean in. The grid is known before the first one moves, so the hold is
     worked out up front rather than chased frame by frame. */
  function spinReels(grid, done) {
    var dur = [], hold = [], i, x, y;
    for (i = 0; i < 5; i++) {
      dur.push(reduced() ? 60 + i * 30 : 700 + i * 250);
      hold.push(false);
    }
    if (!reduced()) {
      var extra = 0;
      for (i = 2; i < 5; i++) {
        var hats = 0, saws = 0;
        for (x = 0; x < i; x++) {
          for (y = 0; y < 3; y++) {
            if (grid[x][y] === K.BUILD) hats++;
            else if (grid[x][y] === K.SAW || grid[x][y] === K.GOLD) saws++;
          }
        }
        /* two etrogim down with reels to come, or four lulavim: still live */
        var live = (saws >= 2 && saws + (5 - i) >= K.SAW_TRIGGER)
          || (hats >= 4 && hats + (5 - i) * 3 >= K.BUILD_TRIGGER);
        if (live) { hold[i] = true; extra += 1250; }
        dur[i] += extra;
      }
    }
    var left = 5;
    for (i = 0; i < 5; i++) {
      (function (i) {
        var reel = $('r' + i);
        if (hold[i] && reel) {
          /* light it only once the reel before it has actually stopped */
          later(function () {
            if (reel) reel.classList.add('anticip');
            C.play('shuffle', 0, 0.35, 1.7);
          }, dur[i - 1] + 220);
        }
        spinReel(i, grid[i], dur[i], function () {
          if (reel) reel.classList.remove('anticip');
          if (--left === 0 && done) done();
        });
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
        h += '<div class="plot' + (v ? ' t' + v : '') + pop + '" id="p' + i + '">'
          + (v ? art(K.TIER_NAME[v]) : '') + '</div>';
      }
    }
    C.forceHTML(st, h);
  }
  function nightLine(n, of, base) {
    var pips = '';
    for (var k = 1; k <= of; k++) {
      pips += '<i class="' + (k <= n ? 'on' : '') + (k > (base || 6) ? ' extra' : '') + '"></i>';
    }
    C.setHTML($('nightline'), 'Night <b>' + n + '</b> of <b>' + of
      + '</b><span class="pips">' + pips + '</span>');
  }

  /* run the build back, a night at a time */
  function playBuild(round, rows, after) {
    var step = 0, pace = reduced() ? 90 : 620;
    paintStreet(round.log[0].board, rows, null);
    nightLine(0, round.nights, 6);
    function next() {
      step++;
      if (step >= round.log.length) { later(after, pace / 2); return; }
      var L = round.log[step];
      paintStreet(L.board, rows, L.hits || []);
      nightLine(L.night, L.nights, 6);
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
        countTo($('tally'), guests.total, 700, C.money);
        later(after, 1400);
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
          if (v.jackpot) el.classList.add('jackpot');
          el.insertAdjacentHTML('beforeend',
            '<span class="val' + (v.jackpot ? ' jp' : '') + '">' + C.esc(label) + '</span>');
          total += v.amount;
          countTo($('tally'), total, 260, C.money);
          C.play(v.jackpot ? 'stack' : 'lay', 0, v.jackpot ? 0.9 : 0.45, 1 + k * 0.03);
        }, k * (reduced() ? 30 : 110));
      });
      later(next, pace + w.cells.length * (reduced() ? 30 : 110));
    }
    later(next, pace / 2);
  }

  /* ---------------- the wheel ---------------- */
  /* ---------------- the wheel face ----------------
     Every segment is the same size, the way it is on a real wheel. A prize
     that is likelier simply appears on more of them, spread around the ring
     rather than bunched, so the face reads as a wheel and not as a pie chart.
     What it lands on is not decided by the face though: the engine draws the
     prize on its own schedule, and the pointer is sent to one of the segments
     carrying it. The counts below are only how the thing looks. */
  var FACE_N = 24;
  function faceFor(segs) {
    var total = 0, i;
    for (i = 0; i < segs.length; i++) total += segs[i].w;
    /* every prize gets at least one segment, the rest go by weight */
    var counts = segs.map(function (sg) {
      return Math.max(1, Math.round(sg.w / total * FACE_N));
    });
    var sum = counts.reduce(function (a, b) { return a + b; }, 0);
    /* trim or pad against the most common prize until it comes to FACE_N */
    while (sum !== FACE_N) {
      var at = 0, best = sum > FACE_N ? -1 : Infinity;
      for (i = 0; i < counts.length; i++) {
        if (sum > FACE_N ? counts[i] > best && counts[i] > 1 : counts[i] < best) { best = counts[i]; at = i; }
      }
      counts[at] += sum > FACE_N ? -1 : 1;
      sum += sum > FACE_N ? -1 : 1;
    }
    /* Lay them round the ring so that each prize's segments are as evenly
       spaced as they can be. Dealing a pass at a time puts everything with a
       single segment next to everything else with a single segment, which
       leaves the four jackpots sitting together in one gold block. */
    var face = new Array(FACE_N).fill(null);
    var order = segs.map(function (sg, k) { return k; }).sort(function (a, b) {
      return counts[b] - counts[a];
    });
    order.forEach(function (k, rank) {
      var n = counts[k], phase = rank * 0.37;        /* so they do not stack up */
      for (var j = 0; j < n; j++) {
        var want = Math.round((j + phase) * FACE_N / n) % FACE_N;
        /* the nearest free segment to where it wants to be */
        for (var d = 0; d < FACE_N; d++) {
          var at = (want + (d % 2 ? -(d + 1) / 2 | 0 : d / 2)) % FACE_N;
          if (at < 0) at += FACE_N;
          if (!face[at]) { face[at] = segs[k]; break; }
        }
      }
    });
    for (i = 0; i < FACE_N; i++) if (!face[i]) face[i] = segs[0];
    return face;
  }
  var FACES = {};
  function face(segs, key) {
    if (!FACES[key]) FACES[key] = faceFor(segs);
    return FACES[key];
  }

  /* the little picture that says which prize a segment is */
  var SEG_ICON = { frames: 'ushpizin', etrog: 'etrog', mega: 'lulav', schach: 'schach' };
  var SEG_SHORT = {
    'Ushpizin Nights': 'USHPIZIN', 'Etrog Nights': 'ETROG', 'Mega Lulav': 'MEGA LULAV',
    'Schach Nights': 'SCHACH', 'Super Ushpizin': 'USHPIZIN', 'Super Etrog': 'ETROG',
    'Super Mega Lulav': 'MEGA LULAV', 'Super Schach': 'SCHACH'
  };

  function wheelSVG(segs, id, key) {
    var list = face(segs, key), step = 360 / FACE_N, R = 100, rad = Math.PI / 180, p = '';
    list.forEach(function (seg, i) {
      var a0 = -90 + i * step, a1 = a0 + step, mid = a0 + step / 2;
      var x0 = 100 + R * Math.cos(a0 * rad), y0 = 100 + R * Math.sin(a0 * rad);
      var x1 = 100 + R * Math.cos(a1 * rad), y1 = 100 + R * Math.sin(a1 * rad);
      var fill = seg.jackpot ? (seg.jackpot === 'shalom' ? '#e8b63f' : '#f0c460')
        : seg.mode ? (i % 2 ? '#3f7d4a' : '#356b40') : '#1b2d4a';
      p += '<path d="M100 100 L' + x0.toFixed(2) + ' ' + y0.toFixed(2)
        + ' A100 100 0 0 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' Z" fill="' + fill
        + '" stroke="#0a1220" stroke-width="1"/>';
      var ink = seg.jackpot ? '#2a1205' : '#fff3dc';
      /* the name runs out along the radius, flipped on the left half so it is
         never upside down */
      var flip = mid > 90 || mid < -90;
      var tr = 44, tx = 100 + tr * Math.cos(mid * rad), ty = 100 + tr * Math.sin(mid * rad);
      var label = SEG_SHORT[seg.label] || seg.label;
      p += '<text x="' + tx.toFixed(1) + '" y="' + ty.toFixed(1) + '" fill="' + ink
        + '" font-size="6.4" font-family="Oswald, sans-serif" letter-spacing=".4"'
        + ' text-anchor="' + (flip ? 'end' : 'start') + '" dominant-baseline="central"'
        + ' transform="rotate(' + (flip ? mid + 180 : mid).toFixed(1) + ' '
        + tx.toFixed(1) + ' ' + ty.toFixed(1) + ')">' + C.esc(label) + '</text>';
      /* and the picture sits out by the rim */
      var icon = SEG_ICON[seg.mode];
      if (icon) {
        var ir = 82, ix = 100 + ir * Math.cos(mid * rad), iy = 100 + ir * Math.sin(mid * rad);
        p += '<use href="#s-' + icon + '" x="' + (ix - 7).toFixed(1) + '" y="' + (iy - 7).toFixed(1)
          + '" width="14" height="14" transform="rotate(' + (mid + 90).toFixed(1) + ' '
          + ix.toFixed(1) + ' ' + iy.toFixed(1) + ')"/>';
      } else if (seg.jackpot) {
        var jr = 84, jx = 100 + jr * Math.cos(mid * rad), jy = 100 + jr * Math.sin(mid * rad);
        p += '<circle cx="' + jx.toFixed(1) + '" cy="' + jy.toFixed(1) + '" r="5" fill="#2a1205" opacity=".3"/>';
      }
    });
    return '<g class="wheel-face ' + id + '" id="face-' + id + '" style="transform-origin:100px 100px">'
      + p + '</g>';
  }

  /* the furniture round the face: a brass rim, the lamps that chase while it
     turns, a hub and the pointer that gets knocked by every segment */
  function wheelFurniture(id, accent) {
    var h = '<circle cx="100" cy="100" r="104" fill="none" stroke="url(#wrim-' + id + ')" stroke-width="9"/>'
      + '<circle cx="100" cy="100" r="100" fill="none" stroke="#0a1220" stroke-width="1.5"/>';
    for (var i = 0; i < 24; i++) {
      var a = (i / 24) * Math.PI * 2 - Math.PI / 2;
      var x = 100 + 104 * Math.cos(a), y = 100 + 104 * Math.sin(a);
      h += '<circle class="lamp" style="animation-delay:' + (i * 0.042).toFixed(2) + 's" cx="'
        + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.6" fill="#ffe3ac"/>';
    }
    h += '<circle cx="100" cy="100" r="19" fill="#0a1220" stroke="' + accent + '" stroke-width="2.5"/>'
      + '<circle cx="100" cy="100" r="7" fill="' + accent + '" opacity=".8"/>'
      + '<g class="ptr" id="ptr-' + id + '">'
      + '<path d="M100 -2 L91 16 L109 16 Z" fill="' + accent + '" stroke="#0a1220" stroke-width="1.4"/>'
      + '</g>';
    return h;
  }
  function showWheel(pair, segsA, segsB) {
    var defs = ['a', 'b'].map(function (id) {
      return '<linearGradient id="wrim-' + id + '" x1="0" y1="0" x2="0" y2="1">'
        + '<stop offset="0" stop-color="#fff3c8"/><stop offset=".5" stop-color="#b8832c"/>'
        + '<stop offset="1" stop-color="#6b4a12"/></linearGradient>';
    }).join('');
    var one = function (id, segs, key, accent) {
      return '<svg viewBox="-8 -8 216 216"><defs>' + defs + '</defs>'
        + wheelSVG(segs, id, key) + wheelFurniture(id, accent) + '</svg>';
    };
    if (!pair) return one('a', segsA, 'plain', '#f0c460');
    return one('a', segsA, 'plain', '#f0c460') + one('b', segsB, 'super', '#dbe04f');
  }
  /* Land on the prize the engine drew. It may sit on several segments, so one
     of them is chosen at random and brought round to the pointer. */
  function landOn(id, segs, key, label, turns, dir, ms) {
    var list = face(segs, key), step = 360 / FACE_N, hits = [], i;
    for (i = 0; i < list.length; i++) if (list[i].label === label) hits.push(i);
    if (!hits.length) hits = [0];
    var at = hits[Math.floor(Math.random() * hits.length)];
    var mid = -90 + at * step + step / 2;
    var target = (dir < 0 ? -1 : 1) * turns * 360 - (mid + 90);
    var el = $('face-' + id);
    if (!el) return;
    if (ms) el.style.transitionDuration = ms + 'ms';
    el.style.transform = 'rotate(' + target + 'deg)';
    /* the pointer is knocked by each segment as it goes past, slowing with it */
    if (reduced()) return;
    var ptr = $('ptr-' + id), total = ms || 5000, t = 0, n = 0;
    while (t < total - 150 && n < 110) {
      (function (att) {
        later(function () {
          if (!ptr) return;
          ptr.classList.remove('tick'); void ptr.offsetWidth; ptr.classList.add('tick');
        }, att);
      })(t);
      t += 60 + Math.pow(t / total, 2.2) * 640;
      n++;
    }
  }

  function playWheel(res, after) {
    var pair = res.superMode;
    var segsA = K.WHEEL, segsB = K.SUPER_WHEEL;
    var o = document.createElement('div');
    o.className = 'board';
    o.id = 'ov';
    o.innerHTML = '<div class="boardin"><h2></h2><p class="sub"></p>'
      + '<div class="wheelwrap' + (pair ? '' : ' solo') + '">' + showWheel(pair, segsA, segsB) + '</div>'
      + '<div class="tally" id="tally"></div></div>';
    document.body.appendChild(o);
    C.setText(o.querySelector('h2'), pair ? 'The pitom etrog' : 'The wheel');
    C.setText(o.querySelector('.sub'), pair ? 'Both wheels turn' : 'Three etrogim');
    C.play('shuffle', 0, 0.6);
    var run = reduced() ? 400 : (pair ? 5600 : 4800);
    later(function () {
      /* The pair turn against each other, the way they do behind the glass.
         The second is the one that carries the result. */
      landOn('a', segsA, 'plain', pair ? segsA[0].label : res.label, 4, 1, run - (pair ? 700 : 0));
      if (pair) landOn('b', segsB, 'super', res.label, 5, -1, run);
      later(function () {
        C.setHTML($('tally'), C.esc(res.label));
        C.play(res.jackpots && res.jackpots.length ? 'stack' : 'place', 0, 0.8);
        later(after, 1000);
      }, run + 120);
    }, 90);
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
    var st = $('status');
    st.classList.toggle('big', res.total > totalBet() * 20);
    if (res.total <= 0) {
      C.setHTML(st, 'No win');
    } else {
      C.setHTML(st, '<span class="hit" id="winline">$0</span>'
        + (res.wheel || res.build ? ' for the night' : ''));
      countTo($('winline'), res.total, res.total > totalBet() * 20 ? 1500 : 620, C.money);
    }
    if (res.total > 0) C.play(res.total > totalBet() * 10 ? 'stack' : 'lay', 0, 0.7);
    busy = false;
    paint();
  }

  /* a figure that climbs to its number, because a win that simply appears
     reads as a label rather than as money arriving */
  function countTo(el, to, ms, fmt) {
    if (!el) return;
    if (reduced() || to <= 0) { C.setText(el, fmt(to)); return; }
    var from = 0, t0 = 0;
    function frame(ts) {
      if (!t0) t0 = ts;
      var k = Math.min(1, (ts - t0) / ms);
      var e = 1 - Math.pow(1 - k, 3);
      C.setText(el, fmt(Math.round(from + (to - from) * e)));
      if (k < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
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
      + '<p><b>Three etrogim</b> spin the wheel. It either pays a jackpot outright or picks which '
      + 'kind of night you are about to have: <b>Ushpizin Nights</b> is the plain build, '
      + '<b>Etrog Nights</b> leaves etrogim on the grid laying frames of their own, '
      + '<b>Mega Lulav</b> puts up a whole block at once, and <b>Schach Nights</b> starts every '
      + 'etrog as a finished sukkah. The <b>pitom etrog</b>, the one with its crown tip unbroken, '
      + 'turns it into both wheels, gives you the larger version of all four, and opens the sukkah '
      + 'from three rows to six.</p>'
      + '<p class="note">Every segment on the wheel is the same size, and a prize that comes up more '
      + 'often simply sits on more of them. What it lands on is drawn on the game\'s own schedule '
      + 'rather than by counting segments, so the face is not the odds.</p>'
      + '<table class="pay"><tr><th>Symbol</th><th>3</th><th>4</th><th>5</th></tr>' + rowsFor() + '</table>'
      + '<p class="note">Pays are multiples of a twenty-fifth of the total bet, times the ways. '
      + 'Everything in a night is a multiple of the whole bet. Play money only.</p>');
  }

  /* a ghost of the wheel behind the reels, the way the cabinet has one */
  function paintBehind() {
    var el = $('behind');
    if (!el) return;
    C.setHTML(el, showWheel(false, K.WHEEL, K.SUPER_WHEEL));
  }

  function boot() {
    C.setHTML($('nav'), C.nav('sukkah'));
    var lamps = '';
    for (var L = 0; L < 26; L++) lamps += '<i style="animation-delay:' + (L * 0.17).toFixed(2) + 's"></i>';
    C.setHTML($('lights'), lamps);
    buildReels();
    var g = [];
    for (var r = 0; r < 5; r++) {
      var colm = [];
      for (var y = 0; y < 3; y++) colm.push(SYM[Math.floor(Math.random() * SYM.length)]);
      g.push(colm);
    }
    showGrid(g);
    paintBehind();
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
