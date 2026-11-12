/* What stands in the room. The tables carry their real layouts, there are
   chips and dice and a dealer at each one, and the slot screens run their own
   game so you can tell a bank apart from across the floor. */
import * as THREE from 'three';
import { ROOM } from './room.js';
import { tune } from './materials.js';
import { houseSign, monogram, artWall } from './decor.js';
import { crapsLayout, blackjackLayout, baccaratLayout, rouletteLayout, wheelFace, terminalIdle, signTexture } from './felt.js';
import { chipRack, chipStack, die, shoe, cards, dealer, patron, bottles, glassware } from './props.js';

function box(w, h, d, mat, x, y, z, cast = true, receive = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}
/* One soft blob, shared by every fixture that needs a shadow under it; the
   strength rides on the material's opacity so a dozen of these cost one
   texture instead of a dozen. */
let blobTex = null;
function contactTexture() {
  if (blobTex) return blobTex;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.55, 'rgba(0,0,0,.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  blobTex = tune(new THREE.CanvasTexture(c), { srgb: false });
  return blobTex;
}
function contact(scene, x, z, rx, rz, strength = 0.55, y = 0.004) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(rx, rz),
    new THREE.MeshBasicMaterial({
      map: contactTexture(), transparent: true, depthWrite: false, opacity: strength
    }));
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
      if (rot === 0 && z > 0) {
        /* the players' chip groove runs along the top of the rail on their
           side only, which is where it is on a real table. Putting it on the
           layout buried the cloth. */
        const groove = box(len - 0.5, 0.04, 0.09, M.darkMetal, x, FELT + 0.26, z + 0.01);
        g.add(groove);
        for (let i = -5; i <= 5; i++) {
          if (Math.random() < 0.45) continue;
          g.add(chipStack([5, 25, 100, 500][Math.floor(Math.random() * 4)], 2 + Math.floor(Math.random() * 4),
            i * 0.26, FELT + 0.28, z + 0.01));
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

  /* The bank sits at the dealers' edge of the cloth, not across it. */
  g.add(chipRack(0, FELT + 0.045, -W / 2 + 0.17));
  g.add(chipRack(-1.3, FELT + 0.045, -W / 2 + 0.17, 0, [500, 100, 25]));
  g.add(chipRack(1.3, FELT + 0.045, -W / 2 + 0.17, 0, [500, 100, 25]));
  g.add(die(0.42, FELT + 0.04, 0.26, [0.3, 0.8, 0]));
  g.add(die(0.49, FELT + 0.04, 0.22, [1.2, 0.2, 0.4]));
  const d1 = dealer(-1.0, -W / 2 - 0.42, 0);
  const d2 = dealer(1.0, -W / 2 - 0.42, 0);
  const box_ = dealer(0, -W / 2 - 0.52, 0);
  box_.scale.setScalar(1.02);
  g.add(d1, d2, box_);
  g.userData.dealers = [d1, d2, box_];
  const tm = terminal(M, terminalIdle(crapless ? 'Crapless Craps' : 'Craps', 'Take a seat to play'),
    { w: 1.02, tilt: 0.52, y: 1.2, z: W / 2 + 0.44, stem: 0.52 });
  g.add(tm.group);
  g.userData.glass = tm.glass;
  /* places at the near rail, for whoever turns up: the middle is left clear so
     you can walk in and take the shooter's spot yourself */
  g.userData.spots = [-1.7, -1.3, -0.95, 0.95, 1.3, 1.7]
    .map(px => ({
      x: px, z: W / 2 + 0.46, facing: Math.PI, sit: false,
      /* straight back off the rail, which keeps the walk clear of the wheel
         standing in the middle of the pit */
      gate: [px, W / 2 + 1.86]
    }));

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
  g.add(chipRack(0, 0.875, -rz + 0.18));
  g.add(shoe(0.62, 0.875, -rz + 0.34, -0.3));
  g.add(cards(-0.1, 0.875, -rz + 0.52, 2));
  const seats = kind === 'baccarat' ? 7 : 5;
  for (let i = 0; i < seats; i++) {
    const a = Math.PI / 2 + (i - (seats - 1) / 2) * 0.42;
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
    /* the middle chair is yours, so nobody else takes it */
    if (i !== (seats - 1) / 2) {
      (g.userData.spots = g.userData.spots || []).push({
        x: cx * 0.98, z: cz * 0.98, facing: Math.atan2(-cx, -cz), sit: true, seatY: 0.52
      });
    }
    /* a few chips in front of the occupied seats */
    if (Math.random() < 0.6) {
      const bx = Math.cos(a) * (rx - 0.42), bz = Math.sin(a) * (rz - 0.32);
      g.add(chipStack([5, 25, 100][Math.floor(Math.random() * 3)], 3 + Math.floor(Math.random() * 6), bx, 0.875, bz));
    }
  }
  const d = dealer(0, -(rz + 0.52), 0);
  g.add(d);
  g.userData.dealers = [d];
  const tm = terminal(M, terminalIdle(kind === 'baccarat' ? 'Baccarat' : 'Blackjack', 'Take a seat to play'),
    { w: 0.92, tilt: 0.56, y: 1.04, z: rz + 0.34, stem: 0.42 });
  g.add(tm.group);
  g.userData.glass = tm.glass;
  return g;
}


/* ---------- the player's terminal ----------
   Every table carries one at the seat you take: a screen on a short stand,
   leaned back so that it reads from a seated eye. Walking past it shows the
   game's own layout; sitting down puts the live page on the same glass. That
   is how stadium craps and roulette work on a real floor, and it is what lets
   the games be played out here rather than in a window over the top. */
function terminal(M, idleTex, opt) {
  const g = new THREE.Group();
  const w = opt.w, h = w * 980 / 1440, tilt = opt.tilt;
  const bezel = box(w + 0.07, h + 0.07, 0.045, M.darkMetal, 0, 0, 0);
  bezel.rotation.x = -tilt;
  g.add(bezel);
  /* the face sits a couple of centimetres proud of the bezel, along the
     tilted normal rather than straight out, or it sinks in at the top */
  const nx = Math.sin(tilt) * 0.026, nz = Math.cos(tilt) * 0.026;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: idleTex }));
  screen.rotation.x = -tilt;
  screen.position.set(0, nx, nz);
  screen.name = 'glass';
  g.add(screen);
  /* a sliver of light under the bezel, so it reads as a lit panel */
  const lip = box(w + 0.05, 0.02, 0.06, M.emissive(0xffc98a, 0.8),
    0, -Math.cos(tilt) * (h / 2) - 0.03, Math.sin(tilt) * (h / 2) + 0.04, false, false);
  g.add(lip);
  const stem = box(0.1, opt.stem, 0.1, M.darkMetal, 0, -h / 2 - opt.stem / 2, 0.02);
  g.add(stem);
  const foot = box(0.34, 0.035, 0.26, M.darkMetal, 0, -h / 2 - opt.stem, 0.02);
  g.add(foot);
  g.position.set(0, opt.y, opt.z);
  g.traverse(o => { if (o.isMesh && o.name !== 'glass') o.castShadow = true; });
  return { group: g, glass: { w, h, x: 0, y: opt.y + nx, z: opt.z + nz, tilt } };
}

/* ---------- roulette ----------
   Long and narrow, the wheel sunk into the far end, the cloth running back
   toward the players and a terminal at the near end to play it from. */
function rouletteTable(M, american) {
  const g = new THREE.Group();
  const L = 2.9, W = 1.42, FELT = 0.78;
  const railMat = new THREE.MeshStandardMaterial({ color: 0x3a1420, roughness: 0.72, metalness: 0.05 });

  /* the cloth: the layout fills the half of the table nearest the player */
  const layout = rouletteLayout(american);
  const cloth = box(W - 0.3, 0.06, 1.72, new THREE.MeshStandardMaterial({ map: layout, roughness: 0.96 }),
    0, FELT, 0.52);
  g.add(cloth);
  /* plain cloth under the wheel end */
  g.add(box(W - 0.3, 0.06, L - 2.02, M.feltMat, 0, FELT, -(L / 2) + 0.44));
  g.add(box(W - 0.28, 0.2, L - 0.28, M.feltMat, 0, FELT - 0.13, 0, false, true));

  /* rails: two long ones down the sides, two short ones across the ends */
  [[-W / 2 + 0.085, 0, 0.17, L], [W / 2 - 0.085, 0, 0.17, L],
   [0, -L / 2 + 0.085, W, 0.17], [0, L / 2 - 0.085, W, 0.17]]
    .forEach(([x, z, sx, sz]) => {
      g.add(box(sx, 0.22, sz, railMat, x, FELT + 0.14, z));
      g.add(box(sx + 0.03, 0.045, sz + 0.03, M.woodMat, x, FELT + 0.27, z));
    });
  /* the apron */
  g.add(box(W - 0.06, 0.52, L - 0.06, M.woodMat, 0, FELT - 0.29, 0));
  g.add(box(W + 0.02, 0.06, L + 0.02, M.brass, 0, FELT - 0.56, 0));
  const leg = (x, z) => g.add(box(0.12, FELT - 0.56, 0.12, M.darkMetal, x, (FELT - 0.56) / 2, z));
  leg(-W / 2 + 0.22, -L / 2 + 0.25); leg(W / 2 - 0.22, -L / 2 + 0.25);
  leg(-W / 2 + 0.22, L / 2 - 0.25); leg(W / 2 - 0.22, L / 2 - 0.25);

  /* ---- the wheel, sunk into the far end ---- */
  const wz = -L / 2 + 0.62;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.47, 0.14, 40), M.woodMat);
  bowl.position.set(0, FELT + 0.04, wz);
  bowl.castShadow = true;
  g.add(bowl);
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.022, 10, 44), M.brass)
    .translateY(0));
  const ring = g.children[g.children.length - 1];
  ring.position.set(0, FELT + 0.11, wz);
  ring.rotation.x = Math.PI / 2;

  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.4, 56),
    new THREE.MeshStandardMaterial({ map: wheelFace(american), roughness: 0.55, metalness: 0.15 }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(0, FELT + 0.112, wz);
  g.add(disc);

  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.018, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0xfffdf4, roughness: 0.25 }));
  ball.position.set(0, FELT + 0.13, wz - 0.33);
  g.add(ball);

  /* the marker on the winning number, and the dealer beside the wheel */
  const dolly = box(0.05, 0.14, 0.05, M.emissive(0xffd27a, 0.5), 0.18, FELT + 0.1, 0.45, false, false);
  g.add(dolly);
  g.add(chipRack(0, FELT + 0.045, -L / 2 + 1.02, Math.PI / 2, [500, 100, 25]));

  const d = dealer(-W / 2 - 0.45, wz + 0.35, Math.PI / 2);
  g.add(d);
  g.userData.dealers = [d];
  g.userData.spin = { disc, ball, wz, felt: FELT, t: Math.random() * 10 };

  /* seats down both sides */
  g.userData.spots = [];
  [-1, 1].forEach(side => {
    [0.15, 0.78].forEach(z => {
      const chair = new THREE.Group();
      chair.add(box(0.44, 0.09, 0.44, M.woodMat, 0, 0.47, 0));
      chair.add(box(0.42, 0.52, 0.1, M.woodMat, 0, 0.77, -0.19));
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.47, 10), M.darkMetal);
      post.position.y = 0.235;
      chair.add(post);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.04, 16), M.darkMetal);
      base.position.y = 0.02;
      chair.add(base);
      chair.position.set(side * (W / 2 + 0.46), 0, z);
      chair.rotation.y = side * Math.PI / 2;
      chair.children.forEach(c => { c.castShadow = true; });
      g.add(chair);
      g.userData.spots.push({
        x: side * (W / 2 + 0.44), z: z, facing: -side * Math.PI / 2, sit: true, seatY: 0.52,
        /* the clear floor beside the table, so nobody walks over the wheel */
        gate: [side * 2.3, 2.3]
      });
    });
  });

  const tm = terminal(M, terminalIdle('Roulette', american ? 'Double zero' : 'Single zero'),
    { w: 0.96, tilt: 0.52, y: 1.18, z: L / 2 + 0.42, stem: 0.5 });
  g.add(tm.group);
  g.userData.glass = tm.glass;
  return g;
}

/* ---------- slot machine ---------- */
function slotMachine(M, screens, game) {
  const g = new THREE.Group();
  /* The glass is in the proportion of the game page itself (1440x980), so the
     real game can be laid onto it when you sit down without squashing. */
  const GW = 0.69, GH = GW * 980 / 1440, GY = 1.36, GZ = 0.245;
  g.add(box(0.78, 1.1, 0.62, M.darkMetal, 0, 0.55, 0));
  g.add(box(0.82, 0.1, 0.66, M.brass, 0, 1.12, 0));
  const screen = box(GW, GH, 0.03, screens.material(game), 0, GY, GZ - 0.015, false, false);
  screen.name = 'glass';
  g.add(screen);
  g.add(box(GW + 0.08, GH + 0.1, 0.1, M.darkMetal, 0, GY, 0.17));
  const topper = box(0.76, 0.42, 0.03, screens.topper(game), 0, 1.98, 0.14, false, false);
  g.add(topper);
  g.add(box(0.82, 0.5, 0.1, M.darkMetal, 0, 1.98, 0.09));
  g.add(box(0.8, 0.06, 0.2, M.brass, 0, 1.69, 0.1));
  g.add(box(0.8, 0.08, 0.3, M.woodMat, 0, 1.12, 0.4));
  /* the button deck, which is what your hands are over while you play */
  g.add(box(0.74, 0.04, 0.26, M.darkMetal, 0, 1.1, 0.42));
  for (let i = -2; i <= 2; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 14),
      M.emissive(i === 2 ? 0xffc14a : 0x7fe8ff, 0.5));
    b.position.set(i * 0.13, 1.13, 0.44);
    g.add(b);
  }
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
  /* where the game page gets laid, in the machine's own coordinates */
  g.userData.glass = { w: GW, h: GH, y: GY, z: GZ };
  return g;
}

export function buildFixtures(scene, M, solids, screens, book) {
  const spots = [];
  /* a place recorded in a fixture's own frame, lifted into the room */
  const v3 = new THREE.Vector3();
  const collect = obj => {
    (obj.userData.spots || []).forEach(sp => {
      v3.set(sp.x, 0, sp.z);
      obj.updateMatrixWorld(true);
      v3.applyMatrix4(obj.matrixWorld);
      const rec = {
        x: v3.x, z: v3.z, facing: sp.facing + obj.rotation.y,
        sit: sp.sit, seatY: sp.seatY || 0
      };
      if (sp.gate) {
        v3.set(sp.gate[0], 0, sp.gate[1]).applyMatrix4(obj.matrixWorld);
        rec.gate = [v3.x, v3.z];
      }
      spots.push(rec);
    });
  };
  const F = new THREE.Group();
  F.name = 'fixtures';
  F.add(pitRail(M, solids));
  const dealers = [];
  const wheels = [];
  const drop = -ROOM.pit.drop;

  /* two craps tables side by side: the regular game and crapless */
  [['craps', -4.8, false], ['crapless', 4.8, true]].forEach(([id, x, isCrapless]) => {
    const t = crapsTable(M, isCrapless);
    t.position.set(x, drop, -2.9);
    t.userData.game = { id, seat: { x: 0, y: 1.56, z: 1.9, look: [0, 1.21, 1.17] } };
    F.add(t);
    dealers.push(...t.userData.dealers);
    collect(t);
    solids.add(x, -2.9, 2.0, 1.1, 0, id);
    contact(scene, x, -2.9, 5.6, 3.6, 0.6, drop + 0.004);
  });

  /* roulette, between the two craps tables */
  const roul = rouletteTable(M, false);
  roul.position.set(0, drop, -2.9);
  roul.userData.game = { id: 'roulette', seat: { x: 0, y: 1.58, z: 2.52, look: [0, 1.2, 1.9] } };
  F.add(roul);
  dealers.push(...roul.userData.dealers);
  collect(roul);
  wheels.push(roul.userData.spin);
  solids.add(0, -2.3, 1.25, 2.2, 0, 'roulette');
  contact(scene, 0, -2.9, 3.4, 4.4, 0.55, drop + 0.004);

  /* the card games across from them */
  [['blackjack', -6.4, 3.3, 0.22], ['baccarat', 0, 3.6, 0], ['blackjack', 6.4, 3.3, -0.22]]
    .forEach(([id, x, z, rot]) => {
      const t = cardTable(M, id);
      t.position.set(x, drop, z);
      t.rotation.y = rot;
      t.userData.game = { id, seat: { x: 0, y: 1.46, z: 1.84, look: [0, 1.05, 1.31] } };
      F.add(t);
      dealers.push(...t.userData.dealers);
      collect(t);
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
      m.userData.game = { id: game, seat: { x: 0, y: 1.4, z: 0.95, look: [0, 1.36, 0.24] } };
      F.add(m);
      /* the gate is out in the aisle, clear of the columns that stand between
         the banks and the pit */
      m.userData.spots = [{ x: 0, z: 1.0, facing: Math.PI, sit: true, seatY: 0.7, gate: [0, 2.7] }];
      collect(m);
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

  /* ---- the bar, with a back bar and a wall of screens over it ---- */
  const bar = new THREE.Group();
  bar.add(box(8.0, 1.15, 1.2, M.woodMat, 0, 0.575, 0));
  bar.add(box(8.3, 0.08, 1.45, M.marbleMat, 0, 1.19, 0));
  bar.add(box(8.1, 0.06, 0.12, M.brass, 0, 1.15, 0.72));           // the rail you lean on
  bar.add(box(8.1, 0.08, 0.2, M.brass, 0, 0.18, 0.78));            // and the foot rail
  /* the back bar: a dark case, lit shelves, bottles standing on them */
  bar.add(box(8.2, 3.1, 0.42, M.darkMetal, 0, 1.55, -1.52));
  bar.add(box(7.9, 2.5, 0.06, new THREE.MeshStandardMaterial({
    color: 0x120a10, roughness: 0.25, metalness: 0.5
  }), 0, 1.6, -1.34));
  const shelfY = [0.95, 1.52, 2.09];
  shelfY.forEach(y => {
    const shelf = box(7.7, 0.05, 0.3, M.woodMat, 0, y, -1.18);
    bar.add(shelf);
    /* the strip that lights the bottles from underneath, which is what makes
       a back bar glow the way it does */
    bar.add(box(7.6, 0.02, 0.06, M.emissive(0xffcf8a, 1.5), 0, y + 0.035, -1.05, false, false));
    bar.add(bottles(7.3, y + 0.025, -1.18, 26));
  });
  bar.add(glassware(-3.1, 1.235, 0.1));
  bar.add(glassware(2.7, 1.235, -0.1));
  /* the taps */
  const taps = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.26, 10), M.brass);
    t.position.set(i * 0.14, 0.13, 0);
    t.castShadow = true;
    taps.add(t);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.03),
      new THREE.MeshStandardMaterial({ color: [0x7d1430, 0x1f7a44, 0x2a4a8a, 0xb8862c, 0x8a3a1a, 0x4a1a6a][i], roughness: 0.4 }));
    h.position.set(i * 0.14, 0.3, 0);
    taps.add(h);
  }
  taps.add(box(0.95, 0.06, 0.16, M.brass, 0.35, 0.03, 0));
  taps.position.set(2.2, 1.23, -0.35);
  bar.add(taps);

  /* the screens: six games in two rows, with the board of lines in the middle */
  const tv = (w, h, x, y, z, mat) => {
    const g2 = new THREE.Group();
    g2.add(box(w + 0.07, h + 0.07, 0.07, M.darkMetal, 0, 0, 0));
    const face = box(w, h, 0.02, mat, 0, 0, 0.045, false, false);
    g2.add(face);
    g2.position.set(x, y, z);
    return g2;
  };
  /* kept clear of the wall pilaster behind, which otherwise cuts the board in half */
  const TV_Z = -1.02;
  bar.add(tv(1.5, 1.8, 0, 3.75, TV_Z, book.boardMaterial()));
  [[-3.3, 4.2], [-1.6, 4.2], [1.6, 4.2], [3.3, 4.2], [-2.45, 2.85], [2.45, 2.85]]
    .forEach(([x, y], i) => bar.add(tv(1.55, 0.9, x, y, TV_Z, book.gameMaterial(i))));
  /* a little light in the well so the bottles read as glass and not silhouette */
  [-2.4, 0, 2.4].forEach(bx => {
    const l = new THREE.PointLight(0xffc98a, 1.5, 3.4, 2);
    l.position.set(bx, 1.75, -0.78);
    bar.add(l);
  });
  bar.add(box(8.4, 0.1, 0.5, M.darkMetal, 0, 2.45, -1.36));
  bar.add(box(7.6, 0.03, 0.1, M.emissive(0x7fe8ff, 1.1), 0, 2.5, -1.14, false, false));

  for (let i = -3; i <= 3; i++) {
    const s2 = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 18), M.woodMat);
    seat.position.y = 0.74;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.74, 10), M.brass);
    post.position.y = 0.37;
    s2.add(seat, post);
    s2.position.set(i * 1.05, 0, 1.05);
    s2.children.forEach(c => { c.castShadow = true; });
    bar.add(s2);
  }
  const keep = dealer(0, -0.95, Math.PI);
  bar.add(keep);
  dealers.push(keep);
  bar.userData.spots = [-3.15, -2.1, -1.05, 0, 1.05, 2.1, 3.15]
    .map(bx => ({ x: bx, z: 1.05, facing: Math.PI, sit: true, seatY: 0.79 }));
  bar.position.set(0, 0, ROOM.d / 2 - 1.6);
  bar.rotation.y = Math.PI;
  F.add(bar);
  collect(bar);
  solids.add(0, ROOM.d / 2 - 1.6, 4.2, 0.85, 0, 'bar');
  contact(scene, 0, ROOM.d / 2 - 1.6, 10, 3.4, 0.5);

  /* ---- the name over the cage, and something on the walls ---- */
  const sign = houseSign(7.6, 1.9);
  sign.position.set(0, 4.3, -ROOM.d / 2 + 0.72);
  F.add(sign);
  F.add(box(8.1, 2.3, 0.14, M.darkMetal, 0, 4.3, -ROOM.d / 2 + 0.62));
  F.add(box(6.6, 0.07, 0.3, M.emissive(0xffcf8a, 1.0), 0, 3.08, -ROOM.d / 2 + 0.95, false, false));

  /* roundels on the side walls, where nothing else is competing for the space */
  [[-1, -ROOM.w / 2 + 0.66], [1, ROOM.w / 2 - 0.66]].forEach(([side, x]) => {
    [-6.5, 6.5].forEach(z => {
      const m2 = monogram(2.1);
      m2.position.set(x, 3.5, z);
      m2.rotation.y = -side * Math.PI / 2;
      F.add(m2);
    });
  });
  /* framed pieces: the side walls get runs of them, the end walls only the
     stretches either side of the cage and the bar */
  F.add(artWall(M, ROOM.d - 6, 2.7, Math.PI / 2, -ROOM.w / 2 + 0.6, 0, 0, 5));
  F.add(artWall(M, ROOM.d - 6, 2.7, -Math.PI / 2, ROOM.w / 2 - 0.6, 0, 5, 5));
  [-1, 1].forEach(side => {
    F.add(artWall(M, 8.5, 2.7, 0, side * 12.5, -ROOM.d / 2 + 0.6, 10 + side * 3, 3));
    F.add(artWall(M, 8.5, 2.7, Math.PI, side * 12.5, ROOM.d / 2 - 0.6, 20 + side * 3, 3));
  });

  scene.add(F);
  F.userData.dealers = dealers;
  F.userData.spots = spots;
  F.userData.wheels = wheels;
  return F;
}
