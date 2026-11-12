/* What stands in the room. The tables carry their real layouts, there are
   chips and dice and a dealer at each one, and the slot screens run their own
   game so you can tell a bank apart from across the floor. */
import * as THREE from 'three';
import { ROOM } from './room.js';
import { crapsLayout, blackjackLayout, baccaratLayout, signTexture } from './felt.js';
import { chipRack, chipStack, die, shoe, cards, dealer } from './props.js';

function box(w, h, d, mat, x, y, z, cast = true, receive = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}
function contact(scene, x, z, rx, rz, strength = 0.55, y = 0.004) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,' + strength + ')');
  g.addColorStop(0.55, 'rgba(0,0,0,' + strength * 0.45 + ')');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(rx, rz),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.renderOrder = -1;
  scene.add(m);
}

/* ---------- the pit rail ---------- */
function pitRail(M, solids) {
  const g = new THREE.Group();
  const { w, d } = ROOM.pit;
  const H = 0.92;
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xbfe8d8, metalness: 0, roughness: 0.3, transparent: true, opacity: 0.09,
    clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide
  });
  const runs = [
    [0, -d / 2 - 1.2, w * 0.44, 0, -w * 0.27], [0, -d / 2 - 1.2, w * 0.44, 0, w * 0.27],
    [0, d / 2 + 1.2, w * 0.44, 0, -w * 0.27], [0, d / 2 + 1.2, w * 0.44, 0, w * 0.27],
    [-w / 2 - 1.2, 0, d * 0.76, Math.PI / 2, 0], [w / 2 + 1.2, 0, d * 0.76, Math.PI / 2, 0]
  ];
  runs.forEach(([x, z, len, rot, off]) => {
    const run = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, len, 14), M.brass);
    top.rotation.z = Math.PI / 2;
    top.position.y = H;
    top.castShadow = true;
    run.add(top);
    run.add(box(len - 0.1, H - 0.3, 0.025, glass, 0, H / 2 - 0.02, 0, false, false));
    run.add(box(len - 0.1, 0.02, 0.05, M.emissive(0x7ad8b4, 0.75), 0, 0.16, 0, false, false));
    const posts = Math.max(2, Math.round(len / 2.1));
    for (let i = 0; i <= posts; i++) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, H, 10), M.brass);
      p.position.set(-len / 2 + (len / posts) * i, H / 2, 0);
      p.castShadow = true;
      run.add(p);
    }
    run.rotation.y = rot;
    run.position.set(x + (rot ? 0 : off), 0, z + (rot ? off : 0));
    g.add(run);
    if (solids) solids.add(run.position.x, run.position.z, len / 2, 0.09, rot, 'rail');
  });
  return g;
}

/* ---------- craps ----------
   A 12 foot table: the layout sunk inside a padded rail, chips racked in front
   of the dealers, dice sitting where the stickman left them. */
function crapsTable(M, crapless) {
  const g = new THREE.Group();
  const L = 3.66, W = 1.42, FELT = 0.78;
  const railMat = new THREE.MeshStandardMaterial({ color: 0x3a1420, roughness: 0.72, metalness: 0.05 });

  const feltMat = new THREE.MeshStandardMaterial({ map: crapsLayout(crapless), roughness: 0.96 });
  const top = box(L - 0.3, 0.06, W - 0.3, feltMat, 0, FELT, 0);
  g.add(top);
  /* the filler under the layout has to stop below it, or it hides the cloth */
  g.add(box(L - 0.28, 0.2, W - 0.28, M.feltMat, 0, FELT - 0.13, 0, false, true));

  [[0, -W / 2 + 0.07, L, 0], [0, W / 2 - 0.07, L, 0],
   [-L / 2 + 0.07, 0, W - 0.14, Math.PI / 2], [L / 2 - 0.07, 0, W - 0.14, Math.PI / 2]]
    .forEach(([x, z, len, rot]) => {
      const pad = box(len, 0.22, 0.17, railMat, x, FELT + 0.14, z);
      pad.rotation.y = rot;
      g.add(pad);
      const cap = box(len, 0.045, 0.2, M.woodMat, x, FELT + 0.27, z);
      cap.rotation.y = rot;
      g.add(cap);
      if (rot === 0) {
        const rack = box(len - 0.5, 0.06, 0.1, M.darkMetal, x, FELT + 0.05, z + (z < 0 ? 0.12 : -0.12));
        g.add(rack);
        /* players' chips sitting in the rail */
        for (let i = -5; i <= 5; i++) {
          if (Math.random() < 0.35) continue;
          g.add(chipStack([5, 25, 100, 500][Math.floor(Math.random() * 4)], 2 + Math.floor(Math.random() * 5),
            i * 0.26, FELT + 0.08, z + (z < 0 ? 0.12 : -0.12)));
        }
      }
    });

  g.add(box(L - 0.06, 0.52, W - 0.06, M.woodMat, 0, FELT - 0.29, 0));
  /* brass banding around the apron, not across the table: a slab there covers
     the layout, which is the one thing on a craps table worth seeing */
  [[0, -W / 2 + 0.02, L - 0.06, 0], [0, W / 2 - 0.02, L - 0.06, 0],
   [-L / 2 + 0.02, 0, W - 0.06, Math.PI / 2], [L / 2 - 0.02, 0, W - 0.06, Math.PI / 2]]
    .forEach(([x, z, len, rot]) => {
      const band = box(len, 0.05, 0.08, M.brass, x, FELT - 0.05, z);
      band.rotation.y = rot;
      g.add(band);
    });
  g.add(box(L - 0.9, 0.14, W - 0.5, M.darkMetal, 0, 0.07, 0));

  /* the dealers' bank, and the two of them behind it */
  g.add(chipRack(0, FELT + 0.045, -W / 2 + 0.3));
  g.add(chipRack(-1.25, FELT + 0.045, -W / 2 + 0.3));
  g.add(chipRack(1.25, FELT + 0.045, -W / 2 + 0.3));
  g.add(die(0.42, FELT + 0.04, 0.3, [0.3, 0.8, 0]));
  g.add(die(0.49, FELT + 0.04, 0.26, [1.2, 0.2, 0.4]));
  const d1 = dealer(-1.0, -W / 2 - 0.42, 0);
  const d2 = dealer(1.0, -W / 2 - 0.42, 0);
  const box_ = dealer(0, -W / 2 - 0.52, 0);
  box_.scale.setScalar(1.02);
  g.add(d1, d2, box_);
  g.userData.dealers = [d1, d2, box_];

  /* a lit sign over the table saying which game it is */
  const signMat = new THREE.MeshBasicMaterial({
    map: signTexture(crapless ? 'CRAPLESS' : 'CRAPS', crapless ? '#7fe8ff' : '#ffcf6a'), toneMapped: false
  });
  g.add(box(1.25, 0.31, 0.03, signMat, 0, 1.72, -W / 2 - 0.19, false, false));
  g.add(box(1.33, 0.39, 0.09, M.darkMetal, 0, 1.72, -W / 2 - 0.23));
  g.add(box(0.05, 0.9, 0.05, M.darkMetal, 0, 1.3, -W / 2 - 0.24));
  return g;
}

/* ---------- card tables ---------- */
function cardTable(M, kind) {
  const g = new THREE.Group();
  const rx = kind === 'baccarat' ? 1.5 : 1.25, rz = 0.95;
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, rx, rz, 0, Math.PI * 2, false, 0);
  const layout = kind === 'baccarat' ? baccaratLayout() : blackjackLayout();
  const top = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
    depth: 0.09, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.05, bevelSegments: 3, curveSegments: 48
  }), [new THREE.MeshStandardMaterial({ map: layout, roughness: 0.96 }),
       new THREE.MeshStandardMaterial({ color: 0x0d4727, roughness: 0.96 })]);
  /* the extrude puts the face and the side in separate groups, so the layout
     lands on the face and plain cloth on the edge */
  top.geometry.groups.forEach((gr, i) => { gr.materialIndex = i === 0 ? 0 : 1; });
  const uv = top.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (uv.getX(i) + rx) / (rx * 2), (uv.getY(i) + rz) / (rz * 2));
  }
  uv.needsUpdate = true;
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

  /* the dealer's side: rack, shoe, a hand already out */
  g.add(chipRack(0, 0.875, -rz + 0.3));
  g.add(shoe(0.62, 0.875, -rz + 0.34, -0.3));
  g.add(cards(-0.1, 0.875, -rz + 0.52, 2));
  const seats = kind === 'baccarat' ? 7 : 5;
  for (let i = 0; i < seats; i++) {
    const a = Math.PI + (i - (seats - 1) / 2) * 0.42;
    const cx = Math.cos(a) * (rx + 0.75), cz = Math.sin(a) * (rz + 0.75);
    const chair = new THREE.Group();
    chair.add(box(0.46, 0.09, 0.46, M.woodMat, 0, 0.47, 0));
    chair.add(box(0.44, 0.55, 0.1, M.woodMat, 0, 0.78, -0.2));
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.47, 10), M.darkMetal);
    post.position.y = 0.235;
    chair.add(post);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.04, 16), M.darkMetal);
    base.position.y = 0.02;
    chair.add(base);
    chair.position.set(cx, 0, cz);
    chair.lookAt(0, 0, 0);
    chair.children.forEach(c => { c.castShadow = true; });
    g.add(chair);
    /* a few chips in front of the occupied seats */
    if (Math.random() < 0.6) {
      const bx = Math.cos(a) * (rx - 0.42), bz = Math.sin(a) * (rz - 0.32);
      g.add(chipStack([5, 25, 100][Math.floor(Math.random() * 3)], 3 + Math.floor(Math.random() * 6), bx, 0.875, bz));
    }
  }
  const d = dealer(0, -(rz + 0.52), 0);
  g.add(d);
  g.userData.dealers = [d];
  return g;
}

/* ---------- slot machine ---------- */
function slotMachine(M, screens, game) {
  const g = new THREE.Group();
  g.add(box(0.72, 1.0, 0.62, M.darkMetal, 0, 0.5, 0));
  g.add(box(0.76, 0.1, 0.66, M.brass, 0, 1.02, 0));
  const screen = box(0.6, 0.78, 0.03, screens.material(game), 0, 1.5, 0.23, false, false);
  g.add(screen);
  g.add(box(0.7, 0.92, 0.1, M.darkMetal, 0, 1.5, 0.17));
  const topper = box(0.74, 0.3, 0.03, screens.topper(game), 0, 2.08, 0.14, false, false);
  g.add(topper);
  g.add(box(0.8, 0.38, 0.1, M.darkMetal, 0, 2.08, 0.09));
  g.add(box(0.78, 0.06, 0.2, M.brass, 0, 1.88, 0.1));
  g.add(box(0.76, 0.08, 0.3, M.woodMat, 0, 1.02, 0.4));
  const stool = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.08, 18), M.woodMat);
  seat.position.y = 0.66;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.66, 10), M.darkMetal);
  post.position.y = 0.33;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.04, 18), M.darkMetal);
  base.position.y = 0.02;
  stool.add(seat, post, base);
  stool.position.set(0, 0, 1.0);
  stool.children.forEach(c => { c.castShadow = true; });
  g.add(stool);
  return g;
}

export function buildFixtures(scene, M, solids, screens) {
  const F = new THREE.Group();
  F.name = 'fixtures';
  F.add(pitRail(M, solids));
  const dealers = [];
  const drop = -ROOM.pit.drop;

  /* two craps tables side by side: the regular game and crapless */
  [['craps', -4.8, false], ['crapless', 4.8, true]].forEach(([id, x, isCrapless]) => {
    const t = crapsTable(M, isCrapless);
    t.position.set(x, drop, -2.9);
    t.userData.game = { id, seat: { x: 0, y: 1.42, z: 1.35, look: [0, 0.82, -0.2] } };
    F.add(t);
    dealers.push(...t.userData.dealers);
    solids.add(x, -2.9, 2.0, 1.1, 0, id);
    contact(scene, x, -2.9, 5.6, 3.6, 0.6, drop + 0.004);
  });

  /* the card games across from them */
  [['blackjack', -6.4, 3.3, 0.22], ['baccarat', 0, 3.6, 0], ['blackjack', 6.4, 3.3, -0.22]]
    .forEach(([id, x, z, rot]) => {
      const t = cardTable(M, id);
      t.position.set(x, drop, z);
      t.rotation.y = rot;
      t.userData.game = { id, seat: { x: 0, y: 1.22, z: 1.62, look: [0, 0.8, -0.1] } };
      F.add(t);
      dealers.push(...t.userData.dealers);
      solids.add(x, z, 1.9, 1.7, rot, id);
      contact(scene, x, z, 4.6, 3.8, 0.5, drop + 0.004);
    });

  /* slot banks, one game to a bank so you can see what you are walking towards */
  const bank = (x, z, rot, n, game) => {
    for (let i = 0; i < n; i++) {
      const m = slotMachine(M, screens, game);
      const off = (i - (n - 1) / 2) * 0.86;
      m.position.set(x + Math.cos(rot) * off, 0, z - Math.sin(rot) * off);
      m.rotation.y = rot;
      m.userData.game = { id: game, seat: { x: 0, y: 1.3, z: 0.82, look: [0, 1.5, 0.18] } };
      F.add(m);
      solids.add(m.position.x, m.position.z, 0.44, 0.42, rot, 'slot');
    }
    contact(scene, x, z, n * 0.95, 2.4, 0.42);
  };
  bank(-14.6, -7.0, Math.PI / 2, 7, 'lights');
  bank(-14.6, 7.0, Math.PI / 2, 7, 'purim');
  bank(14.6, -7.0, -Math.PI / 2, 7, 'pinball');
  bank(14.6, 7.0, -Math.PI / 2, 7, 'lights');

  const cage = new THREE.Group();
  cage.add(box(7.2, 1.1, 1.0, M.marbleMat, 0, 0.55, 0));
  cage.add(box(7.4, 0.08, 1.2, M.brass, 0, 1.13, 0));
  cage.add(box(7.2, 2.2, 0.1, M.darkMetal, 0, 2.2, -0.45));
  for (let i = -3; i <= 3; i++) cage.add(box(0.06, 1.9, 0.06, M.brass, i * 1.1, 2.15, 0.2));
  cage.add(box(4.6, 0.3, 0.1, M.emissive(0xffcf8a, 1.1), 0, 3.3, -0.4, false, false));
  cage.add(box(7.0, 0.03, 0.06, M.emissive(0xffd9a0, 1.0), 0, 1.18, 0.56, false, false));
  const cashier = dealer(-1.6, -0.75, Math.PI);
  const cashier2 = dealer(1.6, -0.75, Math.PI);
  cage.add(cashier, cashier2);
  dealers.push(cashier, cashier2);
  cage.position.set(0, 0, -ROOM.d / 2 + 1.4);
  F.add(cage);
  solids.add(0, -ROOM.d / 2 + 1.4, 3.7, 0.8, 0, 'cage');
  contact(scene, 0, -ROOM.d / 2 + 1.4, 9, 3, 0.5);

  const bar = new THREE.Group();
  bar.add(box(8.0, 1.15, 1.2, M.woodMat, 0, 0.575, 0));
  bar.add(box(8.3, 0.08, 1.45, M.marbleMat, 0, 1.19, 0));
  bar.add(box(7.6, 2.6, 0.5, M.darkMetal, 0, 2.3, -0.9));
  [1.6, 2.3, 3.0].forEach(y => bar.add(box(7.0, 0.06, 0.4, M.emissive(0x7fe8ff, 2.2), 0, y, -0.62, false, false)));
  for (let i = -3; i <= 3; i++) {
    const s = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 18), M.woodMat);
    seat.position.y = 0.74;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.74, 10), M.brass);
    post.position.y = 0.37;
    s.add(seat, post);
    s.position.set(i * 1.05, 0, 1.05);
    s.children.forEach(c => { c.castShadow = true; });
    bar.add(s);
  }
  const keep = dealer(0, -0.95, Math.PI);
  bar.add(keep);
  dealers.push(keep);
  bar.position.set(0, 0, ROOM.d / 2 - 1.6);
  bar.rotation.y = Math.PI;
  F.add(bar);
  solids.add(0, ROOM.d / 2 - 1.6, 4.2, 1.1, 0, 'bar');
  contact(scene, 0, ROOM.d / 2 - 1.6, 10, 3.4, 0.5);

  scene.add(F);
  F.userData.dealers = dealers;
  return F;
}
