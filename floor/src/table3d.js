/* Playing roulette on the table itself.

   Walking up to the roulette table no longer opens the flat page over the top
   of it. You stand at the rail, the crosshair runs over the cloth and names
   whatever bet is under it, a click puts your chip down there, and the wheel
   you were already watching from across the room is the one that decides it.

   Nothing about the game is new. The rules are roul.js, the same engine the
   flat page runs and the same one test-roul.js checks; the money is the shared
   bankroll, so what you win here you can spend at craps. The only new thing is
   where a click lands, and that comes out of rlayout.js, which holds the
   measurements the cloth was drawn from, so the chip goes on the line you
   aimed at rather than near it. */
import * as THREE from 'three';
import { keyAt, anchorUV } from './rlayout.js';
import { chipStack } from './props.js';

/* the chips you can pick up, in cents: a dollar to a thousand */
const CHIPS = [100, 500, 2500, 10000, 50000, 100000];
const CHIP_SCALE = 2;

/* a bet broken into the chips a dealer would actually stack for it, biggest
   first, so $1,275 is a purple, two greens, three reds */
function breakdown(cents) {
  const out = [];
  let left = cents;
  for (let i = CHIPS.length - 1; i >= 0; i--) {
    const d = CHIPS[i];
    let n = Math.floor(left / d);
    if (!n) continue;
    out.push([d, n]);
    left -= n * d;
  }
  /* a stack taller than a dozen reads as a column, not a bet: show the top */
  let total = out.reduce((a, b) => a + b[1], 0);
  while (total > 12 && out.length) {
    const last = out[out.length - 1];
    total -= last[1];
    out.pop();
  }
  return out.length ? out : [[CHIPS[0], 1]];
}

export function createTable3d(camera, scene, dom) {
  const C = window.Casino, R = window.Roul;
  if (!C || !R) return null;

  const ray = new THREE.Raycaster();
  ray.far = 8;
  const centre = new THREE.Vector2(0, 0);
  const local = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const look = new THREE.Matrix4();
  const world = new THREE.Vector3();

  let table = null;       // the table being played
  let cloth = null;       // its cloth: mesh, size and which wheel
  let G = null;           // the engine's state for this session at it
  let act = null;         // the table's own ball and dolly, borrowed
  let chip = 500;
  let hover = null;       // the bet key under the crosshair
  let busy = false;
  let waiting = 0;        // seconds left of the spin

  const chipRoot = new THREE.Group();
  chipRoot.name = 'playerChips';
  scene.add(chipRoot);

  /* the ring that shows where the chip will go */
  const markGeo = new THREE.TorusGeometry(0.042, 0.004, 6, 28);
  const markMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.85 });
  const marker = new THREE.Mesh(markGeo, markMat);
  marker.rotation.x = Math.PI / 2;
  marker.visible = false;
  scene.add(marker);

  const hud = document.getElementById('table3d');
  const el = id => document.getElementById(id);

  /* ---------- the cloth as a map ---------- */
  /* The layout texture is laid on the cloth un-rotated, so a point on the
     table turns into a point on the canvas with nothing more than a scale.
     This is the same mapping the dealer's marker uses, read backwards. */
  function pointToUV(p) {
    local.copy(p);
    table.worldToLocal(local);
    return [local.x / cloth.w + 0.5, (local.z - cloth.z) / cloth.d + 0.5];
  }
  function uvToWorld(u, v, out) {
    out.set((u - 0.5) * cloth.w, cloth.y, cloth.z + (v - 0.5) * cloth.d);
    return table.localToWorld(out);
  }
  function anchorWorld(key, out) {
    const uv = anchorUV(key, cloth.american);
    return uvToWorld(uv[0], uv[1], out);
  }

  /* ---------- the chips on the layout ---------- */
  function clearChips() {
    while (chipRoot.children.length) chipRoot.remove(chipRoot.children[0]);
  }
  function paintChips() {
    clearChips();
    if (!G) return;
    Object.keys(G.bets).forEach(key => {
      const amt = G.bets[key];
      if (!amt) return;
      anchorWorld(key, world);
      let h = 0;
      breakdown(amt).forEach(([d, n]) => {
        const st = chipStack(d / 100, n, world.x, world.y + 0.004 + h, world.z);
        /* the cells on this cloth are bigger than a real layout's, so a chip
           cut to real scale reads as a crumb on it */
        st.scale.set(CHIP_SCALE, CHIP_SCALE * 0.85, CHIP_SCALE);
        chipRoot.add(st);
        h += n * 0.0033 * CHIP_SCALE * 0.85;
      });
    });
  }

  /* ---------- the panel along the bottom of the screen ---------- */
  function label(key) {
    const bet = R.table(cloth.american ? 'american' : 'euro')[key];
    if (!bet) return '';
    const pays = ' · pays ' + bet.odds + ' to 1';
    const n = bet.nums.join('/');
    if (bet.kind === 'straight') return 'Straight up ' + n + pays;
    if (bet.kind === 'split') return 'Split ' + n + pays;
    if (bet.kind === 'street') return bet.label + ' ' + n + pays;
    if (bet.kind === 'corner') return bet.label + ' ' + n + pays;
    if (bet.kind === 'line') return bet.label + ' ' + bet.nums[0] + '–' + bet.nums[bet.nums.length - 1] + pays;
    return bet.label + pays;
  }
  function say(text) { if (hud) el('t3say').textContent = text; }
  function paintHud() {
    if (!hud) return;
    el('t3bank').textContent = C.money(C.bank());
    el('t3stake').textContent = C.money(G ? R.staked(G) : 0);
    const live = !!G && !busy && R.staked(G) > 0;
    el('t3spin').disabled = !live;
    el('t3clear').disabled = !live;
    [].forEach.call(hud.querySelectorAll('[data-chip]'), b =>
      b.classList.toggle('on', +b.dataset.chip === chip));
    el('t3bet').textContent = busy ? '' : (hover ? label(hover) : '');
  }

  /* ---------- betting ---------- */
  function lay(down) {
    if (!G || busy || !hover) return;
    if (!down) {
      const r = R.remove(G, hover, chip);
      if (r.removed) { C.addBank(r.removed); C.play('handle', 0, 0.5); say(''); }
      paintChips(); paintHud();
      return;
    }
    const a = R.place(G, hover, chip, C.bank());
    if (!a.added) {
      say(a.reason === 'limit' ? 'That bet is at the table limit'
        : a.reason === 'bank' ? 'Not enough left in the rack' : '');
      return;
    }
    C.addBank(-a.added);
    C.play('lay', 0, 0.7);
    say('');
    paintChips(); paintHud();
  }
  function clearBets() {
    if (!G || busy) return;
    const back = R.clear(G);
    if (back) { C.addBank(back); C.play('handle', 0, 0.7); }
    paintChips(); paintHud();
  }

  /* ---------- the spin ---------- */
  /* The table's own ball is already running; the spin hands it the number the
     engine drew and waits for it to drop, which is what the pause before a
     payout actually is. */
  function spin() {
    if (!G || busy || !R.staked(G)) return;
    const out = R.spin(G);
    busy = true;
    marker.visible = false;
    say('No more bets');
    paintHud();
    act.phase = 'slow';
    act.t = 0;
    act.pick = out.n;
    act.speed = act.fast;
    act.radius = 0.335;
    act.dollyTo = null;
    act.marked = false;
    waiting = 0;
    pending = out;
  }
  let pending = null;
  function finish() {
    const out = pending;
    pending = null;
    const res = R.settle(G, out);
    C.addBank(res.returned);
    G.bets = {};
    paintChips();
    const hit = res.ev.filter(l => l.won);
    let line = res.n + ' ' + res.colour;
    if (res.net > 0) line += ' · ' + C.money(res.net) + ' to you';
    else if (hit.length) line += ' · ' + C.money(res.returned) + ' back';
    else line += ' · no bet';
    say(line);
    if (res.net > 0) C.play('stack', 0.25, 0.9);
    else C.play('collide', 0, 0.45);
    busy = false;
    paintHud();
  }

  /* ---------- coming and going ---------- */
  function claims(obj) {
    return !!(obj && obj.userData && obj.userData.cloth && obj.userData.act
      && obj.userData.act.kind === 'roulette');
  }
  function open(obj) {
    table = obj;
    cloth = obj.userData.cloth;
    act = obj.userData.act;
    G = R.newGame(cloth.american ? 'american' : 'euro');
    busy = false; hover = null; pending = null;
    if (hud) hud.classList.add('on');
    document.body.classList.add('playing');
    paintChips(); paintHud();
    say('Pick a chip, then put it on the cloth');
    /* the sound pack is 190k and the floor does not otherwise need it, so it
       only comes down when somebody actually sits at a table */
    if (!window.CRAPS_SOUNDS && !document.getElementById('sfx')) {
      const s = document.createElement('script');
      s.id = 'sfx';
      s.src = '../sounds.js';
      document.head.appendChild(s);
    }
  }
  function close() {
    /* A bet made is a bet made: if you walk away mid-spin the round is settled
       against you or for you exactly as it would have been. Chips still on the
       cloth before the call come back, the way they would if you picked them
       up and left. */
    if (busy && pending) finish();
    if (G) { const back = R.clear(G); if (back) C.addBank(back); }
    G = null; table = null; cloth = null; act = null; pending = null;
    busy = false; hover = null;
    marker.visible = false;
    clearChips();
    if (hud) hud.classList.remove('on');
    document.body.classList.remove('playing');
  }

  /* ---------- every frame ---------- */
  function update(dt) {
    if (!table) return;
    if (busy) {
      waiting += dt;
      /* the ball has dropped and the dealer has reached for the marker */
      if (pending && (act.phase === 'mark' || waiting > 9)) finish();
      return;
    }
    ray.setFromCamera(centre, camera);
    const hit = ray.intersectObject(cloth.mesh, false)[0];
    let key = null;
    if (hit) {
      const uv = pointToUV(hit.point);
      key = keyAt(uv[0], uv[1], cloth.american);
    }
    if (key !== hover) { hover = key; paintHud(); }
    if (!key) { marker.visible = false; return; }
    anchorWorld(key, world);
    marker.position.copy(world);
    marker.position.y += 0.007;
    marker.visible = true;
  }

  /* ---------- wiring ---------- */
  dom.addEventListener('mousedown', e => {
    if (!table) return;
    if (e.button === 0) lay(true);
    else if (e.button === 2) lay(false);
  });
  dom.addEventListener('contextmenu', e => { if (table) e.preventDefault(); });
  addEventListener('keydown', e => {
    if (!table) return;
    if (e.code === 'Space') { e.preventDefault(); spin(); }
    else if (e.key >= '1' && e.key <= '6') { chip = CHIPS[+e.key - 1]; C.play('lay', 0, 0.3); paintHud(); }
    else if (e.code === 'KeyC') clearBets();
  });
  if (hud) {
    hud.innerHTML = '<div class="t3bet" id="t3bet"></div>'
      + '<div class="t3row">'
      + '<div class="t3chips">' + CHIPS.map((c, i) =>
        '<button class="t3chip c' + (c / 100) + '" data-chip="' + c + '" title="Key ' + (i + 1) + '">'
        + '<b>$' + C.chipText(c) + '</b><i>' + (i + 1) + '</i></button>').join('') + '</div>'
      + '<button class="t3btn" id="t3clear">Clear <i>C</i></button>'
      + '<div class="t3stat"><small>Bankroll</small><b id="t3bank">$0</b></div>'
      + '<div class="t3stat"><small>On the cloth</small><b id="t3stake">$0</b></div>'
      + '<button class="t3go" id="t3spin">Spin <i>space</i></button>'
      + '</div><div class="t3say" id="t3say"></div>';
    hud.addEventListener('mousedown', e => e.stopPropagation());
    hud.addEventListener('click', e => {
      const b = e.target.closest('[data-chip]');
      if (b) { chip = +b.dataset.chip; C.play('lay', 0, 0.3); paintHud(); return; }
      if (e.target.closest('#t3spin')) spin();
      else if (e.target.closest('#t3clear')) clearBets();
    });
  }

  return {
    claims, open, close, update,
    get active() { return !!table; },
    /* what the tests drive it by, the way window.ROULETTE works on the page */
    get hover() { return hover; },
    get game() { return G; },
    get busy() { return busy; },
    pick(c) { chip = c; paintHud(); },
    /* point the crosshair at a named bet and report what it picked up; this is
       how the tests check that a click lands where it was aimed */
    aim(key) {
      if (!table) return null;
      anchorWorld(key, world);
      look.lookAt(camera.position, world, UP);
      camera.quaternion.setFromRotationMatrix(look);
      camera.updateMatrixWorld(true);
      update(0);
      return hover;
    },
    lay, spin, clearBets
  };
}
