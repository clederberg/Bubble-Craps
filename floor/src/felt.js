/* The layouts, drawn onto canvases and used as the felt texture. A table reads
   as a real table mostly because of the line work on it, so this is where the
   realism comes from rather than from the geometry. */
import * as THREE from 'three';

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
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
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
  x.font = '700 52px Oswald, Arial';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  const chars = text.split('');
  const sp = 7;
  const widths = chars.map(ch => x.measureText(ch).width + sp);
  const total = widths.reduce((a, b) => a + b, 0) - sp;
  let px = 256 - total / 2;
  chars.forEach((ch, i) => { x.fillText(ch, px + widths[i] / 2 - sp / 2, 68); px += widths[i]; });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
