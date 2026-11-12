/* What stands in the room: the pit rail, blocked-out tables and machines, the
   slot bank with its neon, the cashier cage and the bar. The tables are
   stand-ins at this stage, sized and placed the way the real ones will be, so
   the walk around the room is already honest about scale. */
import * as THREE from 'three';
import { ROOM } from './room.js';

function box(w, h, d, mat, x, y, z, cast = true, receive = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}
/* A soft round shadow under furniture. Three shadow-casting lights would cost
   more than this is worth, and a contact blob sells the contact better. */
function contact(scene, x, z, rx, rz, strength = 0.55, y = 0.004) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d').createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,' + strength + ')');
  g.addColorStop(0.55, 'rgba(0,0,0,' + strength * 0.45 + ')');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  const ctx = c.getContext('2d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(rx, rz),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 1 }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.renderOrder = -1;
  scene.add(m);
  return m;
}

/* ---------- the pit rail ----------
   Waist height, with a frosted panel between brass posts and a thin lit edge
   along the bottom, which is what you see glowing from across a floor. */
function pitRail(M) {
  const g = new THREE.Group();
  const { w, d } = ROOM.pit;
  const H = 0.92;
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xbfe8d8, metalness: 0, roughness: 0.3, transparent: true, opacity: 0.09,
    clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide
  });
  const runs = [
    [0, -d / 2 - 1.2, w * 0.46, 0, -w * 0.27], [0, -d / 2 - 1.2, w * 0.46, 0, w * 0.27],
    [0, d / 2 + 1.2, w * 0.46, 0, -w * 0.27], [0, d / 2 + 1.2, w * 0.46, 0, w * 0.27],
    [-w / 2 - 1.2, 0, d * 0.78, Math.PI / 2, 0], [w / 2 + 1.2, 0, d * 0.78, Math.PI / 2, 0]
  ];
  runs.forEach(([x, z, len, rot, off]) => {
    const run = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, len, 14), M.brass);
    top.rotation.z = Math.PI / 2;
    top.position.y = H;
    top.castShadow = true;
    run.add(top);
    const panel = box(len - 0.1, H - 0.3, 0.025, glass, 0, H / 2 - 0.02, 0, false, false);
    run.add(panel);
    const lit = box(len - 0.1, 0.02, 0.05, M.emissive(0x7ad8b4, 0.75), 0, 0.16, 0, false, false);
    run.add(lit);
    const posts = Math.max(2, Math.round(len / 2.1));
    for (let i = 0; i <= posts; i++) {
      const px = -len / 2 + (len / posts) * i;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, H, 10), M.brass);
      p.position.set(px, H / 2, 0);
      p.castShadow = true;
      run.add(p);
    }
    run.rotation.y = rot;
    run.position.set(x + (rot ? 0 : off), 0, z + (rot ? off : 0));
    g.add(run);
  });
  return g;
}

/* ---------- a table blockout ----------
   Oval or round pedestal table at real heights: 0.78 playing surface for the
   card games, 0.9 for the craps rail. */
function cardTable(M, kind) {
  const g = new THREE.Group();
  const rx = kind === 'baccarat' ? 1.5 : 1.25, rz = 0.95;
  const topShape = new THREE.Shape();
  topShape.absellipse(0, 0, rx, rz, 0, Math.PI * 2, false, 0);
  const top = new THREE.Mesh(new THREE.ExtrudeGeometry(topShape, {
    depth: 0.09, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.05, bevelSegments: 3, curveSegments: 48
  }), M.feltMat);
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.78;
  top.castShadow = true; top.receiveShadow = true;
  g.add(top);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(1, 0.075, 12, 64), M.woodMat);
  rail.scale.set(rx + 0.06, rz + 0.06, 1);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = 0.79;
  rail.castShadow = true;
  g.add(rail);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 0.78, 20), M.woodMat);
  ped.position.y = 0.39;
  ped.castShadow = true;
  g.add(ped);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 0.06, 24), M.darkMetal);
  foot.position.y = 0.03;
  g.add(foot);
  /* chairs, roughed in */
  const seats = kind === 'baccarat' ? 7 : 5;
  for (let i = 0; i < seats; i++) {
    const a = Math.PI + (i - (seats - 1) / 2) * 0.42;
    const cx = Math.cos(a) * (rx + 0.75), cz = Math.sin(a) * (rz + 0.75);
    const chair = new THREE.Group();
    chair.add(box(0.46, 0.09, 0.46, M.woodMat, 0, 0.47, 0));
    chair.add(box(0.44, 0.55, 0.1, M.woodMat, 0, 0.78, -0.2));
    chair.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.47, 10), M.darkMetal));
    chair.children[2].position.y = 0.235;
    chair.add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.04, 16), M.darkMetal));
    chair.children[3].position.y = 0.02;
    chair.position.set(cx, 0, cz);
    chair.lookAt(0, 0, 0);
    chair.children.forEach(c => { c.castShadow = true; });
    g.add(chair);
  }
  return g;
}

/* ---------- craps table ----------
   Real proportions: 12 foot table, the layout at 0.78, the padded rail on top
   of it at 0.95 with a chip rack cut into the inside edge. The bowl shape is
   what you actually see when you walk up to one, so the apron is tucked in
   under the rail rather than being a plain box. */
function crapsTable(M) {
  const g = new THREE.Group();
  const L = 3.66, W = 1.42, FELT = 0.78;
  const railMat = new THREE.MeshStandardMaterial({ color: 0x3a1420, roughness: 0.72, metalness: 0.05 });

  /* the layout, sunk inside the rail */
  const felt = box(L - 0.3, 0.06, W - 0.3, M.feltMat, 0, FELT, 0);
  g.add(felt);
  /* a plain green inner wall so you do not see through the gap */
  g.add(box(L - 0.28, 0.2, W - 0.28, M.feltMat, 0, FELT - 0.1, 0, false, true));

  /* the rail: four padded runs standing proud of the layout */
  [[0, -W / 2 + 0.07, L, 0], [0, W / 2 - 0.07, L, 0],
   [-L / 2 + 0.07, 0, W - 0.14, Math.PI / 2], [L / 2 - 0.07, 0, W - 0.14, Math.PI / 2]]
    .forEach(([x, z, len, rot]) => {
      const pad = box(len, 0.22, 0.17, railMat, x, FELT + 0.14, z);
      pad.rotation.y = rot;
      g.add(pad);
      const cap = box(len, 0.045, 0.2, M.woodMat, x, FELT + 0.27, z);
      cap.rotation.y = rot;
      g.add(cap);
      /* the chip rack runs along the inside of the two long rails */
      if (rot === 0) {
        const rack = box(len - 0.5, 0.06, 0.1, M.darkMetal, x, FELT + 0.05, z + (z < 0 ? 0.12 : -0.12));
        g.add(rack);
      }
    });

  /* apron and plinth */
  const apron = box(L - 0.06, 0.52, W - 0.06, M.woodMat, 0, FELT - 0.29, 0);
  g.add(apron);
  g.add(box(L + 0.06, 0.07, W + 0.06, M.brass, 0, FELT + 0.02, 0));
  const plinth = box(L - 0.9, 0.14, W - 0.5, M.darkMetal, 0, 0.07, 0);
  g.add(plinth);

  /* dealer's bank in the middle of one side, and the stick */
  g.add(box(0.9, 0.1, 0.26, M.darkMetal, 0, FELT + 0.06, -W / 2 + 0.3));
  const mirror = box(L - 1.4, 0.34, 0.05, new THREE.MeshPhysicalMaterial({
    color: 0x0a1512, metalness: 0.2, roughness: 0.08, clearcoat: 1
  }), 0, FELT + 0.17, -W / 2 + 0.02);
  g.add(mirror);
  return g;
}

/* ---------- slot machine ---------- */
function slotMachine(M, hue) {
  const g = new THREE.Group();
  const body = box(0.72, 1.0, 0.62, M.darkMetal, 0, 0.5, 0);
  g.add(body);
  g.add(box(0.76, 0.1, 0.66, M.brass, 0, 1.02, 0));
  /* the screen is the only thing in the room that should really bloom */
  const screen = box(0.6, 0.78, 0.04, M.emissive(hue, 1.5), 0, 1.5, 0.22, false, false);
  g.add(screen);
  const bezel = box(0.7, 0.92, 0.1, M.darkMetal, 0, 1.5, 0.17);
  g.add(bezel);
  const topper = box(0.72, 0.34, 0.12, M.emissive(0xffcf6a, 1.8), 0, 2.08, 0.1, false, false);
  g.add(topper);
  g.add(box(0.78, 0.06, 0.2, M.brass, 0, 1.9, 0.1));
  /* the deck you rest your hands on, and the stool */
  const deck = box(0.76, 0.08, 0.3, M.woodMat, 0, 1.02, 0.4);
  g.add(deck);
  const stool = new THREE.Group();
  stool.add(new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.08, 18), M.woodMat));
  stool.children[0].position.y = 0.66;
  stool.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.66, 10), M.darkMetal));
  stool.children[1].position.y = 0.33;
  stool.add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.04, 18), M.darkMetal));
  stool.children[2].position.y = 0.02;
  stool.position.set(0, 0, 1.0);
  stool.children.forEach(c => { c.castShadow = true; });
  g.add(stool);
  return g;
}

export function buildFixtures(scene, M) {
  const F = new THREE.Group();
  F.name = 'fixtures';
  F.add(pitRail(M));

  /* craps in the middle of the pit, the card games either side of it */
  const craps = crapsTable(M);
  craps.position.set(0, -ROOM.pit.drop, 0);
  craps.userData.game = { id: 'craps', seat: { x: 0, y: 1.25, z: 2.1, look: [0, 0.95, 0] } };
  F.add(craps);
  contact(scene, 0, 0, 5.4, 3.4, 0.6, -ROOM.pit.drop + 0.004);

  const places = [
    ['blackjack', -5.6, -3.0, 0.5],
    ['blackjack', -5.6, 3.0, -0.5],
    ['baccarat', 5.8, 0, Math.PI]
  ];
  places.forEach(([id, x, z, rot]) => {
    const t = cardTable(M, id);
    t.position.set(x, -ROOM.pit.drop, z);
    t.rotation.y = rot;
    t.userData.game = { id, seat: { x: 0, y: 1.2, z: 1.9, look: [0, 0.85, 0] } };
    F.add(t);
    contact(scene, x, z, 4.2, 3.4, 0.5, -ROOM.pit.drop + 0.004);
  });

  /* slot banks down both long walls, facing in */
  const bank = (x, z, rot, n, hues) => {
    for (let i = 0; i < n; i++) {
      const m = slotMachine(M, hues[i % hues.length]);
      const off = (i - (n - 1) / 2) * 0.86;
      m.position.set(x + Math.cos(rot) * off, 0, z - Math.sin(rot) * off);
      m.rotation.y = rot;
      m.userData.game = { id: i % 2 ? 'lights' : 'pinball', seat: { x: 0, y: 1.25, z: 0.95, look: [0, 1.45, 0.2] } };
      F.add(m);
    }
    contact(scene, x, z, n * 0.95, 2.4, 0.42);
  };
  bank(-13.4, -6.5, Math.PI / 2, 7, [0x7b3fd0, 0xd04a2a, 0x2aa6d0]);
  bank(-13.4, 6.5, Math.PI / 2, 7, [0xd04a2a, 0x7b3fd0, 0xe0a52a]);
  bank(13.4, -6.5, -Math.PI / 2, 7, [0x2aa6d0, 0xe0a52a, 0x7b3fd0]);
  bank(13.4, 6.5, -Math.PI / 2, 7, [0xe0a52a, 0x2aa6d0, 0xd04a2a]);

  /* the cage at the back, and a bar opposite */
  const cage = new THREE.Group();
  cage.add(box(7.2, 1.1, 1.0, M.marbleMat, 0, 0.55, 0));
  cage.add(box(7.4, 0.08, 1.2, M.brass, 0, 1.13, 0));
  cage.add(box(7.2, 2.2, 0.1, M.darkMetal, 0, 2.2, -0.45));
  for (let i = -3; i <= 3; i++) {
    cage.add(box(0.06, 1.9, 0.06, M.brass, i * 1.1, 2.15, 0.2));
  }
  cage.add(box(4.6, 0.3, 0.1, M.emissive(0xffcf8a, 1.1), 0, 3.3, -0.4, false, false));
  cage.add(box(7.0, 0.03, 0.06, M.emissive(0xffd9a0, 1.0), 0, 1.18, 0.56, false, false));
  cage.position.set(0, 0, -ROOM.d / 2 + 1.4);
  F.add(cage);
  contact(scene, 0, -ROOM.d / 2 + 1.4, 9, 3, 0.5);

  const bar = new THREE.Group();
  bar.add(box(8.0, 1.15, 1.2, M.woodMat, 0, 0.575, 0));
  bar.add(box(8.3, 0.08, 1.45, M.marbleMat, 0, 1.19, 0));
  bar.add(box(7.6, 2.6, 0.5, M.darkMetal, 0, 2.3, -0.9));
  bar.add(box(7.0, 0.06, 0.4, M.emissive(0x7fe8ff, 2.2), 0, 1.6, -0.62, false, false));
  bar.add(box(7.0, 0.06, 0.4, M.emissive(0x7fe8ff, 2.2), 0, 2.3, -0.62, false, false));
  bar.add(box(7.0, 0.06, 0.4, M.emissive(0x7fe8ff, 2.2), 0, 3.0, -0.62, false, false));
  for (let i = -3; i <= 3; i++) {
    const s = new THREE.Group();
    s.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 18), M.woodMat));
    s.children[0].position.y = 0.74;
    s.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.74, 10), M.brass));
    s.children[1].position.y = 0.37;
    s.position.set(i * 1.05, 0, 1.05);
    s.children.forEach(c => { c.castShadow = true; });
    bar.add(s);
  }
  bar.position.set(0, 0, ROOM.d / 2 - 1.6);
  bar.rotation.y = Math.PI;
  F.add(bar);
  contact(scene, 0, ROOM.d / 2 - 1.6, 10, 3.4, 0.5);

  scene.add(F);
  return F;
}
