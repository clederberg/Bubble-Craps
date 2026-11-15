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

  /* one cell as a fraction of the window, for sizing the highlight */
  const CW = GEO.cw / GEO.W, CH = GEO.ch / GEO.H;

  /* The window is shaped like the cloth, not like the canvas the cloth was
     painted on: the artwork is drawn tall and then stretched onto a table that
     is nearly square, so showing the canvas raw would hand you a layout in
     proportions you never see on the felt. */
  function mount(isAmerican, aspect) {
    american = !!isAmerican;
    if (aspect) wrap.style.aspectRatio = aspect.toFixed(4);
    if (!art[american ? 'a' : 'e']) {
      /* the layout texture's own canvas, drawn once and then shown as an
         image so the table's copy is never touched */
      art[american ? 'a' : 'e'] = rouletteLayout(american).image.toDataURL('image/png');
    }
    cloth.style.backgroundImage = 'url(' + art[american ? 'a' : 'e'] + ')';
  }

  function at(e) {
    const r = wrap.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;
    return keyAt(u, v, american);
  }
  function setHover(key) {
    if (key === hover) return;
    hover = key;
    if (!key) { ring.style.display = 'none'; }
    else {
      const a = anchorUV(key, american);
      ring.style.display = '';
      ring.style.left = (a[0] * 100) + '%';
      ring.style.top = (a[1] * 100) + '%';
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
      el.style.left = (a[0] * 100) + '%';
      el.style.top = (a[1] * 100) + '%';
      el.style.background = col[0];
      el.style.color = col[1];
      el.textContent = textOf(amt);
      marks.appendChild(el);
    });
  }

  function show() { live = true; root.classList.add('on'); }
  function hide() { live = false; setHover(null); root.classList.remove('on'); }
  function close() { hide(); marks.textContent = ''; }

  /* the ring is a cell high and wide, so a straight reads as a cell and a
     split as the line between two */
  ring.style.width = 'calc(' + (CW * 100) + '% + 2px)';
  ring.style.height = 'calc(' + (CH * 100) + '% + 2px)';

  return {
    mount, setBets, show, hide, close,
    get hover() { return hover; },
    get shown() { return live; },
    /* the tests click it where a person would */
    rectFor(key) {
      const r = wrap.getBoundingClientRect();
      const a = anchorUV(key, american);
      return { x: r.left + a[0] * r.width, y: r.top + a[1] * r.height };
    },
    pickAt(u, v) { return keyAt(u, v, american); },
    el: root, wrapEl: wrap
  };
}
