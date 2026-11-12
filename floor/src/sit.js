/* Walking up to a game and sitting down. The crosshair casts into the room;
   anything carrying a seat in its userData lights up and names itself, and a
   click hands the camera over to a tween that walks it into the seated pose.
   Esc, Q or the button gives it back. */
import * as THREE from 'three';

const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function createSeating(camera, scene, player, dom) {
  const ray = new THREE.Raycaster();
  ray.far = 6.5;
  const centre = new THREE.Vector2(0, 0);
  const seats = [];
  scene.traverse(o => { if (o.userData && o.userData.game) seats.push(o); });

  let hover = null, state = 'walking', t = 0, dur = 1.15;
  let fromPos = new THREE.Vector3(), fromQuat = new THREE.Quaternion();
  let toPos = new THREE.Vector3(), toQuat = new THREE.Quaternion();
  let standPos = new THREE.Vector3(), standYaw = 0, current = null;

  /* every table has a page already; sitting down opens it on the same origin,
     so the bankroll, the chips and the rules are the ones from the flat site */
  const PAGES = {
    craps: '../index.html?mode=craps', crapless: '../index.html?mode=crapless',
    blackjack: '../blackjack.html', baccarat: '../baccarat.html',
    holdem: '../holdem.html', lights: '../lights.html', pinball: '../pinball.html',
    purim: '../purim.html'
  };
  const panel = document.getElementById('panel');
  const panelFrame = document.getElementById('panelFrame');
  const panelName = document.getElementById('panelName');
  const panelClose = document.getElementById('panelClose');
  const prompt = document.getElementById('prompt');
  const seatedBar = document.getElementById('seated');
  const seatedName = document.getElementById('seatedName');
  const cross = document.querySelector('.crosshair');

  /* what the camera should be doing while you are sat at a given table */
  function poseFor(obj) {
    const g = obj.userData.game;
    const m = obj.matrixWorld;
    const p = new THREE.Vector3(g.seat.x, g.seat.y, g.seat.z).applyMatrix4(m);
    const l = g.seat.look;
    const look = new THREE.Vector3(l[0], l[1], l[2]).applyMatrix4(m);
    const q = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(p, look, new THREE.Vector3(0, 1, 0))
    );
    return { p, q };
  }
  function label(obj) {
    const id = obj.userData.game.id;
    return ({ craps: 'Craps', crapless: 'Crapless Craps', blackjack: 'Blackjack', baccarat: 'Baccarat', holdem: 'Hold\u2019em',
      lights: 'Festival of Lights', pinball: 'Pinball Classic', purim: 'Purim Pots' })[id] || id;
  }
  function setHover(obj) {
    if (hover === obj) return;
    hover = obj;
    if (prompt) {
      prompt.textContent = obj ? label(obj) + '  ·  click to play' : '';
      prompt.classList.toggle('on', !!obj);
    }
    if (cross) cross.classList.toggle('live', !!obj);
  }

  function sit(obj) {
    if (state !== 'walking') return;
    current = obj;
    standPos.copy(player.position);
    standYaw = player.yaw;
    const { p, q } = poseFor(obj);
    fromPos.copy(camera.position);
    fromQuat.copy(camera.quaternion);
    toPos.copy(p); toQuat.copy(q);
    t = 0; dur = Math.max(0.75, Math.min(1.6, fromPos.distanceTo(toPos) * 0.42));
    state = 'sitting';
    player.hold(true);
    setHover(null);
    if (document.pointerLockElement) document.exitPointerLock();
    if (seatedName) seatedName.textContent = label(obj);
    if (panelName) panelName.textContent = label(obj);
  }
  function stand() {
    if (state !== 'seated') return;
    fromPos.copy(camera.position);
    fromQuat.copy(camera.quaternion);
    const e = new THREE.Euler(-0.08, standYaw, 0, 'YXZ');
    toPos.copy(standPos);
    toQuat.setFromEuler(e);
    t = 0; dur = Math.max(0.6, Math.min(1.3, fromPos.distanceTo(toPos) * 0.4));
    state = 'standing';
    if (seatedBar) seatedBar.classList.remove('on');
    closePanel();
  }

  /* the page only loads when you actually sit down, and unloads when you get
     up, so six games are not running behind your back */
  /* The frame is always handed a 1440 x 980 window and then scaled, so every
     game gets the desktop layout it was built for whatever size the panel
     ends up. */
  const LOGICAL = { w: 1440, h: 980 };
  function fitPanel() {
    if (!panel || !panel.classList.contains('on')) return;
    const view = panel.querySelector('.panel-view');
    if (!view) return;
    const r = view.getBoundingClientRect();
    const k = Math.min(r.width / LOGICAL.w, r.height / LOGICAL.h);
    panelFrame.style.transform = 'translate(' + ((r.width - LOGICAL.w * k) / 2).toFixed(1) + 'px,'
      + ((r.height - LOGICAL.h * k) / 2).toFixed(1) + 'px) scale(' + k.toFixed(4) + ')';
  }
  /* put the panel over the thing you sat at, not in the middle of the screen */
  function anchorPanel(obj) {
    if (!panel || !obj) return;
    const g = obj.userData.game;
    const p = new THREE.Vector3(g.seat.look[0], g.seat.look[1], g.seat.look[2]).applyMatrix4(obj.matrixWorld);
    p.project(camera);
    const w = panel.offsetWidth, h = panel.offsetHeight;
    const px = (p.x * 0.5 + 0.5) * innerWidth;
    const py = (-p.y * 0.5 + 0.5) * innerHeight;
    const x = Math.max(w / 2 + 10, Math.min(innerWidth - w / 2 - 10, px));
    const y = Math.max(h / 2 + 10, Math.min(innerHeight - h / 2 - 10, py));
    panel.style.setProperty('--ax', x + 'px');
    panel.style.setProperty('--ay', y + 'px');
    panel.classList.add('anchored');
  }
  function openPanel(obj) {
    if (!panel || !obj) return;
    const url = PAGES[obj.userData.game.id];
    if (!url) return;
    panelFrame.src = url;
    panel.classList.add('on');
    /* the panel carries its own title and leave button, so the HUD one would
       only sit underneath it saying the same thing twice */
    if (seatedBar) seatedBar.classList.remove('on');
    document.body.classList.add('dimmed');
    anchorPanel(obj);
    fitPanel();
    requestAnimationFrame(fitPanel);
  }
  addEventListener('resize', () => { fitPanel(); if (current) anchorPanel(current); });
  function closePanel() {
    if (!panel) return;
    panel.classList.remove('on');
    panel.classList.remove('anchored');
    document.body.classList.remove('dimmed');
    setTimeout(() => { if (state !== 'seated') panelFrame.src = 'about:blank'; }, 480);
  }
  if (panelClose) panelClose.addEventListener('click', () => stand());

  dom.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (state === 'walking' && hover && player.locked) sit(hover);
  });
  addEventListener('keydown', (e) => {
    if ((e.code === 'KeyQ' || e.code === 'Escape') && state === 'seated') stand();
  });
  const btn = document.getElementById('leave');
  if (btn) btn.addEventListener('click', stand);

  return {
    get state() { return state; },
    get table() { return current; },
    sit, stand,
    update(dt) {
      if (state === 'walking') {
        if (!player.locked) { setHover(null); return; }
        ray.setFromCamera(centre, camera);
        const hit = ray.intersectObjects(seats, true)[0];
        let found = null;
        if (hit) {
          let o = hit.object;
          while (o && !(o.userData && o.userData.game)) o = o.parent;
          found = o || null;
        }
        setHover(found);
        return;
      }
      if (state === 'sitting' || state === 'standing') {
        t += dt / dur;
        const k = ease(Math.min(1, t));
        camera.position.lerpVectors(fromPos, toPos, k);
        camera.quaternion.slerpQuaternions(fromQuat, toQuat, k);
        if (t >= 1) {
          if (state === 'sitting') {
            state = 'seated';
            if (seatedBar) seatedBar.classList.add('on');
            openPanel(current);
          } else {
            state = 'walking';
            current = null;
            player.place(standPos, standYaw);
            player.hold(false);
          }
        }
      }
    }
  };
}
