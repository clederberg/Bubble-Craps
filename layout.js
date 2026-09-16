/* Table geometry and artwork. Everything is in SVG units; the app scales it to the screen. */
(function (root) {
  'use strict';
  var C = root.Craps;
  var LINE = 'rgba(255,248,230,.85)', INK = '#fff8e6', GOLD = '#f2c75c';

  function ratio(r) { return r[0] + ':' + r[1]; }
  function to(r) { return r[0] + ' to ' + r[1]; }
  function T(x, y, s, size, o) {
    o = o || {};
    return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" text-anchor="' + (o.a || 'middle') + '"'
      + ' fill="' + (o.fill || INK) + '"' + (o.w ? ' font-weight="' + o.w + '"' : '')
      + (o.ls ? ' letter-spacing="' + o.ls + '"' : '') + (o.f ? ' font-family="' + o.f + '"' : '')
      + ' dominant-baseline="middle">' + s + '</text>';
  }
  var OSW = 'Oswald, Impact, sans-serif';
  var PIPS = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function dieIcon(cx, cy, s, v) {
    var h = '<rect x="' + (cx - s / 2) + '" y="' + (cy - s / 2) + '" width="' + s + '" height="' + s + '" rx="' + (s * 0.2) + '" fill="#c0261f" stroke="#fff" stroke-width="1"/>';
    PIPS[v].forEach(function (i) {
      var px = cx + ((i % 3) - 1) * s * 0.27, py = cy + (Math.floor(i / 3) - 1) * s * 0.27;
      h += '<circle cx="' + px + '" cy="' + py + '" r="' + (s * 0.095) + '" fill="#fff"/>';
    });
    return h;
  }
  function pair(cx, cy, s, a, b) { return dieIcon(cx - s * 0.6, cy, s, a) + dieIcon(cx + s * 0.6, cy, s, b); }

  function build(mode, wide) {
    var m = C.MODES[mode], dont = m.dont;
    var L = { mode: mode, wide: wide, spots: [], decor: '', anchors: {}, odds: [], puck: {}, tracker: [] };
    function spot(k, x, y, w, h, art, tip, anchor) {
      L.spots.push({ k: k, x: x, y: y, w: w, h: h, art: art, tip: tip });
      if (anchor) L.anchors[k] = anchor;
    }
    var R, X0, X1, y;
    if (wide) { L.W = 1200; R = 15; X0 = 34; X1 = 858; L.ds = 40; }
    else { L.W = 420; R = 14; X0 = 14; X1 = 406; L.ds = 36; }
    L.chipR = R;
    var FW = X1 - X0;

    /* --- Small / Tall / All --- */
    var atsY = wide ? 34 : 14, atsH = wide ? 50 : 50, atsW = wide ? 158 : (FW - 12) / 3;
    ['small', 'tall', 'all'].forEach(function (a, i) {
      var x = X0 + i * (atsW + 6), A = C.ATS[a];
      var title = { small: 'ALL SMALL', tall: 'ALL TALL', all: "MAKE 'EM ALL" }[a];
      var art = T(x + atsW / 2 + (wide ? 12 : 10), atsY + 18, title, wide ? 15 : 13, { f: OSW, ls: 1 })
        + T(x + atsW / 2 + (wide ? 12 : 10), atsY + 36, A.pay + ' to 1', wide ? 11 : 10, { fill: GOLD });
      spot('ats:' + a, x, atsY, atsW, atsH, art, C.ATS[a].name + ' · ' + A.pay + ' to 1', { x: x + R + 6, y: atsY + atsH / 2 });
    });
    var tn = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];
    if (wide) {
      var tx0 = X0 + 3 * (atsW + 6) + 18, tsp = (X1 - tx0 - 14) / 9;
      tn.forEach(function (n, i) { L.tracker.push({ n: n, x: tx0 + 14 + i * tsp, y: atsY + atsH / 2, r: 13 }); });
      y = atsY + atsH + 14;
    } else {
      var tsp2 = (FW - 28) / 9;
      tn.forEach(function (n, i) { L.tracker.push({ n: n, x: X0 + 14 + i * tsp2, y: atsY + atsH + 20, r: 13 }); });
      y = atsY + atsH + 42;
    }

    /* --- Number boxes --- */
    var lh = wide ? 36 : 34, bh = wide ? 116 : 98;
    var nx = X0, perRow = wide ? m.points.length : (m.points.length > 6 ? 5 : 3);
    if (wide && dont) {
      var dcw = 92, dch = lh * 2 + bh;
      var dart = T(X0 + dcw / 2, y + 62, "DON'T", 17, { f: OSW, ls: 1 }) + T(X0 + dcw / 2, y + 84, 'COME', 17, { f: OSW, ls: 1 })
        + T(X0 + dcw / 2, y + 106, 'BAR', 17, { f: OSW, ls: 1 }) + pair(X0 + dcw / 2, y + 132, 16, 6, 6);
      spot('dc', X0, y, dcw, dch, dart, "Don't Come · 1:1 · 2,3 win · 12 push", { x: X0 + dcw / 2, y: y + dch - R - 8 });
      L.puck.off = { x: X0 + dcw / 2, y: y + 28 };
      nx = X0 + dcw + 8;
    }
    var gap = 6, cw = ((X1 - nx) - gap * (perRow - 1)) / perRow;
    m.points.forEach(function (n, i) {
      var col = i % perRow, row = Math.floor(i / perRow);
      var x = nx + col * (cw + gap), yy = y + row * (lh * 2 + bh + 8);
      var tr = C.TRUE[n], lay = [tr[1], tr[0]], big = n === 6 ? 'SIX' : n === 9 ? 'NINE' : String(n);
      var fs = (n === 6 || n === 9) ? Math.min(wide ? 34 : 28, cw * 0.36) : Math.min(wide ? 50 : 42, cw * 0.55);
      spot('lay:' + n, x, yy, cw, lh, T(x + cw / 2, yy + lh / 2, 'LAY ' + ratio(lay), wide ? 11 : 10, { ls: 0.5 }),
        'Lay ' + n + ' · ' + to(lay) + ' minus 5%', { x: x + R + 5, y: yy + lh / 2 });
      spot('buy:' + n, x, yy + lh, cw, bh,
        T(x + cw / 2, yy + lh + bh * 0.52, big, fs, { f: OSW, w: 600, ls: 1 })
        + T(x + 6, yy + lh + bh - 9, 'BUY ' + ratio(tr), 10, { a: 'start', fill: GOLD }),
        'Buy ' + n + ' · ' + to(tr) + ' minus 5%', { x: x + cw / 2, y: yy + lh + bh - R - 5 });
      spot('place:' + n, x, yy + lh + bh, cw, lh, T(x + cw / 2, yy + lh + bh + lh / 2, 'PLACE ' + ratio(C.PLACE[n]), wide ? 11 : 10, { ls: 0.5 }),
        'Place ' + n + ' · ' + to(C.PLACE[n]), { x: x + R + 5, y: yy + lh + bh + lh / 2 });
      L.anchors['comeOn:' + n] = { x: x + R + 5, y: yy + lh + R + 5 };
      L.odds.push({ k: 'comeOdds:' + n, base: 'comeOn:' + n, x: x + cw - R - 5, y: yy + lh + R + 5 });
      L.anchors['comeOdds:' + n] = { x: x + cw - R - 5, y: yy + lh + R + 5 };
      if (dont) {
        L.anchors['dcOn:' + n] = { x: x + cw / 2, y: yy + lh / 2 };
        L.odds.push({ k: 'dcOdds:' + n, base: 'dcOn:' + n, x: x + cw - R - 5, y: yy + lh / 2 });
        L.anchors['dcOdds:' + n] = { x: x + cw - R - 5, y: yy + lh / 2 };
      }
      L.puck[n] = { x: x + cw / 2, y: yy + lh };
    });
    var rows = Math.ceil(m.points.length / perRow);
    y += rows * (lh * 2 + bh) + (rows - 1) * 8 + 10;

    /* --- Don't Come bar (phone) --- */
    if (!wide && dont) {
      spot('dc', X0, y, FW, 40, T(X0 + FW / 2 - 20, y + 20, "DON'T COME BAR", 17, { f: OSW, ls: 1 }) + pair(X0 + FW / 2 + 82, y + 20, 16, 6, 6),
        "Don't Come · 1:1 · 2,3 win · 12 push", { x: X0 + R + 8, y: y + 20 });
      L.puck.off = { x: X1 - 26, y: y + 20 };
      y += 48;
    }

    /* --- Come --- */
    var comeH = wide ? 78 : 66;
    spot('come', X0, y, FW, comeH, T(X0 + FW / 2, y + comeH / 2 + 2, 'COME', wide ? 46 : 38, { f: OSW, w: 600, ls: 8, fill: 'rgba(255,248,230,.9)' }),
      'Come · 1:1', { x: X0 + R + 14, y: y + comeH / 2 });
    L.zone = { x0: X0 + (wide ? 150 : 60), x1: X1 - (wide ? 90 : 60), y0: y + 6, y1: y + comeH + (wide ? 70 : 60) };
    if (!dont) L.puck.off = { x: X1 - 26, y: y + 22 };
    y += comeH + 8;

    /* --- Field --- */
    var fh = wide ? 90 : 84, nums = [2, 3, 4, 9, 10, 11, 12];
    var fx0 = X0 + (wide ? 110 : 34), fx1 = X1 - (wide ? 40 : 14), fsp = (fx1 - fx0) / (nums.length - 1);
    var fart = T(X0 + FW / 2, y + 18, 'FIELD', wide ? 17 : 15, { f: OSW, ls: 4, fill: GOLD });
    nums.forEach(function (v, i) {
      var cx = fx0 + i * fsp, cy = y + (wide ? 50 : 46);
      if (v === 2 || v === 12) fart += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (wide ? 21 : 17) + '" fill="none" stroke="' + GOLD + '" stroke-width="2"/>';
      fart += T(cx, cy + 1, String(v), wide ? 26 : 21, { f: OSW, w: 600 });
    });
    fart += T(X0 + FW / 2, y + fh - 12, '2 PAYS DOUBLE · 12 PAYS TRIPLE · ALL OTHERS 1:1', wide ? 11 : 9, { ls: 1 });
    spot('field', X0, y, FW, fh, fart, 'Field · 3,4,9,10,11 pay 1:1 · 2 pays 2x · 12 pays 3x', { x: X0 + R + 8, y: y + (wide ? 50 : 46) });
    y += fh + 8;

    /* --- Don't Pass --- */
    var dph = 44;
    if (dont) {
      var dpw = wide ? 540 : 236, dpo = FW - dpw - 8;
      spot('dp', X0, y, dpw, dph, T(X0 + dpw / 2 - (wide ? 20 : 16), y + dph / 2, "DON'T PASS BAR", wide ? 20 : 16, { f: OSW, ls: 2 })
        + pair(X0 + dpw / 2 + (wide ? 92 : 68), y + dph / 2, wide ? 18 : 15, 6, 6),
        "Don't Pass · 1:1 · 2,3 win · 12 push", { x: X0 + R + 8, y: y + dph / 2 });
      spot('dpOdds', X0 + dpw + 8, y, dpo, dph, T(X0 + dpw + 8 + dpo / 2 + 12, y + dph / 2 - 7, "DON'T ODDS", wide ? 14 : 12, { f: OSW, ls: 1 })
        + T(X0 + dpw + 8 + dpo / 2 + 12, y + dph / 2 + 10, 'LAY TO WIN 6X', 9, { fill: GOLD }),
        "Don't Pass odds · lay to win up to 6x", { x: X0 + dpw + 8 + R + 8, y: y + dph / 2 });
      y += dph + 8;
    } else {
      L.decor += T(X0 + FW / 2, y + 16, 'CRAPLESS · EVERY NUMBER BUT 7 IS A POINT · NO DON’T BETS', wide ? 12 : 9, { ls: 1.5, fill: GOLD });
      y += 32;
    }

    /* --- Pass line + odds --- */
    var ph = wide ? 54 : 50;
    spot('pass', X0, y, FW, ph, T(X0 + FW / 2, y + ph / 2 + 1, 'PASS LINE', wide ? 32 : 28, { f: OSW, w: 600, ls: 6 })
      + T(X1 - 14, y + ph / 2, '1:1', 11, { a: 'end', fill: GOLD }), 'Pass Line · 1:1', { x: X0 + R + 12, y: y + ph / 2 });
    y += ph + 6;
    var oh = 36;
    spot('passOdds', X0, y, FW, oh, T(X0 + FW / 2, y + oh / 2, 'PASS LINE ODDS · 3X 4X 5X · TRUE ODDS', wide ? 13 : 11, { f: OSW, ls: 2 }),
      'Pass odds · 3x on 4,10' + (dont ? '' : ',2,3,11,12') + ' · 4x on 5,9 · 5x on 6,8', { x: X0 + R + 12, y: y + oh / 2 });
    y += oh;
    var mainBottom = y;

    /* --- Propositions --- */
    var PX, PW, py;
    if (wide) { PX = 878; PW = 1166 - 878; py = 34; }
    else { PX = X0; PW = FW; py = y + 18; L.decor += T(L.W / 2, py + 2, 'PROPOSITIONS', 13, { f: OSW, ls: 4, fill: GOLD }); py += 16; }
    if (wide) { L.decor += T(PX + PW / 2, py + 8, 'PROPOSITIONS', 13, { f: OSW, ls: 4, fill: GOLD }); py += 22; }
    var half = (PW - 8) / 2;
    spot('prop:any7', PX, py, PW, 46, T(PX + PW / 2, py + 24, 'SEVEN', 24, { f: OSW, w: 600, ls: 4, fill: '#ff8a80' })
      + T(PX + 12, py + 24, '4 to 1', 11, { a: 'start', fill: GOLD }) + T(PX + PW - 12, py + 24, '4 to 1', 11, { a: 'end', fill: GOLD }),
      'Any Seven · 4 to 1', { x: PX + PW / 2 + 60, y: py + 23 });
    py += 54;
    var gh = wide ? 76 : 62;
    function cell(k, col, row, a, b, pay, tip) {
      var x = PX + col * (half + 8), yy = py + row * (gh + 8);
      spot(k, x, yy, half, gh, pair(x + half / 2, yy + gh / 2 - 8, wide ? 24 : 20, a, b) + T(x + half / 2, yy + gh - 12, pay, 11, { fill: GOLD }),
        tip, { x: x + half - R - 6, y: yy + R + 6 });
    }
    cell('hard:6', 0, 0, 3, 3, '9 to 1', 'Hard 6 · 9 to 1');
    cell('hard:10', 1, 0, 5, 5, '7 to 1', 'Hard 10 · 7 to 1');
    cell('hard:8', 0, 1, 4, 4, '9 to 1', 'Hard 8 · 9 to 1');
    cell('hard:4', 1, 1, 2, 2, '7 to 1', 'Hard 4 · 7 to 1');
    py += gh * 2 + 16;
    cell('prop:two', 0, 0, 1, 1, '30 to 1', 'Aces (2) · 30 to 1');
    cell('prop:twelve', 1, 0, 6, 6, '30 to 1', 'Boxcars (12) · 30 to 1');
    cell('prop:three', 0, 1, 1, 2, '15 to 1', 'Ace-Deuce (3) · 15 to 1');
    cell('prop:eleven', 1, 1, 5, 6, '15 to 1', 'Yo (11) · 15 to 1');
    py += gh * 2 + 16;
    spot('prop:horn', PX, py, half, 50, T(PX + half / 2 + 10, py + 19, 'HORN', 18, { f: OSW, ls: 2 }) + T(PX + half / 2 + 10, py + 37, '2,12 27:4 · 3,11 3:1', 9, { fill: GOLD }),
      'Horn · 2 or 12 pays 27:4 · 3 or 11 pays 3:1 (bet split four ways)', { x: PX + R + 6, y: py + 25 });
    var cx0 = PX + half + 8;
    spot('prop:ce', cx0, py, half, 50,
      '<circle cx="' + (cx0 + half / 2 - 4) + '" cy="' + (py + 20) + '" r="12" fill="none" stroke="' + LINE + '"/>' + T(cx0 + half / 2 - 4, py + 21, 'C', 14, { f: OSW })
      + '<circle cx="' + (cx0 + half / 2 + 24) + '" cy="' + (py + 20) + '" r="12" fill="none" stroke="' + LINE + '"/>' + T(cx0 + half / 2 + 24, py + 21, 'E', 14, { f: OSW })
      + T(cx0 + half / 2 + 10, py + 41, 'craps 3:1 · 11 7:1', 9, { fill: GOLD }),
      'C & E · any craps pays 3:1 · 11 pays 7:1', { x: cx0 + R + 6, y: py + 25 });
    py += 58;
    spot('prop:anyCraps', PX, py, PW, 46, T(PX + PW / 2, py + 24, 'ANY CRAPS', 22, { f: OSW, w: 600, ls: 3, fill: '#ff8a80' })
      + T(PX + 12, py + 24, '7 to 1', 11, { a: 'start', fill: GOLD }) + T(PX + PW - 12, py + 24, '7 to 1', 11, { a: 'end', fill: GOLD }),
      'Any Craps · 7 to 1', { x: PX + PW / 2 + 78, y: py + 23 });
    py += 54;

    if (wide) {
      L.H = 648;
      L.decor += T(PX + PW / 2, 600, 'BUBBLE CRAPS', 26, { f: OSW, w: 600, ls: 5, fill: 'rgba(255,248,230,.28)' });
      L.decor += T(PX + PW / 2, 624, mode === 'craps' ? 'ODDS 3X · 4X · 5X' : 'CRAPLESS · ODDS 3X · 4X · 5X', 11, { ls: 2, fill: 'rgba(255,248,230,.35)' });
    } else {
      L.H = py + 14;
    }
    L.house = { x: wide ? 450 : L.W / 2, y: -30 };
    L.mainBottom = mainBottom;
    return L;
  }

  root.CrapsLayout = { build: build, dieIcon: dieIcon };
})(this);
