/* Playing on the machine rather than in a window over it.

   The game is a real page in an iframe, so it cannot be drawn into the WebGL
   scene as a texture. What it can do is sit on top of the canvas with a
   perspective transform that maps its rectangle exactly onto the four corners
   of the cabinet's glass. Recomputed every frame, it tracks the camera: lean
   in and the page leans with the cabinet. Nothing stands between a seated
   player and the screen, so laying it over the canvas needs no depth tricks. */
import * as THREE from 'three';

/* the projective transform taking the four source corners onto the four
   destination corners: eight unknowns, eight equations, solved straight */
function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  for (let i = 0; i < 8; i++) {
    let p = i;
    for (let r = i + 1; r < 8; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    if (p !== i) { const t = A[i]; A[i] = A[p]; A[p] = t; const s = b[i]; b[i] = b[p]; b[p] = s; }
    const d = A[i][i];
    if (!d || !isFinite(d)) return null;
    for (let c = i; c < 8; c++) A[i][c] /= d;
    b[i] /= d;
    for (let r = 0; r < 8; r++) {
      if (r === i) continue;
      const f = A[r][i];
      if (!f) continue;
      for (let c = i; c < 8; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  return b;
}

export function createGlass(camera, el, logical) {
  const quad = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const v = new THREE.Vector3();
  const src = [[0, 0], [logical.w, 0], [logical.w, logical.h], [0, logical.h]];
  let target = null;

  /* The four corners of the glass in the fixture's own frame, clockwise from
     the top left as the page sees it. A cabinet's screen stands upright; a
     table's terminal leans back, so the quad's up vector tips with it. */
  function setTarget(obj) {
    target = null;
    if (!obj || !obj.userData || !obj.userData.glass) return false;
    const g = obj.userData.glass;
    const t = g.tilt || 0;
    const cx = g.x || 0;
    const up = new THREE.Vector3(0, Math.cos(t), -Math.sin(t)).multiplyScalar(g.h / 2);
    const right = new THREE.Vector3(g.w / 2, 0, 0);
    const c = new THREE.Vector3(cx, g.y, g.z);
    target = { obj, pts: [
      c.clone().sub(right).add(up),
      c.clone().add(right).add(up),
      c.clone().add(right).sub(up),
      c.clone().sub(right).sub(up)
    ] };
    return true;
  }

  function clear() {
    target = null;
    el.style.transform = '';
    el.style.visibility = '';
  }

  function update() {
    if (!target) return false;
    target.obj.updateWorldMatrix(true, false);
    const dst = [];
    for (let i = 0; i < 4; i++) {
      v.copy(target.pts[i]).applyMatrix4(target.obj.matrixWorld);
      quad[i].copy(v);
      v.project(camera);
      /* a corner behind the eye makes the mapping meaningless */
      if (!isFinite(v.x) || v.z > 1) { el.style.visibility = 'hidden'; return false; }
      dst.push([(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight]);
    }
    const h = homography(src, dst);
    if (!h) { el.style.visibility = 'hidden'; return false; }
    el.style.visibility = 'visible';
    el.style.transform =
      'matrix3d(' + [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, 1]
        .map(n => n.toFixed(6)).join(',') + ')';
    return true;
  }

  return { setTarget, clear, update, get active() { return !!target; } };
}
