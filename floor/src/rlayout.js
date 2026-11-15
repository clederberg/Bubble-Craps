/* The roulette cloth, as geometry rather than as a picture.

   felt.js draws the layout from these numbers and the table in the room picks
   bets off it with them, so a click on the felt and the line it was drawn
   between can never disagree. Nothing in here touches THREE or the DOM, which
   is what lets it be tested on its own.

   The cloth is drawn on a 900 x 1800 canvas. The number grid runs away from
   the player: twelve streets of three, with the zero across the head of it,
   the dozens down one side and the even-money boxes beyond those. */

export const GEO = { W: 900, H: 1800, left: 150, cw: 118, ch: 118, top: 250, zeroH: 150 };

const G = GEO;
const gridX0 = G.left, gridX1 = G.left + 3 * G.cw;
const gridY0 = G.top, gridY1 = G.top + 12 * G.ch;
const zeroY0 = G.top - G.zeroH;
const dozX0 = gridX1, dozX1 = dozX0 + G.cw;
const evX0 = dozX1, evX1 = evX0 + G.cw;
const colY1 = gridY1 + G.ch * 0.78;
/* how close to a line a chip has to be to count as on it */
const T = 27;

const at = (s, p) => s * 3 + p + 1;
const EVENS = ['low', 'even', 'red', 'black', 'odd', 'high'];

function sortNums(nums) {
  return nums.slice().sort((a, b) => {
    if (a === '00') return b === 0 ? 1 : -1;
    if (b === '00') return a === 0 ? -1 : 1;
    return a - b;
  });
}
const keyOf = (prefix, nums) => prefix + ':' + sortNums(nums).join('-');

/* ---------------- a number's cell ---------------- */
export function numberUV(n, american) {
  if (n === 0 || n === '00') {
    const x = american ? G.left + G.cw * (n === 0 ? 0.75 : 2.25) : G.left + G.cw * 1.5;
    return [x / G.W, (G.top - G.zeroH / 2) / G.H];
  }
  const s = Math.floor((n - 1) / 3), p = (n - 1) % 3;
  return [(G.left + (p + 0.5) * G.cw) / G.W, (G.top + (s + 0.5) * G.ch) / G.H];
}

/* ---------------- where a bet's chips sit ---------------- */
export function anchorUV(key, american) {
  const uv = (x, y) => [x / G.W, y / G.H];
  const pre = key.split(':')[0];
  if (key === 'basket') return uv(gridX0, gridY0);
  if (pre === 'col') {
    const i = +key.slice(4) - 1;
    return uv(G.left + (i + 0.5) * G.cw, (gridY1 + colY1) / 2);
  }
  if (pre === 'doz') {
    const i = +key.slice(4) - 1;
    return uv((dozX0 + dozX1) / 2, gridY0 + (i + 0.5) * 4 * G.ch);
  }
  if (EVENS.indexOf(key) >= 0) {
    const i = EVENS.indexOf(key);
    return uv((evX0 + evX1) / 2, gridY0 + (i + 0.5) * 2 * G.ch);
  }
  const nums = key.slice(key.indexOf(':') + 1).split('-')
    .map(x => (x === '00' ? '00' : +x));
  if (pre === 's') return numberUV(nums[0], american);
  const greens = nums.filter(n => n === 0 || n === '00').length;
  if (greens) {
    /* everything that touches a zero sits on the line below it */
    if (key === 'p:0-00') return uv(G.left + G.cw * 1.5, G.top - G.zeroH / 2);
    const plain = nums.filter(n => n !== 0 && n !== '00');
    if (plain.length === 1) {
      const p0 = (plain[0] - 1) % 3;
      /* on an American cloth the divider between the greens runs up the
         middle of the second column, so its two splits sit either side of it
         rather than both on the line itself */
      if (american && p0 === 1) {
        return uv(G.left + G.cw * (nums.indexOf(0) >= 0 ? 1.3 : 1.7), gridY0);
      }
      return uv(G.left + (p0 + 0.5) * G.cw, gridY0);
    }
    /* a trio sits on the vertical line between its two numbers */
    const ps = plain.map(n => (n - 1) % 3);
    return uv(G.left + (Math.max.apply(null, ps)) * G.cw, gridY0);
  }
  const cells = nums.map(n => ({ s: Math.floor((n - 1) / 3), p: (n - 1) % 3 }));
  const smin = Math.min.apply(null, cells.map(c => c.s));
  const smax = Math.max.apply(null, cells.map(c => c.s));
  const pmin = Math.min.apply(null, cells.map(c => c.p));
  const pmax = Math.max.apply(null, cells.map(c => c.p));
  if (pre === 't') return uv(gridX0, G.top + (smin + 0.5) * G.ch);
  if (pre === 'l') return uv(gridX0, G.top + (smax) * G.ch);
  if (pre === 'c') return uv(G.left + pmax * G.cw, G.top + smax * G.ch);
  if (pre === 'p') {
    if (smin === smax) return uv(G.left + pmax * G.cw, G.top + (smin + 0.5) * G.ch);
    return uv(G.left + (pmin + 0.5) * G.cw, G.top + smax * G.ch);
  }
  return uv((gridX0 + gridX1) / 2, (gridY0 + gridY1) / 2);
}

/* ---------------- what is under a point on the cloth ---------------- */
export function keyAt(u, v, american) {
  const cx = u * G.W, cy = v * G.H;

  /* the 2 to 1 boxes at the foot of the grid */
  if (cy >= gridY1 && cy <= colY1 && cx >= gridX0 && cx <= gridX1) {
    const p = Math.min(2, Math.max(0, Math.floor((cx - gridX0) / G.cw)));
    return 'col:' + (p + 1);
  }
  /* the dozens and the even-money boxes down the side */
  if (cy >= gridY0 && cy <= gridY1) {
    if (cx > gridX1 && cx <= dozX1) {
      return 'doz:' + (Math.min(2, Math.floor((cy - gridY0) / (4 * G.ch))) + 1);
    }
    if (cx > dozX1 && cx <= evX1) {
      return EVENS[Math.min(5, Math.floor((cy - gridY0) / (2 * G.ch)))];
    }
  }
  if (cx < gridX0 - T || cx > gridX1 + T) return null;

  /* the line along the head of the grid, where everything touching a zero
     is laid: the first four at the corner, trios on the uprights, and the
     zero splits over each of the three numbers */
  if (Math.abs(cy - gridY0) <= T && cx >= gridX0 - T && cx <= gridX1) {
    if (Math.abs(cx - gridX0) <= T) return 'basket';
    const gx = (cx - gridX0) / G.cw;
    const vi = Math.round(gx);
    if (vi > 0 && vi < 3 && Math.abs(gx - vi) * G.cw <= T) {
      return american
        ? (vi === 1 ? 't:0-1-2' : 't:2-3-00')
        : (vi === 1 ? 't:0-1-2' : 't:0-2-3');
    }
    const p = Math.min(2, Math.max(0, Math.floor(gx)));
    const n = at(0, p);
    if (!american) return keyOf('p', [0, n]);
    if (p === 0) return 'p:0-1';
    if (p === 2) return 'p:3-00';
    /* the middle number touches both greens; the divider between them runs
       up its centre line */
    return cx < G.left + G.cw * 1.5 ? 'p:0-2' : 'p:2-00';
  }

  /* the zero row itself */
  if (cy >= zeroY0 && cy < gridY0 && cx >= gridX0 && cx <= gridX1) {
    if (!american) return 's:0';
    const mid = G.left + G.cw * 1.5;
    if (Math.abs(cx - mid) <= T) return 'p:0-00';
    return cx < mid ? 's:0' : 's:00';
  }

  if (cy < gridY0 || cy > gridY1) return null;

  /* inside the grid: work out which lines the point is near */
  const gx = (cx - gridX0) / G.cw, gy = (cy - gridY0) / G.ch;
  const p = Math.min(2, Math.max(0, Math.floor(gx)));
  const s = Math.min(11, Math.max(0, Math.floor(gy)));
  const vi = Math.round(gx), hi = Math.round(gy);
  const onV = Math.abs(gx - vi) * G.cw <= T;
  const onH = Math.abs(gy - hi) * G.ch <= T;

  if (onV && vi === 0) {
    /* the outer line: streets along it, six lines where two rows meet */
    if (onH && hi > 0 && hi < 12) return keyOf('l', [at(hi - 1, 0), at(hi - 1, 1), at(hi - 1, 2), at(hi, 0), at(hi, 1), at(hi, 2)]);
    return keyOf('t', [at(s, 0), at(s, 1), at(s, 2)]);
  }
  if (onV && onH && vi > 0 && vi < 3 && hi > 0 && hi < 12) {
    return keyOf('c', [at(hi - 1, vi - 1), at(hi - 1, vi), at(hi, vi - 1), at(hi, vi)]);
  }
  if (onV && vi > 0 && vi < 3) return keyOf('p', [at(s, vi - 1), at(s, vi)]);
  if (onH && hi > 0 && hi < 12) return keyOf('p', [at(hi - 1, p), at(hi, p)]);
  return 's:' + at(s, p);
}
