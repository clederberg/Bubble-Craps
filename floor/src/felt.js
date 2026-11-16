/* The layouts, drawn onto canvases and used as the felt texture. A table reads
   as a real table mostly because of the line work on it, so this is where the
   realism comes from rather than from the geometry. */
import * as THREE from 'three';
import { tune } from './materials.js';
import { GEO as ROULETTE_GEO, numberUV } from './rlayout.js';
export { ROULETTE_GEO, numberUV };

const GREEN = '#0d4727', LINE = '#f4efdf', GOLD = '#e8c45f', RED = '#c0392b';

function felt(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = GREEN;
  x.fillRect(0, 0, w, h);
  /* a slow blotchy wash so the cloth is not a flat colour */
  for (let i = 0; i < 2200; i++) {
    const r = 30 + Math.random() * 90;
    x.globalAlpha = 0.02;
    x.fillStyle = Math.random() < 0.5 ? '#0a3a1f' : '#13552f';
    x.beginPath();
    x.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2);
    x.fill();
  }
  x.globalAlpha = 1;
  return { c, x };
}
function textured(c, repeatY) {
  const t = tune(new THREE.CanvasTexture(c));
  return t;
}
function label(x, text, cx, cy, size, colour = LINE, weight = 700, spacing = 2, font = 'Oswald, Arial') {
  x.save();
  x.translate(cx, cy);
  x.fillStyle = colour;
  x.font = `${weight} ${size}px ${font}`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  if (spacing) {
    const chars = text.split('');
    const widths = chars.map(ch => x.measureText(ch).width + spacing);
    const total = widths.reduce((a, b) => a + b, 0) - spacing;
    let px = -total / 2;
    chars.forEach((ch, i) => { x.fillText(ch, px + widths[i] / 2 - spacing / 2, 0); px += widths[i]; });
  } else x.fillText(text, 0, 0);
  x.restore();
}
function boxOutline(x, bx, by, bw, bh, r = 10, colour = LINE, lw = 4) {
  x.strokeStyle = colour;
  x.lineWidth = lw;
  x.beginPath();
  x.roundRect(bx, by, bw, bh, r);
  x.stroke();
}

/* ---------------- craps ----------------
   Half the layout is drawn and then mirrored, which is how the real cloth is
   laid out: the stickman's propositions in the middle, a player's end either
   side of him. */
export function crapsLayout(crapless) {
  const W = 2400, H = 820;
  const { c, x } = felt(W, H);
  const nums = crapless ? [2, 3, 4, 5, 6, 8, 9, 10, 11, 12] : [4, 5, 6, 8, 9, 10];
  const names = { 6: 'SIX', 9: 'NINE' };

  /* Both ends carry the same layout the same way up. A real cloth is drawn
     that way because players stand along both long sides, and mirroring it
     would leave half the table reading backwards. */
  function end(ox) {
    x.save();
    x.translate(ox, 0);
    const w = 820;

    /* place numbers across the top */
    const cw = w / nums.length;
    nums.forEach((n, i) => {
      const bx = i * cw + 4, by = 26, bw = cw - 8, bh = 150;
      boxOutline(x, bx, by, bw, bh, 8);
      label(x, String(names[n] || n), bx + bw / 2, by + bh * 0.42, nums.length > 7 ? 54 : 70, LINE, 700, 1);
      label(x, 'BUY', bx + bw / 2, by + bh * 0.8, 17, GOLD, 600, 2);
    });

    /* come */
    boxOutline(x, 10, 196, w - 20, 150, 10);
    label(x, 'COME', w / 2, 272, 86, LINE, 700, 14);

    /* field */
    boxOutline(x, 10, 356, w - 20, 120, 10);
    const f = [2, 3, 4, 9, 10, 11, 12];
    f.forEach((n, i) => {
      const fx = 40 + (w - 80) * (i + 0.5) / f.length;
      const big = n === 2 || n === 12;
      if (big) {
        x.strokeStyle = GOLD; x.lineWidth = 3;
        x.beginPath(); x.arc(fx, 416, 32, 0, Math.PI * 2); x.stroke();
      }
      label(x, String(n), fx, 416, 46, big ? GOLD : LINE, 700, 0);
    });
    label(x, 'FIELD', w / 2, 374, 20, GOLD, 600, 6);

    /* pass line sweeping along the bottom, with don't pass inside it */
    x.strokeStyle = LINE; x.lineWidth = 5;
    x.beginPath();
    x.moveTo(14, 500); x.lineTo(w - 14, 500);
    x.lineTo(w - 14, 790); x.lineTo(14, 790);
    x.closePath(); x.stroke();
    label(x, 'PASS LINE', w / 2, 742, 56, LINE, 700, 12);
    if (!crapless) {
      x.strokeStyle = LINE; x.lineWidth = 3;
      x.beginPath(); x.roundRect(30, 512, w - 60, 86, 8); x.stroke();
      label(x, "DON'T PASS BAR", w / 2 - 40, 556, 30, LINE, 600, 5);
      label(x, '12', w / 2 + 210, 556, 34, RED, 700, 0);
    } else {
      label(x, 'EVERY NUMBER BUT 7 IS A POINT', w / 2, 556, 26, GOLD, 600, 5);
    }
    x.restore();
  }

  end(0);
  end(W - 820);

  /* the propositions in the middle */
  const px = 830, pw = W - 1660;
  x.fillStyle = 'rgba(0,0,0,.18)';
  x.fillRect(px, 20, pw, H - 40);
  boxOutline(x, px, 20, pw, H - 40, 12, GOLD, 4);
  label(x, 'SEVEN', px + pw / 2, 76, 44, RED, 700, 8);
  const hard = [[4, '7 TO 1'], [6, '9 TO 1'], [8, '9 TO 1'], [10, '7 TO 1']];
  hard.forEach(([n, pay], i) => {
    const bw = pw / 2 - 24, bh = 120;
    const bx = px + 14 + (i % 2) * (pw / 2), by = 130 + Math.floor(i / 2) * (bh + 14);
    boxOutline(x, bx, by, bw, bh, 8);
    label(x, 'HARD ' + n, bx + bw / 2, by + bh * 0.4, 34, LINE, 700, 2);
    label(x, pay, bx + bw / 2, by + bh * 0.75, 20, GOLD, 600, 2);
  });
  boxOutline(x, px + 14, 400, pw - 28, 110, 8);
  label(x, 'ANY CRAPS', px + pw / 2, 445, 32, LINE, 700, 4);
  label(x, '7 TO 1', px + pw / 2, 485, 20, GOLD, 600, 2);
  boxOutline(x, px + 14, 526, pw - 28, 110, 8);
  label(x, 'HORN', px + pw / 2, 570, 32, LINE, 700, 4);
  label(x, '2 12  27:4   3 11  7:1', px + pw / 2, 610, 18, GOLD, 600, 1);
  label(x, crapless ? 'CRAPLESS' : 'CRAPS', px + pw / 2, 700, 40, GOLD, 700, 10);
  label(x, 'C M L', px + pw / 2, 758, 22, 'rgba(244,239,223,.45)', 600, 8, 'Cinzel, serif');

  return textured(c);
}

/* ---------------- blackjack ---------------- */
export function blackjackLayout() {
  const W = 1600, H = 1000;
  const { c, x } = felt(W, H);
  /* the dealer's arc */
  x.strokeStyle = GOLD; x.lineWidth = 5;
  x.beginPath(); x.arc(W / 2, -120, 560, 0.35, Math.PI - 0.35); x.stroke();
  label(x, 'BLACKJACK PAYS 3 TO 2', W / 2, 330, 54, GOLD, 700, 8);
  label(x, 'DEALER MUST DRAW TO 16 AND STAND ON ALL 17s', W / 2, 400, 28, LINE, 600, 4);
  /* insurance */
  x.strokeStyle = LINE; x.lineWidth = 4;
  x.beginPath(); x.arc(W / 2, 250, 470, 0.72, Math.PI - 0.72); x.stroke();
  label(x, 'INSURANCE PAYS 2 TO 1', W / 2, 560, 30, LINE, 600, 5);
  /* five spots */
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (0.22 + 0.14 * i);
    const sx = W / 2 - Math.cos(a) * 520, sy = 300 + Math.sin(a) * 430;
    x.strokeStyle = GOLD; x.lineWidth = 5;
    x.beginPath(); x.arc(sx, sy, 62, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = 'rgba(244,239,223,.35)'; x.lineWidth = 3;
    x.beginPath(); x.arc(sx, sy, 48, 0, Math.PI * 2); x.stroke();
  }
  label(x, 'C M L', W / 2, 680, 26, 'rgba(244,239,223,.4)', 600, 9, 'Cinzel, serif');
  return textured(c);
}

/* ---------------- ultimate texas hold'em ----------------
   Five seats, each with its own trips, ante, blind and play boxes stacked the
   way they are on a real UTH felt, and the board across the middle where the
   community cards come out. The paytables are the ones in uth.js, written out
   so the table tells you what it pays without opening the rules. */
export function uthLayout() {
  const W = 1600, H = 1000;
  const { c, x } = felt(W, H);

  label(x, "ULTIMATE TEXAS HOLD'EM", W / 2, 96, 50, GOLD, 700, 9);
  label(x, 'BLIND PAYS ON A STRAIGHT OR BETTER  \u00b7  TRIPS ALWAYS PAYS', W / 2, 152, 24, LINE, 600, 3);

  /* the two paytables, one either side of the board */
  const pays = (cx, cy, title, rows, accent) => {
    x.strokeStyle = accent; x.lineWidth = 4;
    x.beginPath(); x.roundRect(cx - 170, cy, 340, 44 + rows.length * 32, 10); x.stroke();
    label(x, title, cx, cy + 26, 24, accent, 700, 5);
    rows.forEach((r, i) => {
      const y = cy + 62 + i * 32;
      x.fillStyle = 'rgba(244,239,223,.82)';
      x.font = '600 21px Oswald, Arial';
      x.textAlign = 'left';  x.textBaseline = 'middle';
      x.fillText(r[0], cx - 152, y);
      x.textAlign = 'right';
      x.fillText(r[1], cx + 152, y);
    });
    x.textAlign = 'center';
  };
  pays(300, 210, 'BLIND', [
    ['Royal flush', '500 to 1'], ['Straight flush', '50 to 1'], ['Four of a kind', '10 to 1'],
    ['Full house', '3 to 1'], ['Flush', '3 to 2'], ['Straight', '1 to 1']
  ], GOLD);
  pays(W - 300, 210, 'TRIPS', [
    ['Royal flush', '50 to 1'], ['Straight flush', '40 to 1'], ['Four of a kind', '30 to 1'],
    ['Full house', '8 to 1'], ['Flush', '6 to 1'], ['Straight', '5 to 1'], ['Three of a kind', '3 to 1']
  ], LINE);

  /* the board: five community cards across the middle of the table */
  for (let i = 0; i < 5; i++) {
    const cx = W / 2 + (i - 2) * 112;
    x.strokeStyle = 'rgba(244,239,223,.4)'; x.lineWidth = 3;
    x.beginPath(); x.roundRect(cx - 44, 452, 88, 124, 8); x.stroke();
  }
  label(x, 'BOARD', W / 2, 428, 22, 'rgba(244,239,223,.55)', 600, 6);

  /* five betting positions along the players' edge */
  const box = (cx, cy, w, h, stroke, text, size) => {
    x.strokeStyle = stroke; x.lineWidth = 4;
    x.beginPath(); x.roundRect(cx - w / 2, cy, w, h, 8); x.stroke();
    label(x, text, cx, cy + h / 2, size, stroke, 700, 4);
  };
  for (let i = 0; i < 5; i++) {
    const cx = W / 2 + (i - 2) * 290;
    /* trips sits out to the side; ante and blind are a pair; play is in front */
    box(cx - 104, 650, 86, 52, LINE, 'TRIPS', 19);
    box(cx - 2, 650, 104, 52, GOLD, 'ANTE', 21);
    box(cx + 104, 650, 86, 52, GOLD, 'BLIND', 19);
    box(cx, 722, 212, 60, LINE, 'PLAY', 24);
  }
  label(x, 'C M L', W / 2, 836, 26, 'rgba(244,239,223,.4)', 600, 9, 'Cinzel, serif');
  return textured(c);
}

/* ---------------- baccarat ---------------- */
export function baccaratLayout() {
  const W = 1800, H = 1000;
  const { c, x } = felt(W, H);
  label(x, 'BACCARAT', W / 2, 120, 58, GOLD, 700, 12);
  label(x, 'BANKER PAYS 1 TO 1 LESS 5%   ·   TIE PAYS 8 TO 1', W / 2, 185, 26, LINE, 600, 3);
  for (let i = 0; i < 7; i++) {
    const cx = 170 + i * ((W - 340) / 6);
    x.strokeStyle = LINE; x.lineWidth = 4;
    x.beginPath(); x.roundRect(cx - 95, 300, 190, 110, 10); x.stroke();
    label(x, 'PLAYER', cx, 355, 28, LINE, 600, 3);
    x.strokeStyle = GOLD;
    x.beginPath(); x.roundRect(cx - 95, 430, 190, 110, 10); x.stroke();
    label(x, 'BANKER', cx, 485, 28, GOLD, 600, 3);
    x.strokeStyle = RED;
    x.beginPath(); x.roundRect(cx - 68, 560, 136, 86, 10); x.stroke();
    label(x, 'TIE', cx, 603, 26, RED, 600, 4);
    label(x, String(i + 1), cx, 690, 30, 'rgba(244,239,223,.5)', 700, 0);
  }
  label(x, 'C M L', W / 2, 860, 26, 'rgba(244,239,223,.4)', 600, 9, 'Cinzel, serif');
  return textured(c);
}

/* ---------------- the lit sign over a table ---------------- */
export function signTexture(text, colour) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#0b0609';
  x.fillRect(0, 0, 512, 128);
  x.strokeStyle = colour;
  x.lineWidth = 5;
  x.strokeRect(10, 10, 492, 108);
  x.fillStyle = colour;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  /* a long name is set smaller rather than run off the ends of its own sign */
  const chars = text.split('');
  let size = 52, sp = 7, widths, total;
  for (;;) {
    x.font = '700 ' + size + 'px Oswald, Arial';
    widths = chars.map(ch => x.measureText(ch).width + sp);
    total = widths.reduce((a, b) => a + b, 0) - sp;
    if (total <= 452 || size <= 22) break;
    size -= 2;
    sp = Math.max(3, sp - 0.3);
  }
  let px = 256 - total / 2;
  chars.forEach((ch, i) => { x.fillText(ch, px + widths[i] / 2 - sp / 2, 68); px += widths[i]; });
  const t = tune(new THREE.CanvasTexture(c));
  return t;
}

/* The roulette cloth. The table is long and narrow, with the wheel at the far
   end, so the layout is drawn running away from the player: the zero and the
   number grid along the length, the dozens and the even-money boxes beside
   them, the way a real single-zero table reads from the seat. */
export function rouletteLayout(american) {
  const W = ROULETTE_GEO.W, H = ROULETTE_GEO.H;
  const { c, x } = felt(W, H);
  const REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const isRed = n => REDS.indexOf(n) >= 0;

  /* the grid runs up the cloth: twelve streets of three. The measurements
     come from rlayout.js, which is also what the table in the room picks
     bets with, so the picture and the picking cannot drift apart. */
  const left = ROULETTE_GEO.left, cw = ROULETTE_GEO.cw, ch = ROULETTE_GEO.ch;
  const top = ROULETTE_GEO.top, zeroH = ROULETTE_GEO.zeroH;
  x.lineWidth = 4;
  x.strokeStyle = LINE;

  /* zero (and double zero) across the head of the grid */
  const cell = (cx, cy, w, h, fill, text, size = 52) => {
    x.fillStyle = fill;
    x.fillRect(cx, cy, w, h);
    x.strokeRect(cx, cy, w, h);
    if (text != null) label(x, String(text), cx + w / 2, cy + h / 2, size, LINE, 700, 3);
  };
  if (american) {
    cell(left, top - zeroH, cw * 1.5, zeroH, '#0e6b41', '0', 58);
    cell(left + cw * 1.5, top - zeroH, cw * 1.5, zeroH, '#0e6b41', '00', 58);
  } else {
    cell(left, top - zeroH, cw * 3, zeroH, '#0e6b41', '0', 64);
  }
  for (let s = 0; s < 12; s++) {
    for (let p = 0; p < 3; p++) {
      const n = s * 3 + p + 1;
      cell(left + p * cw, top + s * ch, cw, ch, isRed(n) ? '#a52f23' : '#1d1a23', n);
    }
  }
  /* the dozens run beside the grid */
  const dozX = left + cw * 3;
  ['1st 12', '2nd 12', '3rd 12'].forEach((t, i) => {
    const cy = top + i * ch * 4;
    x.fillStyle = 'rgba(0,0,0,.25)';
    x.fillRect(dozX, cy, cw, ch * 4);
    x.strokeRect(dozX, cy, cw, ch * 4);
    x.save();
    x.translate(dozX + cw / 2, cy + ch * 2);
    x.rotate(Math.PI / 2);
    label(x, t.toUpperCase(), 0, 0, 40, LINE, 700, 6);
    x.restore();
  });
  /* and the even-money boxes beside those */
  const evX = dozX + cw;
  const ev = ['1 to 18', 'EVEN', 'RED', 'BLACK', 'ODD', '19 to 36'];
  ev.forEach((t, i) => {
    const cy = top + i * ch * 2;
    x.fillStyle = t === 'RED' ? '#a52f23' : t === 'BLACK' ? '#1d1a23' : 'rgba(0,0,0,.25)';
    x.fillRect(evX, cy, cw, ch * 2);
    x.strokeRect(evX, cy, cw, ch * 2);
    x.save();
    x.translate(evX + cw / 2, cy + ch);
    x.rotate(Math.PI / 2);
    label(x, t.toUpperCase(), 0, 0, 34, LINE, 700, 5);
    x.restore();
  });
  /* the 2 to 1 column boxes at the foot */
  for (let p = 0; p < 3; p++) {
    cell(left + p * cw, top + 12 * ch, cw, ch * 0.78, 'rgba(0,0,0,.25)', null);
    label(x, '2 TO 1', left + p * cw + cw / 2, top + 12 * ch + ch * 0.39, 30, LINE, 700, 4);
  }
  /* The name runs up the margin beside the grid, the way it does on a real
     cloth. Set horizontally it is wider than the margin and the last letters
     end up sitting on the numbers. */
  const upright = (text, y, size, colour, weight, spacing, font) => {
    x.save();
    x.translate(74, y);
    x.rotate(Math.PI / 2);
    label(x, text, 0, 0, size, colour, weight, spacing, font);
    x.restore();
  };
  upright(american ? 'AMERICAN ROULETTE' : 'ROULETTE', H / 2 - 170, 44, GOLD, 700, 10);
  upright('C M L', H / 2 + 330, 26, 'rgba(244,239,223,.45)', 600, 9, 'Cinzel, serif');
  return textured(c);
}

/* The face of the wheel, seen from above: the pocket ring, the frets and the
   numbers. Drawn rather than modelled, because thirty-seven little wedges of
   geometry cost far more than one texture and look no better from a seat. */
export function wheelFace(american) {
  const S = 1024, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const order = american
    ? [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1,
      '00', 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2]
    : [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
      5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const cx = S / 2, cy = S / 2, N = order.length;
  const rOut = S * 0.49, rIn = S * 0.345, rHub = S * 0.3;

  x.fillStyle = '#16100a';
  x.beginPath(); x.arc(cx, cy, rOut, 0, Math.PI * 2); x.fill();
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2 - Math.PI / 2 - Math.PI / N;
    const a1 = a0 + (Math.PI * 2) / N;
    const n = order[i];
    x.fillStyle = n === 0 || n === '00' ? '#0e6b41' : (REDS.indexOf(n) >= 0 ? '#9e2a20' : '#16141c');
    x.beginPath();
    x.arc(cx, cy, rOut, a0, a1);
    x.arc(cx, cy, rIn, a1, a0, true);
    x.closePath(); x.fill();
    /* the fret between pockets */
    x.strokeStyle = 'rgba(232,206,150,.75)';
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(cx + Math.cos(a0) * rIn, cy + Math.sin(a0) * rIn);
    x.lineTo(cx + Math.cos(a0) * rOut, cy + Math.sin(a0) * rOut);
    x.stroke();
    /* the number, standing on its head toward the rim */
    const mid = (a0 + a1) / 2, tr = (rIn + rOut) / 2;
    x.save();
    x.translate(cx + Math.cos(mid) * tr, cy + Math.sin(mid) * tr);
    x.rotate(mid + Math.PI / 2);
    x.fillStyle = '#fff4de';
    x.font = '700 ' + Math.round(S * 0.038) + 'px Oswald, Arial';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(String(n), 0, 0);
    x.restore();
  }
  /* the cone in the middle, and the turret */
  const g = x.createRadialGradient(cx, cy, S * 0.04, cx, cy, rHub);
  g.addColorStop(0, '#9a7336');
  g.addColorStop(0.55, '#4a3118');
  g.addColorStop(1, '#241708');
  x.fillStyle = g;
  x.beginPath(); x.arc(cx, cy, rHub, 0, Math.PI * 2); x.fill();
  x.strokeStyle = 'rgba(232,206,150,.5)'; x.lineWidth = 4;
  x.beginPath(); x.arc(cx, cy, rHub, 0, Math.PI * 2); x.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    x.strokeStyle = 'rgba(232,206,150,.3)'; x.lineWidth = 7;
    x.beginPath();
    x.moveTo(cx, cy);
    x.lineTo(cx + Math.cos(a) * (rHub - 10), cy + Math.sin(a) * (rHub - 10));
    x.stroke();
  }
  x.fillStyle = '#c9962b';
  x.beginPath(); x.arc(cx, cy, S * 0.055, 0, Math.PI * 2); x.fill();
  return textured(c);
}

/* What a table's terminal shows when nobody is sitting at it. A page of felt
   shrunk onto a 10-inch screen is unreadable, so it gets its own card: the
   game's name, and an invitation. */
export function terminalIdle(title, sub, accent = GOLD) {
  const W = 720, H = 490, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#13251c');
  g.addColorStop(1, '#070f0b');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(232,196,95,.5)';
  x.lineWidth = 4;
  x.strokeRect(16, 16, W - 32, H - 32);
  x.strokeStyle = 'rgba(232,196,95,.2)';
  x.lineWidth = 2;
  x.strokeRect(28, 28, W - 56, H - 56);
  label(x, title.toUpperCase(), W / 2, H / 2 - 54, 58, accent, 700, 10);
  label(x, sub.toUpperCase(), W / 2, H / 2 + 10, 22, 'rgba(244,239,223,.65)', 600, 7);
  label(x, 'C M L   C A S I N O', W / 2, H - 76, 20, 'rgba(232,196,95,.55)', 600, 8, 'Cinzel, serif');
  /* a bar of chips along the bottom, so it reads as a betting terminal */
  const cols = ['#ece6d6', '#c9392f', '#2f8a4f', '#1d1d1f', '#6b3fa0', '#d1a12f'];
  cols.forEach((col, i) => {
    const cx = W / 2 + (i - (cols.length - 1) / 2) * 56;
    x.fillStyle = col;
    x.beginPath(); x.arc(cx, H - 36, 17, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.5)';
    x.lineWidth = 2;
    x.beginPath(); x.arc(cx, H - 36, 11, 0, Math.PI * 2); x.stroke();
  });
  return textured(c);
}

/* ---------------- the number board ----------------
   The board beside the wheel that every roulette table has: the numbers that
   have come up, newest at the top, in the colour they fell. It is redrawn in
   place rather than rebuilt, so the table can push a number onto it the moment
   the dealer marks one. */
export function numberBoard() {
  const W = 300, H = 560, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const tex = textured(c);
  const COLS = { red: '#b2302a', black: '#1d1a23', green: '#0e6b41' };
  function draw(list) {
    x.fillStyle = '#07100c';
    x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(232,196,95,.45)';
    x.lineWidth = 3;
    x.strokeRect(10, 10, W - 20, H - 20);
    label(x, 'LAST NUMBERS', W / 2, 44, 20, 'rgba(232,196,95,.8)', 600, 5);
    x.strokeStyle = 'rgba(232,196,95,.22)';
    x.lineWidth = 2;
    x.beginPath(); x.moveTo(26, 64); x.lineTo(W - 26, 64); x.stroke();
    const rows = (list || []).slice(0, 12);
    if (!rows.length) {
      label(x, 'TABLE OPEN', W / 2, H / 2, 22, 'rgba(244,239,223,.4)', 600, 6);
    }
    rows.forEach((h, i) => {
      const big = i === 0;
      const cy = 104 + i * 38 + (big ? 6 : 14);
      const r = big ? 28 : 15;
      x.fillStyle = COLS[h.colour] || COLS.green;
      x.beginPath(); x.arc(W / 2, cy, r, 0, Math.PI * 2); x.fill();
      x.strokeStyle = 'rgba(255,248,230,' + (big ? 0.7 : 0.3) + ')';
      x.lineWidth = big ? 3 : 2;
      x.stroke();
      label(x, String(h.n), W / 2, cy + 1, big ? 30 : 17, '#fff', 700, 1);
    });
    tex.needsUpdate = true;
  }
  draw([]);
  return { texture: tex, draw };
}
