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
  if (!chipGeo) chipGeo = new THREE.CylinderGeometry(0.0185, 0.0185, 0.0031, 18);
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
/* The dealer's rack: one row deep, sunk into a tray, so it sits at the edge of
   the layout the way a real one does instead of covering it. */
export function chipRack(x, y, z, rot = 0, rows = [1000, 500, 100, 25, 5]) {
  const g = new THREE.Group();
  rows.forEach((d, i) => {
    g.add(chipStack(d, 8 + Math.floor(Math.random() * 6), (i - (rows.length - 1) / 2) * 0.045, 0.004, 0));
  });
  const tray = new THREE.Mesh(new THREE.BoxGeometry(rows.length * 0.05 + 0.03, 0.028, 0.07),
    new THREE.MeshStandardMaterial({ color: 0x14131a, roughness: 0.5, metalness: 0.4 }));
  tray.position.y = -0.01;
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

/* ---------------- people ----------------
   One figure, dressed two ways. Dealers wear the house waistcoat; everyone
   else gets a shirt or a jacket out of a small wardrobe. No faces: at pit
   light a bad face reads far worse than none, and these are meant to be the
   crowd, not characters.  */
const SKINS = [0x7a543e, 0x5c3b28, 0x9a7254, 0x3e2a1e, 0xb08a68];
const HAIRS = [0x14100e, 0x2e1c10, 0x5a4530, 0x8a8a8a, 0x1a1a1a];
const OUTFITS = [
  { top: 0x2a3a5a, trouser: 0x1b1b24 }, { top: 0x6b2030, trouser: 0x24202a },
  { top: 0x1f4a3a, trouser: 0x15151c }, { top: 0xb0a890, trouser: 0x33302c },
  { top: 0x3a2a4a, trouser: 0x1a1620 }, { top: 0x8a5a2a, trouser: 0x201c18 },
  { top: 0x202028, trouser: 0x202028 }, { top: 0xa83f4a, trouser: 0x2a2630 }
];

/* ---- the people ----
   One rig, posed. The legs hinge at the hip and bend at the knee, so the same
   figure stands at a rail, walks the aisle and sits on a stool without being
   rebuilt; the arms hinge at the shoulder and the elbow, which is enough for
   placing a bet, pressing a button and throwing both hands up. */
function figure(opt) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: opt.skin, roughness: 0.8 });
  const top = new THREE.MeshStandardMaterial({ color: opt.top, roughness: 0.85 });
  const trouser = new THREE.MeshStandardMaterial({ color: opt.trouser, roughness: 0.88 });
  const hair = new THREE.MeshStandardMaterial({ color: opt.hair, roughness: 0.9 });
  const body = new THREE.Group();
  const HIP = 0.86, THIGH = 0.42, SHIN = 0.44;

  const hips = new THREE.Group();
  hips.position.y = HIP;
  body.add(hips);
  const seat = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.1, 4, 12), trouser);
  seat.position.y = -0.04;
  hips.add(seat);

  const legs = [];
  [-1, 1].forEach(side => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.095, -0.05, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, THIGH - 0.1, 4, 10), trouser);
    thigh.position.y = -THIGH / 2;
    leg.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -THIGH;
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, SHIN - 0.12, 4, 10), trouser);
    shin.position.y = -SHIN / 2;
    knee.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.055, 0.2), new THREE.MeshStandardMaterial({ color: 0x14100e, roughness: 0.7 }));
    foot.position.set(0, -SHIN - 0.02, 0.04);
    knee.add(foot);
    leg.add(knee);
    hips.add(leg);
    legs.push({ leg, knee });
  });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.34, 6, 16), top);
  torso.position.y = 0.26;
  hips.add(torso);
  if (opt.vest) {
    const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.202, 0.207, 0.56, 16),
      new THREE.MeshStandardMaterial({ color: opt.vest, roughness: 0.7 }));
    waist.position.y = 0.24;
    hips.add(waist);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.1, 10), skin);
  neck.position.y = 0.55;
  hips.add(neck);
  const headPivot = new THREE.Group();
  headPivot.position.y = 0.58;
  hips.add(headPivot);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.108, 20, 16), skin);
  head.position.y = 0.09;
  head.scale.set(0.92, 1.1, 1);
  headPivot.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.113, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), hair);
  cap.position.y = 0.105;
  cap.scale.set(0.95, 1.05, 1.02);
  headPivot.add(cap);

  const arms = [];
  [-1, 1].forEach(side => {
    const sh = new THREE.Group();
    sh.position.set(side * 0.215, 0.42, 0);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.22, 5, 10), top);
    upper.position.y = -0.15;
    sh.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.2, 5, 10), top);
    fore.position.y = -0.14;
    elbow.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), skin);
    hand.position.y = -0.29;
    elbow.add(hand);
    sh.add(elbow);
    hips.add(sh);
    arms.push({ sh, elbow, side });
  });

  body.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.add(body);
  g.userData.anim = { body, hips, legs, arms, head: headPivot, seed: Math.random() * 10, HIP };
  setPose(g, opt.sitting ? 1 : 0);
  return g;
}

/* 0 stands, 1 sits. The hips drop, the thighs come forward and the knees send
   the shins back down, which is the whole of sitting on a stool. */
export function setPose(fig, k, drop = 0.2) {
  const a = fig.userData.anim;
  if (!a) return;
  a.sitK = k;
  a.hips.position.y = a.HIP - drop * k;
  a.legs.forEach(l => {
    l.leg.rotation.x = -1.48 * k;
    l.knee.rotation.x = 1.42 * k;
  });
  a.arms.forEach(m => {
    m.sh.rotation.set(-0.22 - 0.45 * k, 0, m.side * 0.16);
    m.elbow.rotation.x = -0.55 - 0.5 * k;
  });
}

export function dealer(x, z, facing) {
  const g = figure({
    skin: SKINS[Math.floor(Math.random() * SKINS.length)],
    hair: HAIRS[Math.floor(Math.random() * HAIRS.length)],
    top: 0xa9a294, trouser: 0x14121a, vest: 0x3d0f1f
  });
  g.position.set(x, 0, z);
  g.rotation.y = facing;
  return g;
}

/* someone playing: standing at a rail, or sat on a stool */
export function patron(x, z, facing, sitting) {
  const o = OUTFITS[Math.floor(Math.random() * OUTFITS.length)];
  const g = figure({
    skin: SKINS[Math.floor(Math.random() * SKINS.length)],
    hair: HAIRS[Math.floor(Math.random() * HAIRS.length)],
    top: o.top, trouser: o.trouser, sitting: sitting
  });
  g.position.set(x, 0, z);
  g.rotation.y = facing + (Math.random() - 0.5) * 0.18;
  g.scale.setScalar(0.94 + Math.random() * 0.12);
  /* a punter must never get between you and the game you are trying to click */
  g.traverse(o2 => { o2.raycast = () => {}; });
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

/* ---------------- back bar ----------------
   A row of bottles in assorted shapes and colours, and a rack of glasses.
   Thin glass is expensive to render properly, so these are coloured solids
   with a low roughness, lit from under the shelf, which is how a back bar
   reads anyway. */
const BOTTLE_COLOURS = [0x6b3410, 0x9a6a1a, 0x2a5a2a, 0x7a1830, 0xd8d2c0, 0x1a2a4a, 0x8a4a10, 0x3a1a4a];
let bottleGeos = null;
export function bottles(width, y, z, n) {
  if (!bottleGeos) {
    bottleGeos = [
      new THREE.CylinderGeometry(0.035, 0.038, 0.2, 10),
      new THREE.CylinderGeometry(0.03, 0.042, 0.24, 10),
      new THREE.CylinderGeometry(0.04, 0.04, 0.16, 8)
    ];
  }
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const k = Math.floor(Math.random() * bottleGeos.length);
    const col = BOTTLE_COLOURS[Math.floor(Math.random() * BOTTLE_COLOURS.length)];
    const mat = new THREE.MeshStandardMaterial({
      color: col, roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.93
    });
    const b = new THREE.Mesh(bottleGeos[k], mat);
    const h = bottleGeos[k].parameters.height;
    b.position.set(-width / 2 + (width / (n - 1)) * i + (Math.random() - 0.5) * 0.02, h / 2, (Math.random() - 0.5) * 0.07);
    b.castShadow = true;
    g.add(b);
    /* neck and cap */
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.09, 8), mat);
    neck.position.set(b.position.x, h + 0.045, b.position.z);
    g.add(neck);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 8),
      new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.5, metalness: 0.6 }));
    cap.position.set(b.position.x, h + 0.1, b.position.z);
    g.add(cap);
    /* the label catches the shelf light */
    const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.0385, 0.0385, 0.07, 10, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.8, side: THREE.DoubleSide }));
    lab.position.set(b.position.x, h * 0.45, b.position.z);
    g.add(lab);
  }
  g.position.set(0, y, z);
  return g;
}
export function glassware(x, y, z) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xdfeef0, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.35, clearcoat: 1
  });
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 5; i++) {
      const tum = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.1, 12), mat);
      tum.position.set(i * 0.08, 0.05, r * 0.08);
      g.add(tum);
    }
  }
  g.position.set(x, y, z);
  return g;
}
