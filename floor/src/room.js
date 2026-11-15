/* The shell: floor, walls, ceiling, the raised coffer over the pit, columns,
   the step down into the pit and the rail around it. Everything is built from
   boxes and extrusions so there is nothing to download, and every piece is
   positioned in metres from the middle of the room. */
import * as THREE from 'three';

export const ROOM = { w: 38, d: 30, h: 5.4, pitH: 6.6, pit: { w: 20, d: 13.5, drop: 0.18 } };

/* The high limit room: a salon off the east wall, through a single wide
   opening. Lower ceiling, darker carpet, fewer and bigger tables. */
export const SALON = { x0: 19, w: 15, d: 15, h: 4.4, door: { z: 0, w: 3.6 } };
SALON.cx = SALON.x0 + SALON.w / 2;

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
  pf.material.map.repeat.set(17, 12);
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
  /* the east wall is in two runs, with the way through to the salon between
     them and a header carried over the opening */
  {
    const gap = SALON.door.w, gz = SALON.door.z;
    const run = (d - gap) / 2;
    room.add(mkWall(run, -Math.PI / 2, w / 2, gz - gap / 2 - run / 2));
    room.add(mkWall(run, -Math.PI / 2, w / 2, gz + gap / 2 + run / 2));
    const head = box(0.42, wallH - 2.75, gap, M.wallMat, w / 2, 2.75 + (wallH - 2.75) / 2, gz, false, true);
    room.add(head);
    room.add(box(0.56, 0.16, gap + 0.5, M.brass, w / 2, 2.72, gz, false, false));
    /* the jambs */
    [-1, 1].forEach(side => {
      room.add(box(0.56, 2.8, 0.5, M.woodMat, w / 2, 1.4, gz + side * (gap / 2 + 0.25), false, true));
      room.add(box(0.6, 0.12, 0.56, M.brass, w / 2, 2.84, gz + side * (gap / 2 + 0.25), false, false));
    });
  }

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
      const cove = box(len, 0.04, 0.26, M.emissive(0xffb66e, 1.5), x, h + 0.3, z, false, false);
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
  const cx = ROOM.pit.w / 2 + 2.9, cz = ROOM.pit.d / 2 + 2.3;
  [[-cx, -cz], [cx, -cz], [-cx, cz], [cx, cz]].forEach(([x, z]) => {
    room.add(colAt(x, z));
    if (solids) solids.add(x, z, 0.55, 0.55, 0, 'column');
  });

  scene.add(room);
  return room;
}

/* ---------------------------------------------------------------
   The high limit salon: one room off the east wall, reached through
   the opening in it. Lower ceiling, darker floor, quieter light. The
   point of the room is that it does not look like the main floor. */
export function buildSalon(scene, M, solids) {
  const g = new THREE.Group();
  g.name = 'salon';
  const { x0, w, d, h } = SALON;
  const cx = x0 + w / 2;

  /* ---- floor: a deeper carpet with a marble border round the edge ---- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.carpetMat.clone());
  floor.material = M.carpetMat.clone();
  floor.material.map = M.carpetMat.map.clone();
  floor.material.map.repeat.set(11, 11);
  floor.material.map.needsUpdate = true;
  floor.material.color = new THREE.Color(0x6a5560);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0.001, 0);
  floor.receiveShadow = true;
  g.add(floor);
  const border = new THREE.Mesh(new THREE.RingGeometry(0, 1, 4), M.marbleMat);
  border.visible = false;
  g.add(border);
  [[0, -d / 2 + 0.6, w, 1.2], [0, d / 2 - 0.6, w, 1.2],
   [-w / 2 + 0.6, 0, 1.2, d], [w / 2 - 0.6, 0, 1.2, d]].forEach(([ox, oz, sw, sd]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sd), M.marbleMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx + ox, 0.004, oz);
    m.receiveShadow = true;
    g.add(m);
  });

  /* ---- walls ---- */
  const wall = (len, rotY, x, z) => {
    const p = new THREE.Group();
    p.add(box(len, h - 1.6, 0.3, M.wallMat, 0, 1.6 + (h - 1.6) / 2, 0, false, true));
    p.add(box(len, 1.6, 0.38, M.woodMat, 0, 0.8, 0, false, true));
    p.add(box(len, 0.09, 0.46, M.brass, 0, 1.64, 0, false, false));
    p.add(box(len, 0.24, 0.5, M.woodMat, 0, h - 0.12, 0, false, false));
    const n = Math.max(2, Math.round(len / 4.5));
    for (let i = 0; i <= n; i++) {
      const px = -len / 2 + (len / n) * i;
      p.add(box(0.5, h - 0.3, 0.5, M.woodMat, px, (h - 0.3) / 2, 0, false, true));
      p.add(box(0.56, 0.1, 0.56, M.brass, px, h - 0.38, 0, false, false));
      /* a sconce between the pilasters */
      if (i < n) {
        const sx = px + (len / n) / 2;
        p.add(box(0.26, 0.5, 0.1, M.emissive(0xffc98a, 1.0), sx, 2.5, 0.2, false, false));
        p.add(box(0.32, 0.06, 0.16, M.brass, sx, 2.78, 0.22, false, false));
      }
    }
    p.rotation.y = rotY;
    p.position.set(x, 0, z);
    return p;
  };
  g.add(wall(w, 0, cx, -d / 2));
  g.add(wall(w, Math.PI, cx, d / 2));
  g.add(wall(d, -Math.PI / 2, x0 + w, 0));
  /* the near side is the main floor's own east wall, already built, except
     for the two returns that frame the way in */
  const gap = SALON.door.w;
  [-1, 1].forEach(side => {
    const run = (d - gap) / 2;
    g.add(wall(run, Math.PI / 2, x0, side * (gap / 2 + run / 2)));
  });

  /* ---- ceiling, with a cove over the middle ---- */
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.ceilingMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cx, h, 0);
  g.add(ceil);
  const lw = w - 4, ld = d - 4;
  const lid = new THREE.Mesh(new THREE.PlaneGeometry(lw, ld), M.ceilingMat);
  lid.rotation.x = Math.PI / 2;
  lid.position.set(cx, h + 0.7, 0);
  g.add(lid);
  [[0, -ld / 2, lw, 0], [0, ld / 2, lw, 0], [-lw / 2, 0, ld, Math.PI / 2], [lw / 2, 0, ld, Math.PI / 2]]
    .forEach(([ox, oz, len, rot]) => {
      const sideW = box(len, 0.7, 0.2, M.wallMat, cx + ox, h + 0.35, oz, false, false);
      sideW.rotation.y = rot;
      g.add(sideW);
      const cove = box(len - 0.3, 0.05, 0.1, M.emissive(0xffb070, 0.85), cx + ox, h + 0.1, oz, false, false);
      cove.rotation.y = rot;
      g.add(cove);
    });
  g.add(box(lw - 0.2, 0.1, ld - 0.2, M.brass, cx, h + 0.02, 0, false, false));

  /* ---- collision: the three outer walls and the two returns ---- */
  if (solids) {
    solids.add(cx, -d / 2 - 0.35, w / 2, 0.5, 0, 'salonwall');
    solids.add(cx, d / 2 + 0.35, w / 2, 0.5, 0, 'salonwall');
    solids.add(x0 + w + 0.35, 0, 0.5, d / 2, 0, 'salonwall');
    [-1, 1].forEach(side => {
      const run = (d - gap) / 2;
      solids.add(x0 - 0.35, side * (gap / 2 + run / 2), 0.5, run / 2, 0, 'salonwall');
    });
  }

  scene.add(g);
  return g;
}
