/* The shell: floor, walls, ceiling, the raised coffer over the pit, columns,
   the step down into the pit and the rail around it. Everything is built from
   boxes and extrusions so there is nothing to download, and every piece is
   positioned in metres from the middle of the room. */
import * as THREE from 'three';

export const ROOM = { w: 36, d: 28, h: 5.4, pitH: 6.6, pit: { w: 17, d: 12, drop: 0.18 } };

function box(w, h, d, mat, x, y, z, cast = true, receive = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}

export function buildRoom(scene, M, solids) {
  const room = new THREE.Group();
  room.name = 'room';
  const { w, d, h } = ROOM;

  /* ---- floor ---- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.carpetMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  room.add(floor);

  /* The pit is a shallow well: the floor inside sits lower, with a tread and a
     brass nosing, which is what gives the middle of the room its shape. */
  const pit = new THREE.Group();
  const pf = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.pit.w, ROOM.pit.d), M.carpetMat.clone());
  pf.material.map = M.carpetMat.map.clone();
  pf.material.map.repeat.set(15, 11);
  pf.material.map.needsUpdate = true;
  pf.rotation.x = -Math.PI / 2;
  pf.position.y = -ROOM.pit.drop + 0.002;
  pf.receiveShadow = true;
  pit.add(pf);
  /* the riser all the way round */
  const rw = ROOM.pit.w, rd = ROOM.pit.d, dr = ROOM.pit.drop;
  [[0, -rd / 2, rw, 0], [0, rd / 2, rw, 0], [-rw / 2, 0, rd, Math.PI / 2], [rw / 2, 0, rd, Math.PI / 2]]
    .forEach(([x, z, len, rot]) => {
      const r = box(len, dr, 0.12, M.woodMat, x, -dr / 2, z);
      r.rotation.y = rot;
      pit.add(r);
      const nose = box(len, 0.03, 0.16, M.brass, x, 0.012, z);
      nose.rotation.y = rot;
      pit.add(nose);
    });
  room.add(pit);

  /* ---- walls ---- */
  const wallH = h;
  const mkWall = (len, rotY, x, z) => {
    const g = new THREE.Group();
    const upper = box(len, wallH - 1.5, 0.3, M.wallMat, 0, 1.5 + (wallH - 1.5) / 2, 0, false, true);
    g.add(upper);
    const wainscot = box(len, 1.5, 0.38, M.woodMat, 0, 0.75, 0, false, true);
    g.add(wainscot);
    g.add(box(len, 0.08, 0.46, M.brass, 0, 1.54, 0, false, false));       // chair rail
    g.add(box(len, 0.22, 0.5, M.woodMat, 0, wallH - 0.11, 0, false, false)); // crown
    /* pilasters break the run up so a long wall does not read as a flat sheet */
    const n = Math.max(2, Math.round(len / 6));
    for (let i = 0; i <= n; i++) {
      const px = -len / 2 + (len / n) * i;
      g.add(box(0.55, wallH - 0.3, 0.52, M.woodMat, px, (wallH - 0.3) / 2, 0, false, true));
      g.add(box(0.6, 0.1, 0.58, M.brass, px, wallH - 0.36, 0, false, false));
    }
    g.rotation.y = rotY;
    g.position.set(x, 0, z);
    return g;
  };
  room.add(mkWall(w, 0, 0, -d / 2));
  room.add(mkWall(w, Math.PI, 0, d / 2));
  room.add(mkWall(d, Math.PI / 2, -w / 2, 0));
  room.add(mkWall(d, -Math.PI / 2, w / 2, 0));

  /* ---- ceiling ---- */
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.ceilingMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = h;
  room.add(ceil);

  /* The pit gets a raised, coffered ceiling with a cove of warm light hidden
     behind the lip, which is the trick that makes a casino ceiling glow
     without a visible fixture. */
  const cw = ROOM.pit.w + 3.4, cd = ROOM.pit.d + 3.4;
  const coffer = new THREE.Group();
  const lid = new THREE.Mesh(new THREE.PlaneGeometry(cw, cd), M.ceilingMat);
  lid.rotation.x = Math.PI / 2;
  lid.position.y = ROOM.pitH;
  coffer.add(lid);
  /* the box sides between the two ceiling heights */
  [[0, -cd / 2, cw, 0], [0, cd / 2, cw, 0], [-cw / 2, 0, cd, Math.PI / 2], [cw / 2, 0, cd, Math.PI / 2]]
    .forEach(([x, z, len, rot]) => {
      const side = box(len, ROOM.pitH - h, 0.2, M.woodMat, x, h + (ROOM.pitH - h) / 2, z, false, false);
      side.rotation.y = rot;
      coffer.add(side);
      const lip = box(len + 0.5, 0.26, 0.55, M.woodMat, x, h + 0.13, z, false, false);
      lip.rotation.y = rot;
      coffer.add(lip);
      /* the cove strip itself, facing up into the coffer */
      const cove = box(len, 0.04, 0.26, M.emissive(0xffb66e, 2.2), x, h + 0.3, z, false, false);
      cove.rotation.y = rot;
      cove.userData.cove = true;
      coffer.add(cove);
    });
  /* coffer grid inside the lid */
  for (let i = -1; i <= 1; i++) {
    coffer.add(box(cw - 1.2, 0.14, 0.18, M.brass, 0, ROOM.pitH - 0.07, i * (cd / 3.2), false, false));
    coffer.add(box(0.18, 0.14, cd - 1.2, M.brass, i * (cw / 3.2), ROOM.pitH - 0.07, 0, false, false));
  }
  room.add(coffer);

  /* ---- columns ---- */
  const colAt = (x, z) => {
    const g = new THREE.Group();
    g.add(box(0.9, h, 0.9, M.marbleMat, 0, h / 2, 0));
    g.add(box(1.15, 0.18, 1.15, M.brass, 0, 0.09, 0));          // base
    g.add(box(1.15, 0.22, 1.15, M.brass, 0, h - 0.4, 0));        // capital
    /* a slim uplight washing the column, which is where a lot of the warmth in
       a real pit actually comes from */
    const strip = box(0.07, h - 1.8, 0.07, M.emissive(0xffcf8a, 1.5), 0.5, h / 2 - 0.3, 0.5, false, false);
    g.add(strip);
    g.position.set(x, 0, z);
    return g;
  };
  const cx = ROOM.pit.w / 2 + 2.6, cz = ROOM.pit.d / 2 + 2.2;
  [[-cx, -cz], [cx, -cz], [-cx, cz], [cx, cz]].forEach(([x, z]) => {
    room.add(colAt(x, z));
    if (solids) solids.add(x, z, 0.55, 0.55, 0, 'column');
  });

  scene.add(room);
  return room;
}
