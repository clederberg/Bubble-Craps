/* What hangs on the walls, and the name over the cage. All of it is drawn to
   canvas at load: a house sign, a monogram roundel, and framed pieces that
   are abstract rather than pictures of anything. */
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, x: c.getContext('2d') };
}
function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function spaced(x, text, cx, cy, size, colour, spacing, font) {
  x.fillStyle = colour;
  x.font = size + 'px ' + font;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  const chars = text.split('');
  const widths = chars.map(ch => x.measureText(ch).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) - spacing;
  let px = cx - total / 2;
  chars.forEach((ch, i) => { x.fillText(ch, px + widths[i] / 2 - spacing / 2, cy); px += widths[i]; });
}

/* ---------- the house sign ---------- */
export function houseSign(width, height) {
  const { c, x } = canvas(1536, 384);
  x.fillStyle = '#0a0509';
  x.fillRect(0, 0, 1536, 384);
  const grd = x.createLinearGradient(0, 40, 0, 300);
  grd.addColorStop(0, '#fff7e2');
  grd.addColorStop(0.45, '#f0c460');
  grd.addColorStop(1, '#9d6a1c');
  /* the roundel */
  x.strokeStyle = '#f0c460';
  x.lineWidth = 7;
  x.beginPath(); x.arc(205, 192, 112, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 3;
  x.beginPath(); x.arc(205, 192, 96, 0, Math.PI * 2); x.stroke();
  spaced(x, 'CML', 205, 196, '700 68', '#f0c460', 6, 'Cinzel, serif');
  /* the name */
  spaced(x, 'CML CASINO', 880, 160, '700 118', grd, 10, 'Cinzel, serif');
  spaced(x, 'EST. 2026  ·  THE FLOOR', 880, 268, '600 34', 'rgba(240,196,96,.72)', 14, 'Oswald, sans-serif');
  x.strokeStyle = 'rgba(240,196,96,.55)';
  x.lineWidth = 4;
  x.beginPath(); x.moveTo(380, 212); x.lineTo(1480, 212); x.stroke();
  const mat = new THREE.MeshBasicMaterial({ map: tex(c), toneMapped: false, transparent: true });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  return m;
}

/* ---------- a monogram roundel for the end walls ---------- */
export function monogram(size) {
  const { c, x } = canvas(512, 512);
  x.clearRect(0, 0, 512, 512);
  x.strokeStyle = '#f0c460';
  x.lineWidth = 10;
  x.beginPath(); x.arc(256, 256, 224, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 4;
  x.beginPath(); x.arc(256, 256, 198, 0, Math.PI * 2); x.stroke();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    x.beginPath();
    x.arc(256 + Math.cos(a) * 211, 256 + Math.sin(a) * 211, 5, 0, Math.PI * 2);
    x.fillStyle = 'rgba(240,196,96,.75)';
    x.fill();
  }
  spaced(x, 'CML', 256, 262, '700 136', '#f0c460', 10, 'Cinzel, serif');
  const mat = new THREE.MeshBasicMaterial({ map: tex(c), toneMapped: false, transparent: true });
  return new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
}

/* ---------- framed pieces ----------
   Deco fans, chevrons and sunbursts: shapes rather than pictures, which keeps
   them looking like hotel art instead of like a screenshot of something. */
function artCanvas(seed) {
  const { c, x } = canvas(512, 700);
  const grounds = ['#2a0f1e', '#1b2033', '#231a12', '#13231c'];
  const inks = ['#d8a94a', '#c9a86a', '#b8862c', '#e0b450'];
  const ground = grounds[seed % grounds.length], ink = inks[(seed + 1) % inks.length];
  x.fillStyle = ground;
  x.fillRect(0, 0, 512, 700);
  x.strokeStyle = ink;
  x.lineWidth = 4;
  const kind = seed % 4;
  if (kind === 0) {
    for (let i = 0; i < 9; i++) {
      x.beginPath();
      x.arc(256, 620, 60 + i * 56, Math.PI * 1.08, Math.PI * 1.92);
      x.stroke();
    }
    x.beginPath(); x.arc(256, 620, 26, 0, Math.PI * 2); x.fillStyle = ink; x.fill();
  } else if (kind === 1) {
    for (let i = 0; i < 14; i++) {
      x.beginPath();
      x.moveTo(40, 80 + i * 42);
      x.lineTo(256, 40 + i * 42);
      x.lineTo(472, 80 + i * 42);
      x.stroke();
    }
  } else if (kind === 2) {
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      x.beginPath();
      x.moveTo(256 + Math.cos(a) * 60, 350 + Math.sin(a) * 60);
      x.lineTo(256 + Math.cos(a) * 230, 350 + Math.sin(a) * 230);
      x.stroke();
    }
    x.beginPath(); x.arc(256, 350, 52, 0, Math.PI * 2); x.stroke();
  } else {
    for (let i = 0; i < 7; i++) {
      x.strokeRect(50 + i * 22, 70 + i * 36, 412 - i * 44, 560 - i * 72);
    }
  }
  /* a plate at the bottom, the way a hotel frames things */
  x.fillStyle = 'rgba(0,0,0,.35)';
  x.fillRect(0, 640, 512, 60);
  spaced(x, 'C M L', 256, 672, '600 22', 'rgba(240,196,96,.6)', 9, 'Cinzel, serif');
  return c;
}
export function framedArt(seed, w, h, M) {
  const g = new THREE.Group();
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: tex(artCanvas(seed)), roughness: 0.82 }));
  art.position.z = 0.035;
  g.add(art);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, h + 0.14, 0.06), M.brass);
  g.add(frame);
  const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, h + 0.02, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x120a10, roughness: 0.9 }));
  back.position.z = 0.01;
  g.add(back);
  /* a picture light over it */
  const light = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 0.05, 0.12), M.brass);
  light.position.set(0, h / 2 + 0.14, 0.12);
  g.add(light);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.48, 0.03),
    new THREE.MeshBasicMaterial({ color: 0xffcf8a, toneMapped: false }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, h / 2 + 0.12, 0.12);
  g.add(glow);
  return g;
}

/* a run of art down a wall */
export function artWall(M, len, y, rotY, x, z, seedBase, n) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const piece = framedArt(seedBase + i, 0.95, 1.3, M);
    piece.position.x = -len / 2 + (len / (n + 1)) * (i + 1);
    piece.position.y = y;
    g.add(piece);
  }
  g.rotation.y = rotY;
  g.position.set(x, 0, z);
  return g;
}
