/* The betting window.

   Reaching across a nine-foot table with a crosshair is a poor way to put a
   chip on a split. A real player stands at the rail and puts the chip down
   with their hand; the nearest thing to that on a screen is a layout in front
   of you at a size you can actually hit. So the bets are made in a window and
   the table mirrors them: every chip you put down here lands in the same place
   on the cloth, and when the ball goes the window gets out of the way.

   The window is the layout, not a redrawing of it. It is the same canvas
   felt.js paints onto the table, and a click on it is resolved by the same
   rlayout.js that the table itself uses, so the two cannot drift apart. */
import { rouletteLayout } from './felt.js';
import { keyAt, anchorUV, GEO } from './rlayout.js';

export function createBetPanel(handlers) {
  const root = document.createElement('div');
  root.className = 'bp';
  root.innerHTML = '<div class="bp-wrap">'
    + '<div class="bp-cloth"></div>'
    + '<div class="bp-marks"></div>'
    + '<i class="bp-ring"></i>'
    + '</div>';
  document.body.appendChild(root);

  const wrap = root.querySelector('.bp-wrap');
  const cloth = root.querySelector('.bp-cloth');
  const marks = root.querySelector('.bp-marks');
  const ring = root.querySelector('.bp-ring');

  let american = false, hover = null, live = false;
  const art = {};

  /* What the window shows: the part of the cloth you can bet on, and a
     margin. The rest of it is the name running up the side and bare felt,
     which on a table is where your hands go and in a window is dead space
     that shrinks everything you are trying to hit. */
  const M = { x: 34, y: 44 };
  const CROP = {
    u0: (GEO.left - M.x) / GEO.W,
    u1: (GEO.left + 5 * GEO.cw + M.x) / GEO.W,
    v0: (GEO.top - GEO.zeroH - M.y) / GEO.H,
    v1: (GEO.top + 12 * GEO.ch + GEO.ch * 0.78 + M.y) / GEO.H
  };
  CROP.du = CROP.u1 - CROP.u0;
  CROP.dv = CROP.v1 - CROP.v0;
  const pc = n => (n * 100).toFixed(4) + '%';
  /* a point on the cloth, as a place in the window */
  const px = u => pc((u - CROP.u0) / CROP.du);
  const py = v => pc((v - CROP.v0) / CROP.dv);

  /* one cell as a fraction of the window, for sizing the highlight */
  const CW = (GEO.cw / GEO.W) / CROP.du, CH = (GEO.ch / GEO.H) / CROP.dv;
  /* the chips are drawn off the cell, so they scale with the window */
  wrap.style.setProperty('--ch', (CH * 100).toFixed(3));

  /* The window is shaped like the cloth, not like the canvas the cloth was
     painted on: the artwork is drawn tall and then stretched onto a table that
     is nearly square, so showing the canvas raw would hand you a layout in
     proportions you never see on the felt. */
  function mount(isAmerican, aspect) {
    american = !!isAmerican;
    /* The window is shaped like the piece of cloth it is showing, so what you
       click here has the proportions it has on the felt. */
    if (aspect) wrap.style.aspectRatio = (aspect * CROP.du / CROP.dv).toFixed(4);
    const key = american ? 'a' : 'e';
    if (!art[key]) {
      /* a second drawing of the layout, so the one on the table is untouched */
      const cv = rouletteLayout(american).image;
      cv.className = 'bp-art';
      cv.style.width = pc(1 / CROP.du);
      cv.style.height = pc(1 / CROP.dv);
      cv.style.left = pc(-CROP.u0 / CROP.du);
      cv.style.top = pc(-CROP.v0 / CROP.dv);
      art[key] = cv;
    }
    cloth.textContent = '';
    cloth.appendChild(art[key]);
  }

  function at(e) {
    const r = wrap.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return null;
    return keyAt(CROP.u0 + fx * CROP.du, CROP.v0 + fy * CROP.dv, american);
  }
  function setHover(key) {
    if (key === hover) return;
    hover = key;
    if (!key) { ring.style.display = 'none'; }
    else {
      const a = anchorUV(key, american);
      ring.style.display = '';
      ring.style.left = px(a[0]);
      ring.style.top = py(a[1]);
    }
    if (handlers.hover) handlers.hover(key);
  }

  wrap.addEventListener('mousemove', e => { if (live) setHover(at(e)); });
  wrap.addEventListener('mouseleave', () => setHover(null));
  wrap.addEventListener('mousedown', e => {
    if (!live) return;
    e.preventDefault();
    const key = at(e);
    setHover(key);
    if (key && handlers.pick) handlers.pick(key, e.button === 2);
  });
  wrap.addEventListener('contextmenu', e => e.preventDefault());

  /* the chips, in the same places they sit on the cloth */
  function setBets(bets, colourOf, textOf) {
    marks.textContent = '';
    Object.keys(bets || {}).forEach(key => {
      const amt = bets[key];
      if (!amt) return;
      const a = anchorUV(key, american);
      const col = colourOf(amt);
      const el = document.createElement('b');
      el.className = 'bp-chip';
      el.style.left = px(a[0]);
      el.style.top = py(a[1]);
      el.style.setProperty('--col', col[0]);
      el.style.color = col[1];
      el.textContent = '';
      const v = document.createElement('span');
      v.textContent = textOf(amt);
      el.appendChild(v);
      marks.appendChild(el);
    });
  }

  function show() { live = true; root.classList.add('on'); }
  function hide() { live = false; setHover(null); root.classList.remove('on'); }
  function close() { hide(); marks.textContent = ''; }

  /* the ring is a cell high and wide, so a straight reads as a cell and a
     split as the line between two */
  ring.style.width = 'calc(' + pc(CW) + ' + 2px)';
  ring.style.height = 'calc(' + pc(CH) + ' + 2px)';

  return {
    mount, setBets, show, hide, close,
    get hover() { return hover; },
    get shown() { return live; },
    /* the tests click it where a person would */
    rectFor(key) {
      const r = wrap.getBoundingClientRect();
      const a = anchorUV(key, american);
      return {
        x: r.left + ((a[0] - CROP.u0) / CROP.du) * r.width,
        y: r.top + ((a[1] - CROP.v0) / CROP.dv) * r.height
      };
    },
    pickAt(u, v) { return keyAt(u, v, american); },
    el: root, wrapEl: wrap
  };
}
