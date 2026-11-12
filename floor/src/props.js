/* The things on the tables, and the people behind them. None of it is
   downloaded: chips are short cylinders with a stripe, dice are rounded boxes
   with pips, the shoe is a wedge, and the dealer is a figure in a waistcoat
   who stands there and breathes. At pit light levels that reads as a person,
   and a bad face would read worse than none. */
import * as THREE from 'three';

const CHIP_COLOURS = { 1: 0xf2efe6, 5: 0xc0392b, 25: 0x1f7a44, 100: 0x1b1b22, 500: 0x6b3fa0, 1000: 0xd4a62a };

function chipTexture(hex) {
  const s = 128, c = document.createElement('canvas');
  c.width = c.height = s;
  const x = c.getContext('2d');
  const col = '#' + hex.toString(16).padStart(6, '0');
  x.fillStyle = col;
  x.fillRect(0, 0, s, s);
  /* the edge spots a chip has, read as a ring of dashes from above */
  x.strokeStyle = 'rgba(255,255,255,.85)';
  x.lineWidth = s * 0.12;
  for (let i = 0; i < 8; i++) {
    x.beginPath();
    x.arc(s / 2, s / 2, s * 0.42, (i / 8) * Math.PI * 2, (i / 8) * Math.PI * 2 + 0.26);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const chipMats = {};
function chipMaterial(denom) {
  if (!chipMats[denom]) {
    chipMats[denom] = new THREE.MeshStandardMaterial({
      map: chipTexture(CHIP_COLOURS[denom]), roughness: 0.55, metalness: 0.02
    });
  }
  return chipMats[denom];
}
let chipGeo = null;
/* A stack of chips. `n` high, in one denomination, with a little wobble so it
   does not look machined. */
export function chipStack(denom, n, x, y, z) {
  if (!chipGeo) chipGeo = new THREE.CylinderGeometry(0.0195, 0.0195, 0.0032, 20);
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(chipGeo, chipMaterial(denom));
    m.position.set((Math.random() - 0.5) * 0.0012, 0.0016 + i * 0.0033, (Math.random() - 0.5) * 0.0012);
    m.rotation.y = Math.random() * Math.PI;
    m.castShadow = true;
    g.add(m);
  }
  g.position.set(x, y, z);
  return g;
}
/* A tray of them, the way a dealer's rack looks: rows by denomination. */
export function chipRack(x, y, z, rot = 0) {
  const g = new THREE.Group();
  const rows = [1000, 500, 100, 25, 5];
  rows.forEach((d, i) => {
    for (let k = 0; k < 3; k++) {
      g.add(chipStack(d, 9 + Math.floor(Math.random() * 7), (i - 2) * 0.055, 0, (k - 1) * 0.05));
    }
  });
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x14131a, roughness: 0.5, metalness: 0.4 }));
  tray.position.y = -0.012;
  tray.receiveShadow = true;
  g.add(tray);
  g.position.set(x, y, z);
  g.rotation.y = rot;
  return g;
}

let diceGeo = null, diceMat = null;
function dieTexture() {
  const s = 128;
  const faces = [[[0.5, 0.5]], [[0.28, 0.28], [0.72, 0.72]], [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
    [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
    [[0.26, 0.26], [0.74, 0.26], [0.5, 0.5], [0.26, 0.74], [0.74, 0.74]],
    [[0.28, 0.24], [0.28, 0.5], [0.28, 0.76], [0.72, 0.24], [0.72, 0.5], [0.72, 0.76]]];
  return faces.map(pips => {
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const x = c.getContext('2d');
    x.fillStyle = '#c62828';
    x.fillRect(0, 0, s, s);
    x.fillStyle = '#fdf6e8';
    pips.forEach(([px, py]) => {
      x.beginPath(); x.arc(px * s, py * s, s * 0.09, 0, Math.PI * 2); x.fill();
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.28, metalness: 0 });
  });
}
export function die(x, y, z, rot) {
  if (!diceGeo) { diceGeo = new THREE.BoxGeometry(0.019, 0.019, 0.019); diceMat = dieTexture(); }
  const m = new THREE.Mesh(diceGeo, diceMat);
  m.position.set(x, y, z);
  m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = true;
  return m;
}

export function shoe(x, y, z, rot = 0) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.3),
    new THREE.MeshPhysicalMaterial({ color: 0x1a1016, roughness: 0.15, metalness: 0.1, clearcoat: 1 }));
  body.position.y = 0.06;
  body.castShadow = true;
  g.add(body);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xc9992e, metalness: 1, roughness: 0.3 }));
  lip.position.set(0, 0.02, 0.17);
  g.add(lip);
  g.position.set(x, y, z);
  g.rotation.y = rot;
  return g;
}
/* a few cards face down on the felt */
export function cards(x, y, z, n, rot = 0) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8d241d, roughness: 0.6 });
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.063, 0.0015, 0.089), mat);
    m.position.set(i * 0.075, 0.001, 0);
    m.rotation.y = (Math.random() - 0.5) * 0.14;
    m.castShadow = true;
    g.add(m);
  }
  g.position.set(x, y, z);
  g.rotation.y = rot;
  return g;
}

/* ---------------- the dealer ----------------
   A figure, not a portrait: dark trousers, white shirt, a house waistcoat and
   a bow tie, hands resting on the table. It breathes and shifts its weight,
   which is most of what makes a standing figure look alive. */
export function dealer(x, z, facing) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0x7a543e, roughness: 0.8 });
  /* not white: a pit light blows a white shirt out to a blob */
  const shirt = new THREE.MeshStandardMaterial({ color: 0xa9a294, roughness: 0.9 });
  const vest = new THREE.MeshStandardMaterial({ color: 0x3d0f1f, roughness: 0.7 });
  const trouser = new THREE.MeshStandardMaterial({ color: 0x14121a, roughness: 0.85 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x14100e, roughness: 0.9 });

  const body = new THREE.Group();
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.86, 14), trouser);
  legs.position.y = 0.43;
  body.add(legs);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.34, 6, 16), shirt);
  torso.position.y = 1.12;
  body.add(torso);
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.202, 0.207, 0.56, 16), vest);
  waist.position.y = 1.1;
  body.add(waist);
  const tie = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.05), vest);
  tie.position.set(0, 1.35, 0.17);
  body.add(tie);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.1, 10), skin);
  neck.position.y = 1.41;
  body.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.108, 20, 16), skin);
  head.position.y = 1.53;
  head.scale.set(0.92, 1.1, 1);
  body.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.113, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), hair);
  cap.position.y = 1.545;
  cap.scale.set(0.95, 1.05, 1.02);
  body.add(cap);
  /* arms angled in towards the layout */
  [-1, 1].forEach(side => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.3, 5, 10), shirt);
    arm.position.set(side * 0.22, 1.12, 0.03);
    arm.rotation.set(-0.5, 0, side * 0.2);
    body.add(arm);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.26, 5, 10), shirt);
    fore.position.set(side * 0.27, 0.95, 0.26);
    fore.rotation.set(-1.15, 0, side * 0.1);
    body.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), skin);
    hand.position.set(side * 0.29, 0.9, 0.41);
    body.add(hand);
  });
  body.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.add(body);
  g.position.set(x, 0, z);
  g.rotation.y = facing;
  g.userData.anim = { body, seed: Math.random() * 10 };
  return g;
}

/* called once a frame: a slow breath and a shift of weight */
export function animateDealers(list, t) {
  list.forEach(d => {
    const a = d.userData.anim;
    if (!a) return;
    a.body.position.y = Math.sin(t * 1.25 + a.seed) * 0.009;
    a.body.rotation.y = Math.sin(t * 0.42 + a.seed * 2) * 0.05;
    a.body.rotation.z = Math.sin(t * 0.33 + a.seed) * 0.012;
  });
}
