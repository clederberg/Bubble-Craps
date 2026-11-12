/* Purim Pots: the machine. The maths lives in pots.js; this file is the
   cabinet, which means the reels, the three pots filling along the bottom and
   the bonus board where the spoon does its work.

   The reels are real strips that travel: each spin builds a column of symbols
   with the result sitting at the top of it, drops the column into place and
   lets the transition do the movement, so the stop has weight rather than the
   symbols simply changing. */
(function () {
  'use strict';
  var K = window.Casino, FX = window.SlotFX, S = window.Slots, P = window.PurimPots;
  var G = P.game();
  function $(id) { return document.getElementById(id); }
  function fx(name) { var a = [].slice.call(arguments, 1); return FX && FX[name] ? FX[name].apply(null, a) : null; }
  var money = K.money;

  var St = K.load();
  if (!St.ppJp) St.ppJp = Object.assign({}, G.jackpots.seed);
  if (typeof St.ppAuto !== 'number') St.ppAuto = 0;
  if (!St.chip) St.chip = 500;

  var busy = false, autoLeft = 0, timers = [];
  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function reduced() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  function lineBet() { return St.chip || 500; }
  function totalBet() { return lineBet() * G.lineCount; }

  /* ---------------------------------------------------------------- art */
  function symSVG(key, cls) {
    return '<svg class="' + (cls || 'sym') + '" viewBox="0 0 64 64" aria-hidden="true"><use href="#s-' + key + '"/></svg>';
  }
  /* The letter symbols are a tile with a letter on it rather than their own
     drawing, so they read as the low symbols at a glance. */
  function cellArt(key) {
    var sym = G.symbols[key];
    if (sym && sym.art === 'letter') {
      return '<svg class="sym" viewBox="0 0 64 64" aria-hidden="true">'
        + '<rect x="6" y="6" width="52" height="52" rx="13" fill="url(#gTile)" stroke="url(#gGold)" stroke-width="2.4"/>'
        + '<rect x="11" y="11" width="42" height="20" rx="9" fill="url(#gSheen)"/>'
        + '<text x="32" y="46" text-anchor="middle" font-size="35" font-weight="700" font-family="Cinzel,serif" fill="url(#gGold)">'
        + sym.ch + '</text></svg>';
    }
    return symSVG(key);
  }

  /* --------------------------------------------------------------- reels */
  var CELL = 1;                       // cell height in px, measured from the layout
  function buildReels() {
    var h = '';
    for (var i = 0; i < 5; i++) h += '<div class="reel" id="reel' + i + '"><div class="strip" id="strip' + i + '"></div></div>';
    K.setHTML($('reels'), h);
    sizeReels();
    showGrid(S.gridAt(G, S.spinStops(G)));
  }
  function sizeReels() {
    var r = $('reel0');
    if (!r) return;
    var w = r.getBoundingClientRect().width || 60;
    /* A cell is as wide as it is tall, give or take, and capped so a wide
       window does not turn into five enormous symbols. The cap comes from the
       stylesheet, so a table terminal, which has far more height than a
       browser window, can raise it and fill the glass. */
    var cap = parseFloat(getComputedStyle($('reels')).getPropertyValue('--cellmax')) || 124;
    CELL = Math.max(34, Math.min(cap, Math.round(w * 1.02)));
    $('reels').style.setProperty('--ch', CELL + 'px');
    for (var i = 0; i < 5; i++) $('reel' + i).style.height = (CELL * 3) + 'px';
  }
  function cellHTML(key, extra) {
    return '<div class="cell' + (extra || '') + '" data-sym="' + key + '">' + cellArt(key) + '</div>';
  }
  /* Park a grid in place with no movement, which is what the machine looks
     like before the first spin and after a restore. */
  function showGrid(grid) {
    for (var i = 0; i < 5; i++) {
      var h = '';
      for (var y = 0; y < 3; y++) h += cellHTML(grid[i][y]);
      var st = $('strip' + i);
      st.style.transition = 'none';
      st.style.transform = 'translateY(0)';
      K.forceHTML(st, h);
    }
  }
  function randomSym(reel) {
    var strip = G.reels[reel];
    return strip[Math.floor(Math.random() * strip.length)];
  }
  /* One reel's journey: the result at the top, a run of blur fodder behind it,
     and a transition that carries the column down into place. */
  function spinReel(i, final, dur, done) {
    var reel = $('reel' + i), st = $('strip' + i);
    var run = reduced() ? 3 : 14 + i * 3;
    var h = '';
    for (var y = 0; y < 3; y++) h += cellHTML(final[y]);
    for (var k = 0; k < run; k++) h += cellHTML(randomSym(i));
    K.forceHTML(st, h);
    st.style.transition = 'none';
    st.style.transform = 'translateY(' + (-run * CELL) + 'px)';
    reel.classList.add('spin');
    /* one frame with the strip parked up top, then let it fall */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        st.style.transition = 'transform ' + dur + 'ms cubic-bezier(.16,.68,.24,1.04)';
        st.style.transform = 'translateY(0)';
      });
    });
    later(function () {
      reel.classList.remove('spin');
      st.style.transition = 'none';
      /* trim the column back to the three that are showing, so the next spin
         starts from a clean strip */
      var keep = '';
      for (var y = 0; y < 3; y++) keep += cellHTML(final[y], ' land');
      K.forceHTML(st, keep);
      fx('reelStop', i);
      if (done) done();
    }, dur + 20);
  }
  /* The reels stop left to right. If a pot is two up with reels still to come,
     the rest of them slow right down and the pot glows, because that is the
     moment worth drawing out. */
  function spinReels(grid, opts, done) {
    var left = 5;
    var counts = {};
    var holdFrom = 99, holdKey = null;
    G.potSyms.forEach(function (sym) {
      counts[sym] = 0;
      for (var x = 0; x < 5; x++) {
        for (var y = 0; y < 3; y++) if (grid[x][y] === sym) counts[sym]++;
        /* the first reel at which this pot is one short of closing */
        if (counts[sym] === G.hold.close - 1 && holdFrom > x + 1) { holdFrom = x + 1; holdKey = sym; }
      }
    });
    if (reduced()) holdFrom = 99;

    for (var i = 0; i < 5; i++) {
      (function (i) {
        var teasing = i >= holdFrom;
        var dur = reduced() ? 180 : 620 + i * 155 + (teasing ? 1150 : 0);
        later(function () {
          if (teasing) {
            $('reel' + i).classList.add('near');
            var potEl = holdKey && $('pot-' + G.symbols[holdKey].pot);
            if (potEl) potEl.classList.add('near');
            fx('anticipate', 1.6);
          }
          spinReel(i, grid[i], dur, function () {
            if (teasing) { $('reel' + i).classList.remove('near'); fx('stopAnticipate'); }
            if (!--left && done) done();
          });
        }, i * 95);
      })(i);
    }
    var ticks = reduced() ? 0 : 9;
    for (var t = 0; t < ticks; t++) later(function () { fx('tick'); }, 70 + t * 75);
  }

  /* ---------------------------------------------------------------- pots */
  /* The three pots are symbols on the reels, not meters. What this strip is
     for is telling you what each one does, and how close the last spin came:
     two of a pot is one short, which is worth seeing. */
  function buildPots() {
    var h = '';
    G.pots.forEach(function (p) {
      h += '<div class="pot ' + p.key + '" id="pot-' + p.key + '">'
        + '<div class="potart" id="potart-' + p.key + '"></div>'
        + '<div class="potmeta"><b>' + p.name + '</b><small>' + p.note + '</small></div>'
        + '<span class="potcount" id="potseen-' + p.key + '"></span></div>';
    });
    K.setHTML($('potrail'), h);
    G.pots.forEach(function (p) { fillPot(p.key, 0); });
    paintPots(null);
  }
  /* What the strip is for: showing how close the last spin came. One of a pot
     drops a hamantasch into it, two sets it rattling, three closes it. */
  function paintPots(pots) {
    G.pots.forEach(function (p) {
      var n = pots && pots.seen ? (pots.seen[p.key] || 0) : 0;
      var closed = pots && pots.keys.indexOf(p.key) >= 0;
      var el = $('pot-' + p.key);
      el.classList.toggle('ready', !!closed);
      el.classList.toggle('near', !closed && n === G.hold.close - 1);
      K.setText($('potseen-' + p.key), closed ? 'CLOSED' : n ? n + ' of ' + G.hold.close : '');
      fillPot(p.key, closed ? G.hold.close : n);
    });
  }
  /* the hamantaschen sitting in the mouth of a pot */
  function fillPot(key, n) {
    var art = $('potart-' + key);
    if (!art) return;
    if (art.__n === n) return;
    art.__n = n;
    var h = '<svg viewBox="0 0 64 64" aria-hidden="true">';
    var spots = [[22, 16], [42, 16], [32, 9]];
    for (var i = 0; i < Math.min(3, n); i++) {
      h += '<g class="potfill" style="--d:' + (i * 0.09) + 's" transform="translate(' + (spots[i][0] - 9) + ','
        + (spots[i][1] - 9) + ') scale(.28)"><use href="#s-HAMAN"/></g>';
    }
    h += '<use href="#s-' + key.toUpperCase() + '"/></svg>';
    K.forceHTML(art, h);
  }

  /* ------------------------------------------------------------ jackpots */
  function paintJackpots(won) {
    var h = '';
    G.jackpots.order.forEach(function (t) {
      h += '<div class="jp ' + t + (won && won.indexOf(t) >= 0 ? ' won' : '') + '"><b>' + t + '</b><span>'
        + money(Math.round(St.ppJp[t] * totalBet() / 100) * 100) + '</span></div>';
    });
    K.forceHTML($('jackpots'), h);
  }
  function bumpMeters() {
    G.jackpots.order.forEach(function (t) { St.ppJp[t] += G.jackpots.rate[t]; });
  }
  function resetMeter(tier) { St.ppJp[tier] = G.jackpots.seed[tier]; }

  /* ----------------------------------------------------------- win panel */
  function iconFor(sym) { return '<svg class="ic" viewBox="0 0 64 64"><use href="#s-' + sym + '"/></svg>'; }
  /* `lineOnly` is what the panel shows while a bonus is still playing out:
     printing the feature total next to a board that has not finished landing
     would give away the ending. */
  function paintWins(res, lineOnly) {
    var rows = '';
    (res.wins || []).slice().sort(function (a, b) { return b.amount - a.amount; }).slice(0, 7).forEach(function (w) {
      rows += '<div class="wrow">' + (G.symbols[w.sym].art === 'letter' ? '<span class="ic"></span>' : iconFor(w.sym))
        + '<span class="lb">' + K.esc(G.symbols[w.sym].name) + ' x' + w.count + '</span>'
        + '<span class="am">' + money(w.amount) + '</span></div>';
    });
    if (!lineOnly && res.hold) {
      rows += '<div class="wrow feat">' + iconFor(potSym(res.hold.mods[0])) + '<span class="lb">' + K.esc(roundName(res.hold.mods)) + '</span>'
        + '<span class="am">' + money(res.hold.total) + '</span></div>';
    }
    if (!rows) rows = '<div class="wrow"><span class="lb">' + (lineOnly && res.hold ? 'Bonus on the way' : 'No win') + '</span></div>';
    K.forceHTML($('winpanel'), '<h4>This spin</h4>' + rows
      + '<div class="wtotal"><b>' + (lineOnly ? 'Lines' : 'Total') + '</b><span>'
      + money(lineOnly ? res.lineTotal : res.total) + '</span></div>');
  }

  /* ------------------------------------------------------- the bonus board */
  /* A tray is five columns of three. Cells are poked one at a time so a
     hamantasch already in place is never torn out and re-animated. */
  function trayHTML(ti) {
    var h = '<div class="tray" id="tray' + ti + '">'
      + '<div class="trayhead"><div class="collector" id="pot' + ti + '">'
      + '<svg viewBox="0 0 64 64"><use href="#s-POPPY"/></svg>'
      + '<i id="potcount' + ti + '">0</i></div>'
      + '<div class="letters">';
    P.GRAND_LETTERS.forEach(function (ch, c) { h += '<i id="L' + ti + '_' + c + '">' + ch + '</i>'; });
    h += '</div></div><div class="cols">';
    for (var c = 0; c < G.cols; c++) {
      h += '<div class="col" id="col' + ti + '_' + c + '">';
      for (var r = 0; r < G.rows; r++) h += '<div class="hscell" id="hs' + ti + '_' + (c * G.rows + r) + '"></div>';
      h += '<span class="orderpop" id="pop' + ti + '_' + c + '"></span></div>';
    }
    return h + '</div></div>';
  }
  function openBoard(title, sub, trays) {
    var h = '<div class="ov" id="ov"><h3>' + K.esc(title) + '</h3><div class="sub2" id="ovsub">' + K.esc(sub || '') + '</div>'
      + '<div class="trays' + (trays > 1 ? ' two' : '') + '" id="trays">';
    for (var t = 0; t < trays; t++) h += trayHTML(t);
    h += '</div><div class="hsbar"><span class="pill" id="pillRespins">Respins <b>3</b></span>'
      + '<span class="banked"><small>Won so far</small><i id="pillBank" style="font-style:normal">$0</i></span></div></div>';
    var box = document.createElement('div');
    box.innerHTML = h;
    document.querySelector('.cabinet').appendChild(box.firstChild);
  }
  function closeBoard() { var o = $('ov'); if (o) o.remove(); }
  function paintCell(ti, i, v) {
    var el = $('hs' + ti + '_' + i);
    if (!el) return;
    if (!v) { el.className = 'hscell'; el.innerHTML = ''; return; }
    el.className = 'hscell on' + (v.jackpot ? ' jp' : '');
    el.innerHTML = '<svg class="bg" viewBox="0 0 64 64"><use href="#s-HAMAN"/></svg>'
      + '<span class="hsv">' + (v.jackpot ? v.label + '<br>' + money(v.amount) : money(v.amount)) + '</span>';
  }
  /* An order up. The column lights, the three hamantaschen fly up into the pot
     one after another, the letter above the column comes on, and only then do
     the cells open again. Seeing them leave is the whole point of the mechanic,
     so this is deliberately unhurried. */
  var collected = [0, 0];
  function orderUp(order, after) {
    var ti = order.tray, c = order.col;
    var col = $('col' + ti + '_' + c);
    var pot = $('pot' + ti);
    if (!col) return after && after();
    col.classList.add('done');
    fx('ratchet');

    var cells = [];
    for (var r = 0; r < G.rows; r++) {
      var el = $('hs' + ti + '_' + (c * G.rows + r));
      if (el && el.classList.contains('on')) cells.push(el);
    }
    if (reduced() || !pot) {
      cells.forEach(function (el) { el.className = 'hscell'; el.innerHTML = ''; });
      finishOrder();
      return;
    }

    var potBox = pot.getBoundingClientRect();
    cells.forEach(function (el, n) {
      later(function () {
        var from = el.getBoundingClientRect();
        var fly = document.createElement('div');
        fly.className = 'flycell';
        fly.innerHTML = el.innerHTML;
        fly.style.width = from.width + 'px';
        fly.style.height = from.height + 'px';
        document.body.appendChild(fly);
        var x0 = from.left, y0 = from.top;
        var x1 = potBox.left + potBox.width / 2 - from.width * 0.18;
        var y1 = potBox.top + potBox.height * 0.1;
        fly.animate([
          { transform: 'translate(' + x0 + 'px,' + y0 + 'px) scale(1)', opacity: 1 },
          { transform: 'translate(' + ((x0 + x1) / 2) + 'px,' + (Math.min(y0, y1) - 52) + 'px) scale(.8)', opacity: 1, offset: 0.55 },
          { transform: 'translate(' + x1 + 'px,' + y1 + 'px) scale(.32)', opacity: 0.1 }
        ], { duration: 520, easing: 'cubic-bezier(.35,.02,.4,1)', fill: 'forwards' }).onfinish = function () {
          fly.remove();
          collected[ti]++;
          K.setText($('potcount' + ti), String(collected[ti]));
          pot.classList.remove('gulp');
          void pot.offsetWidth;
          pot.classList.add('gulp');
          fx('pocket');
        };
        el.className = 'hscell';
        el.innerHTML = '';
      }, n * 170);
    });
    later(finishOrder, cells.length * 170 + 560);

    function finishOrder() {
      if (order.letter) {
        var L = $('L' + ti + '_' + c);
        if (L) L.classList.add('lit');
        fx('reveal');
      }
      var pop = $('pop' + ti + '_' + c);
      K.setHTML(pop, money(order.amount) + (order.grand ? '<b>GRAND</b>' : ''));
      pop.classList.add('show');
      fx(order.grand ? 'jackpot' : 'coinRun', order.grand ? 'grand' : 2);
      later(function () {
        col.classList.remove('done');
        pop.classList.remove('show');
        if (after) after();
      }, order.grand ? 2200 : 1050);
    }
  }

  function rollTo(el, from, to, ms) {
    if (!el) return;
    if (reduced() || from === to) { K.setText(el, money(to)); return; }
    var t0 = performance.now();
    (function step(now) {
      var k = Math.min(1, (now - t0) / ms);
      var e = 1 - Math.pow(1 - k, 3);
      K.setText(el, money(Math.round(from + (to - from) * e)));
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  /* Walk a bonus round step by step. Only completed columns pay, so the figure
     under the trays is what has actually been collected. */
  function playBoard(round, title, sub, done) {
    var trays = round.trays;
    collected = [0, 0];
    openBoard(title, sub, trays);
    var shown = 0, i = 0;
    var BEAT = reduced() ? 60 : 680;

    function paintStep(st) {
      st.trays.forEach(function (t, ti) {
        t.cells.forEach(function (v, k) { paintCell(ti, k, v); });
        t.lit.forEach(function (on, c) {
          var L = $('L' + ti + '_' + c);
          if (L) L.classList.toggle('lit', !!on);
        });
      });
    }
    /* What the round is worth as it stands: collected plus whatever is still
       sitting on the trays, because that pays when the respins run out. */
    function worth(st) {
      return st.total + st.trays.reduce(function (a, t) {
        return a + t.cells.reduce(function (x, v) { return x + (v ? v.amount : 0); }, 0);
      }, 0);
    }
    function runOrders(list, after) {
      if (!list.length) return after();
      var n = 0;
      (function next() {
        if (n >= list.length) return after();
        orderUp(list[n++], next);
      })();
    }

    var seed = round.steps[0];
    var seeded = [];
    seed.trays.forEach(function (t, ti) { t.cells.forEach(function (v, k) { if (v) seeded.push([ti, k, v]); }); });
    seeded.forEach(function (c, n) { later(function () { paintCell(c[0], c[1], c[2]); fx('thud'); }, 180 + n * 175); });
    var t0 = 180 + seeded.length * 175 + 320;
    later(function () {
      runOrders(seed.orders, function () {
        rollTo($('pillBank'), shown, worth(seed), 400);
        shown = worth(seed);
        step();
      });
    }, t0);

    function step() {
      if (i >= round.steps.length) return later(finish, 500);
      var st = round.steps[i];
      i++;
      if (st.seed) return step();

      K.setHTML($('pillRespins'), 'Respins <b>' + st.respins + '</b>');
      $('pillRespins').classList.toggle('live', st.respins <= 1);

      var drops = st.drops || [];
      if (drops.length) later(function () { rollTo($('pillBank'), shown, worth(st), 500); shown = worth(st); }, 260 + drops.length * 200);
      drops.forEach(function (d, n) {
        later(function () {
          if (d.drizzle) {
            var tr = $('tray' + d.tray);
            if (tr) { tr.classList.remove('drizzled'); void tr.offsetWidth; tr.classList.add('drizzled'); }
                K.setText($('ovsub'), 'Chocolate drop \u00b7 it adds its value to the tray');
            fx('sizzle');
            /* the doubling has already happened in the maths, so repaint the
               whole tray rather than just the cell that landed */
            st.trays[d.tray].cells.forEach(function (v, k) { if (v) paintCell(d.tray, k, v); });
          } else {
            paintCell(d.tray, d.idx, d.value);
            fx(d.value.jackpot ? 'reveal' : 'thud');
          }
        }, 260 + n * 200);
      });

      var wait = drops.length ? 260 + drops.length * 200 + 320 : BEAT;
      later(function () {
        runOrders(st.orders || [], function () {
          rollTo($('pillBank'), shown, worth(st), 420);
          shown = worth(st);
          if (st.orders && st.orders.length) K.setText($('ovsub'), st.orders.length > 1 ? 'Two orders up' : 'Order up');
          later(step, st.orders && st.orders.length ? 260 : 60);
        });
      }, wait);
    }

    function finish() {
      rollTo($('pillBank'), shown, round.total, 600);
      var lit = round.lit.reduce(function (a, b) { return Math.max(a, b); }, 0);
      K.setHTML($('pillRespins'), '<b>' + (round.orders ? round.orders + (round.orders === 1 ? ' order' : ' orders') : 'No order up') + '</b>');
      K.setText($('ovsub'), round.grand ? 'G R A N D'
        : lit === 4 ? 'One letter short of the Grand'
        : round.left ? 'The tray pays what is left on it'
        : 'Bonus over');
      later(function () { closeBoard(); if (done) done(); }, 2200);
    }
  }

  /* ------------------------------------------------------------- the spin */
  function headline(a, b) { K.setText($('headline'), a); if (b !== undefined) K.setText($('subline'), b); }

  function spin(bought) {
    if (busy) return;
    var cost = bought ? Math.round(bought.price * totalBet()) : totalBet();
    if (cost > K.bank()) { autoLeft = 0; paintAuto(); return K.toast('Not enough in your bankroll for that'); }
    busy = true; clearTimers();
    K.ac();
    K.addBank(-cost);
    bumpMeters();
    var res = bought
      ? P.buyFeature(G, bought.key, lineBet(), St.ppJp)
      : P.play(G, lineBet(), St.ppJp);
    paintJackpots();
    K.setText($('betNow'), money(cost));
    headline(bought ? 'Bought: ' + bought.label : 'Spinning', bought ? '' : 'Twenty lines');
    paintPots(null);
    paint();
    K.save();

    spinReels(res.grid, {}, function () { resolve(res); });
  }

  function resolve(res) {
    paintPots(res.pots);
    markWins(res);
    paintWins(res, true);
    if (res.pots && res.pots.keys.length) fx('sizzle');

    later(function () {
      if (!res.hold) { paintWins(res, false); return settle(res); }
      headline(roundName(res.hold.mods), modLine(res.hold.mods));
      later(function () {
        playBoard(res.hold, roundName(res.hold.mods), modLine(res.hold.mods), function () {
          paintWins(res, false);
          settle(res);
        });
      }, 300);
    }, res.hold ? 450 : 260);
  }

  function potSym(key) {
    var p = G.pots.filter(function (x) { return x.key === key; })[0];
    return p ? p.sym : 'POPPY';
  }
  function roundName(mods) {
    if (!mods || !mods.length) return 'Pot Bonus';
    if (mods.length === 1) {
      var p = G.pots.filter(function (x) { return x.key === mods[0]; })[0];
      return (p ? p.name : 'Pot') + ' Pot';
    }
    return mods.map(function (k) {
      var p = G.pots.filter(function (x) { return x.key === k; })[0];
      return p ? p.name : k;
    }).join(' + ');
  }
  function modLine(mods) {
    return mods.map(function (k) {
      var p = G.pots.filter(function (x) { return x.key === k; })[0];
      return p ? p.note : k;
    }).join(' \u00b7 ');
  }

  function markWins(res) {
    var on = {};
    (res.wins || []).forEach(function (w) { w.path.forEach(function (row, x) { on[x + ':' + row] = 1; }); });
    if (!Object.keys(on).length) return;
    for (var x = 0; x < 5; x++) {
      var cells = $('reel' + x).querySelectorAll('.cell');
      for (var y = 0; y < cells.length && y < 3; y++) {
        if (on[x + ':' + y]) cells[y].classList.add('hit');
        else cells[y].classList.add('dim');
      }
    }
    later(function () {
      document.querySelectorAll('.cell.hit,.cell.dim').forEach(function (c) { c.classList.remove('hit', 'dim'); });
    }, 2600);
  }

  function settle(res) {
    if (res.total) {
      K.addBank(res.total);
      var jp = {};
      res.jackpots.forEach(function (j) { jp[j.tier] = 1; resetMeter(j.tier); });
      var tiers = Object.keys(jp);
      if (tiers.length) { paintJackpots(tiers); fx('jackpot', tiers[0]); }
      else fx('coinRun', res.total / res.totalBet);
      K.setText($('lastWin'), money(res.total));
      headline(res.total >= res.totalBet * 20 ? 'Big win' : 'You win ' + money(res.total),
        res.hold ? roundName(res.hold.mods) + ' · ' + res.hold.orders + (res.hold.orders === 1 ? ' order' : ' orders') : 'Twenty lines');
    } else {
      K.setText($('lastWin'), money(0));
      headline('No win', 'Spin again');
    }
    /* clear the flag before painting, or the paint that follows re-disables
       the buttons it was meant to turn back on */
    busy = false;
    paint();
    K.save();
    if (autoLeft > 0) {
      autoLeft--;
      paintAuto();
      if (autoLeft >= 0 && K.bank() >= totalBet()) later(function () { spin(null); }, 700);
      else { autoLeft = 0; paintAuto(); }
    }
  }
  /* ------------------------------------------------------------- chrome */
  function paint() {
    K.setText($('bank'), money(K.bank()));
    K.setText($('betNow'), money(totalBet()));
    var el = $('chips');
    if (el.__chip !== St.chip) {
      el.__chip = St.chip;
      K.renderChips(el, St.chip, function (c) {
        if (busy) return;
        St.chip = c; K.save(); K.play('lay', 0, 0.4); paint(); paintJackpots();
      });
    }
    $('spin').disabled = busy;
    $('buyBtn').disabled = busy;
  }
  function paintAuto() {
    K.setText($('auto'), autoLeft > 0 ? 'Auto: ' + autoLeft : 'Auto: Off');
    $('auto').setAttribute('aria-pressed', autoLeft > 0);
  }

  function paytableHTML() {
    var h = '<div class="paylist">';
    G.order.forEach(function (k) {
      var p = G.pays[k];
      h += '<div class="payrow">' + (G.symbols[k].art === 'letter'
        ? '<svg viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" rx="13" fill="url(#gTile)" stroke="url(#gGold)" stroke-width="2.4"/>'
          + '<text x="32" y="46" text-anchor="middle" font-size="35" font-weight="700" font-family="Cinzel,serif" fill="url(#gGold)">' + G.symbols[k].ch + '</text></svg>'
        : '<svg viewBox="0 0 64 64"><use href="#s-' + k + '"/></svg>')
        + '<div>' + K.esc(G.symbols[k].name) + (k === G.wild ? ' <b>wild</b>' : '') + '<br>'
        + '3 <b>' + money(p[3] * lineBet()) + '</b> &middot; 4 <b>' + money(p[4] * lineBet()) + '</b> &middot; 5 <b>' + money(p[5] * lineBet()) + '</b>'
        + '</div></div>';
    });
    h += '</div><div class="paylist" style="margin-top:8px">';
    G.pots.forEach(function (p) {
      h += '<div class="payrow">' + symSVG(p.sym, '') + '<div><b>' + K.esc(p.name) + ' pot</b><br>'
        + K.esc(p.note) + '</div></div>';
    });
    h += '</div><details class="rules" open><summary>How the bonus works</summary><ul>'
      + '<li><b>Three of a pot closes it</b> and starts the bonus. Close two on the same spin and the round gets both.</li>'
      + '<li><b>Poppy</b> gives a fourth respin instead of three. <b>Apricot</b> opens a second tray, so the bonus happens twice over. <b>Chocolate</b> drops in carrying a value of its own and <b>adds that value to every hamantasch on the tray</b>.</li>'
      + '<li>Hamantaschen lock where they land. <b>A column with all three cells full is an order up:</b> it pays, goes to the pot, and leaves the cells open for the next spin.</li>'
      + '<li>Whatever is still on the tray when the respins run out is paid as it stands, so nothing is wasted.</li>'
      + '<li>Each column has a letter of <b>G R A N D</b> above it, lit the first time that column is completed. Light all five and the Grand is yours.</li>'
      + '<li>The respins do not reset. Three of them, four with Poppy.</li>'
      + '<li>Twenty lines, left to right, highest win per line.</li>'
      + '</ul></details>';
    return h;
  }
  function buyHTML() {
    var h = '';
    G.buy.forEach(function (b) {
      h += '<button class="buyrow" data-buy="' + b.key + '"><div><b>' + K.esc(b.label) + '</b><small>' + K.esc(b.note) + '</small></div>'
        + '<span class="cost">' + money(Math.round(b.price * totalBet())) + '</span></button>';
    });
    return h;
  }

  /* -------------------------------------------------------------- wiring */
  K.setHTML($('nav'), K.nav('purim'));
  var bulbs = '';
  for (var b = 0; b < 14; b++) bulbs += '<i style="animation-delay:' + (b * 0.13).toFixed(2) + 's"></i>';
  K.setHTML($('bulbs'), bulbs);
  buildReels();
  buildPots();
  paintJackpots();
  paint();
  paintAuto();
  K.setText($('lastWin'), money(0));
  K.forceHTML($('winpanel'), '<h4>How it pays</h4>'
    + '<div class="wrow">' + iconFor('HAMAN') + '<span class="lb">Fills all three pots</span></div>'
    + '<div class="wrow">' + iconFor('CROWN') + '<span class="lb">Wild, and the top line pay</span></div>'
    + '<div class="wrow">' + iconFor('SPOON') + '<span class="lb">Clears the bonus board</span></div>'
    + '<div class="wtotal"><b>Lines</b><span>20</span></div>');

  $('spin').addEventListener('click', function () { if (!busy) spin(null); });
  $('auto').addEventListener('click', function () {
    autoLeft = autoLeft > 0 ? 0 : 25;
    paintAuto();
    if (autoLeft > 0 && !busy) spin(null);
  });
  $('audio').addEventListener('click', function () {
    St.sound = !St.sound;
    K.setText($('audio'), St.sound ? 'Audio: All' : 'Audio: Off');
    K.save();
  });
  $('paytableBtn').addEventListener('click', function () {
    K.setHTML($('payBody'), paytableHTML());
    var d = $('payDlg'); if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  });
  $('payClose').addEventListener('click', function () { $('payDlg').close(); });
  $('buyBtn').addEventListener('click', function () {
    if (busy) return;
    K.setHTML($('buyList'), buyHTML());
    var d = $('buyDlg'); if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  });
  $('buyCancel').addEventListener('click', function () { $('buyDlg').close(); });
  $('buyList').addEventListener('click', function (e) {
    var el = e.target.closest('[data-buy]');
    if (!el) return;
    var opt = G.buy.filter(function (x) { return x.key === el.dataset.buy; })[0];
    $('buyDlg').close();
    if (opt) spin(opt);
  });

  /* bankroll reset, the same shape as the other machines */
  function parseDollars(v) { var n = parseFloat(String(v).replace(/[$,\s]/g, '')); return isFinite(n) ? Math.round(n * 100) : NaN; }
  function openReset() {
    if (busy) return K.toast('Wait for the spin to finish');
    $('resetAmt').value = ((St.startAmt || 100000) / 100).toLocaleString('en-US');
    $('resetErr').textContent = '';
    var d = $('resetDlg'); if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  $('reset').addEventListener('click', openReset);
  $('bankBtn').addEventListener('click', openReset);
  $('resetCancel').addEventListener('click', function () { $('resetDlg').close(); });
  $('resetPresets').addEventListener('click', function (e) {
    var b = e.target.closest('[data-amt]');
    if (b) { $('resetAmt').value = (+b.dataset.amt).toLocaleString('en-US'); $('resetErr').textContent = ''; }
  });
  $('resetGo').addEventListener('click', function () {
    var c = parseDollars($('resetAmt').value);
    if (isNaN(c) || c < 100) { $('resetErr').textContent = 'Enter an amount of at least $1.'; return; }
    K.setBank(c);
    St.startAmt = c;
    K.save();
    $('resetDlg').close();
    paint();
    headline('Bankroll reset', 'Pick a chip and spin');
  });

  document.addEventListener('keydown', function (e) {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if ($('resetDlg').open || $('payDlg').open || $('buyDlg').open) return;
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!busy) spin(null); }
    if (e.key === 'b' || e.key === 'B') { e.preventDefault(); openReset(); }
  });
  window.addEventListener('resize', function () {
    sizeReels();
    for (var i = 0; i < 5; i++) {
      var st = $('strip' + i);
      if (st) st.style.transform = 'translateY(0)';
    }
  });
  K.setText($('audio'), St.sound === false ? 'Audio: Off' : 'Audio: All');
})();
