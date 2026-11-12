/* A free camera for looking the room over: WASD to move, mouse to look, shift
   to hurry, space and C for up and down. Step two turns this into a walk with
   collision and the sit-down move; the input handling is already shaped for
   it, which is why the height is held at eye level by default. */
import * as THREE from 'three';

export function createFlyCamera(camera, dom) {
  const keys = Object.create(null);
  let yaw = 0, pitch = 0, locked = false, fly = false;
  const EYE = 1.68;

  camera.position.set(0, EYE, 11.5);
  yaw = Math.PI;

  dom.addEventListener('click', () => { if (!locked) dom.requestPointerLock(); });
  document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === dom; });
  document.addEventListener('mousemove', (e) => {
    if (!locked) return;
    yaw -= e.movementX * 0.0022;
    pitch -= e.movementY * 0.0022;
    pitch = Math.max(-1.35, Math.min(1.35, pitch));
  });
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'KeyF') fly = !fly;
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  const dir = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  return {
    get locked() { return locked; },
    update(dt) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
      camera.quaternion.copy(q);
      const speed = (keys.ShiftLeft || keys.ShiftRight ? 7.5 : 3.1) * dt;
      dir.set(0, 0, -1).applyQuaternion(q);
      if (!fly) { dir.y = 0; dir.normalize(); }
      right.crossVectors(dir, up).normalize();
      if (keys.KeyW) camera.position.addScaledVector(dir, speed);
      if (keys.KeyS) camera.position.addScaledVector(dir, -speed);
      if (keys.KeyA) camera.position.addScaledVector(right, -speed);
      if (keys.KeyD) camera.position.addScaledVector(right, speed);
      if (fly) {
        if (keys.Space) camera.position.y += speed;
        if (keys.KeyC) camera.position.y -= speed;
      } else {
        camera.position.y += (EYE - camera.position.y) * Math.min(1, dt * 8);
      }
      /* keep inside the shell until proper collision arrives in step two */
      camera.position.x = Math.max(-17, Math.min(17, camera.position.x));
      camera.position.z = Math.max(-13, Math.min(13, camera.position.z));
      camera.position.y = Math.max(0.6, Math.min(5.0, camera.position.y));
    }
  };
}
