/* Walking. WASD or the arrow keys, mouse to look, shift to hurry. The ground
   steps down into the pit and back up again, the head rises and falls a little
   with the stride, and the body is a circle that slides along anything solid.
   Sitting down is handled in sit.js; this just stops listening while it has
   the camera. */
import * as THREE from 'three';
import { ROOM } from './room.js';

const EYE = 1.68, RADIUS = 0.36;

export function createPlayer(camera, dom, solids) {
  const keys = Object.create(null);
  /* facing the pit from just inside the door, with the bar behind you */
  let yaw = 0, pitch = -0.04, locked = false, fly = false, held = false;
  let bob = 0, groundY = 0;
  const pos = new THREE.Vector3(0, EYE, 10.4);

  camera.position.copy(pos);

  dom.addEventListener('click', () => { if (!locked && !held) dom.requestPointerLock(); });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === dom;
    const note = document.getElementById('clickNote');
    if (note) note.style.display = locked ? 'none' : '';
  });
  document.addEventListener('mousemove', (e) => {
    if (!locked) return;
    yaw -= e.movementX * 0.0021;
    pitch = Math.max(-1.3, Math.min(1.3, pitch - e.movementY * 0.0021));
  });
  addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'KeyF' && !held) fly = !fly;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });

  const on = (...codes) => codes.some(c => keys[c]);
  const dir = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');

  /* inside the pit the carpet is a step lower */
  function ground(x, z) {
    const inPit = Math.abs(x) < ROOM.pit.w / 2 - 0.1 && Math.abs(z) < ROOM.pit.d / 2 - 0.1;
    return inPit ? -ROOM.pit.drop : 0;
  }

  return {
    get locked() { return locked; },
    get position() { return pos; },
    get yaw() { return yaw; },
    hold(v) { held = v; if (v) { keys.KeyW = keys.KeyS = keys.KeyA = keys.KeyD = false; } },
    /* put the walker back where it was standing, facing where it was */
    place(p, y) { pos.copy(p); yaw = y; pitch = -0.08; },
    aim() {
      euler.set(pitch, yaw, 0);
      return euler;
    },
    update(dt) {
      if (held) return;
      euler.set(pitch, yaw, 0);
      camera.quaternion.setFromEuler(euler);

      const run = on('ShiftLeft', 'ShiftRight');
      const speed = (run ? 5.2 : 2.45);
      dir.set(0, 0, -1).applyQuaternion(camera.quaternion);
      if (!fly) { dir.y = 0; dir.normalize(); }
      right.crossVectors(dir, up).normalize();

      let mx = 0, mz = 0;
      if (on('KeyW', 'ArrowUp')) mz += 1;
      if (on('KeyS', 'ArrowDown')) mz -= 1;
      if (on('KeyA', 'ArrowLeft')) mx -= 1;
      if (on('KeyD', 'ArrowRight')) mx += 1;
      const moving = mx || mz;
      if (moving) {
        const k = speed * dt / Math.hypot(mx, mz);
        pos.addScaledVector(dir, mz * k);
        pos.addScaledVector(right, mx * k);
      }

      if (fly) {
        if (keys.Space) pos.y += speed * dt;
        if (keys.KeyC) pos.y -= speed * dt;
        pos.y = Math.max(0.4, Math.min(6.0, pos.y));
      } else {
        const [nx, nz] = solids.resolve(pos.x, pos.z, RADIUS);
        pos.x = nx; pos.z = nz;
        groundY += (ground(pos.x, pos.z) - groundY) * Math.min(1, dt * 9);
        /* a shallow stride, twice a step, and a touch of sway with it */
        bob += moving ? dt * (run ? 11 : 7.4) : 0;
        if (!moving) bob += (Math.round(bob / Math.PI) * Math.PI - bob) * Math.min(1, dt * 6);
        const amp = moving ? (run ? 0.035 : 0.022) : 0;
        pos.y = groundY + EYE + Math.sin(bob) * amp;
      }
      camera.position.copy(pos);
      camera.position.x += Math.cos(bob * 0.5) * (fly ? 0 : 0.012);
    }
  };
}
