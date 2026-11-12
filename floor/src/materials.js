/* Every surface in the room is generated here rather than downloaded: value
   noise into a canvas, then a normal map derived from the same height field.
   It keeps the page self contained, and the maps are swapped for Poly Haven
   scans by dropping files into textures/ and calling loadPBR instead. */
import * as THREE from 'three';

/* ---------- noise ---------- */
function hash(x, y, seed) {
  let h = x * 374761393 + y * 668265263 + seed * 2147483647;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}
function smooth(t) { return t * t * (3 - 2 * t); }
function value(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = smooth(xf), v = smooth(yf);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
/* tileable fbm: the lattice wraps at `period`, so the texture repeats cleanly */
function fbm(x, y, period, octaves, seed) {
  let sum = 0, amp = 1, norm = 0, p = period, f = 1;
  for (let o = 0; o < octaves; o++) {
    const wx = ((x * f) % p + p) % p, wy = ((y * f) % p + p) % p;
    sum += amp * value(wx, wy, seed + o * 17);
    norm += amp;
    amp *= 0.5; f *= 2;
  }
  return sum / norm;
}

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}
/* One place for the filtering, because a canvas texture left on the defaults
   gets anisotropy 1, and anything seen at an angle (a sign down a bank of
   machines, the carpet running away from you) crawls and sparkles.
   `live` is for the screens that are redrawn every frame: regenerating their
   mip chain sixty times a second costs more than the mips are worth, and they
   are looked at straight on anyway. */
export function tune(t, { srgb = true, live = false } = {}) {
  t.anisotropy = 16;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (live) {
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
  } else {
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
  }
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

function texFrom(canvas, repeat, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 16;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/* Sobel the height field into a tangent-space normal map. Doing it from the
   same buffer that drew the colour is what keeps the bumps where the pattern
   actually is. */
function normalFromHeight(height, size, strength) {
  const c = makeCanvas(size), ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const at = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx, ny = -dy, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
function roughFrom(values, size) {
  const c = makeCanvas(size), ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = Math.max(0, Math.min(1, values[i])) * 255;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/* ---------- carpet ----------
   Casino carpet is a loud repeating medallion on a dark ground. The pattern is
   drawn with paths, then roughed up with noise so it reads as cut pile rather
   than printed vinyl. */
function carpetCanvas(size, palette) {
  const c = makeCanvas(size), ctx = c.getContext('2d');
  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, 0, size, size);
  const N = 4;                       // motifs across the tile
  const cell = size / N;
  /* a lattice of thin gold diamonds under everything, the way the real stuff
     always has a second pattern hiding behind the first */
  ctx.strokeStyle = palette.lattice;
  ctx.lineWidth = Math.max(1, size / 900);
  for (let i = -N; i <= N * 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cell / 2, 0); ctx.lineTo(i * cell / 2 + size, size);
    ctx.moveTo(i * cell / 2, size); ctx.lineTo(i * cell / 2 + size, 0);
    ctx.stroke();
  }
  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const cx = gx * cell + cell / 2, cy = gy * cell + cell / 2;
      const r = cell * 0.36;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((gx + gy) % 2 ? Math.PI / 4 : 0);
      for (let k = 0; k < 4; k++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(r * 0.7, -r * 0.3, 0, -r);
        ctx.quadraticCurveTo(-r * 0.7, -r * 0.3, 0, 0);
        ctx.fillStyle = k % 2 ? palette.petalA : palette.petalB;
        ctx.fill();
        ctx.strokeStyle = palette.line;
        ctx.lineWidth = Math.max(1, size / 1100);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = palette.centre;
      ctx.fill();
      ctx.restore();
      /* a small four-point star where the cells meet */
      ctx.save();
      ctx.translate(gx * cell, gy * cell);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = palette.petalB;
      ctx.fillRect(-cell * 0.05, -cell * 0.05, cell * 0.1, cell * 0.1);
      ctx.restore();
    }
  }
  const img = ctx.getImageData(0, 0, size, size);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const fine = fbm(x / 1.8, y / 1.8, size / 1.8, 3, 11);
      const broad = fbm(x / 36, y / 36, size / 36, 3, 29);
      const k = 0.8 + fine * 0.28 + (broad - 0.5) * 0.14;
      img.data[i * 4] = Math.min(255, img.data[i * 4] * k);
      img.data[i * 4 + 1] = Math.min(255, img.data[i * 4 + 1] * k);
      img.data[i * 4 + 2] = Math.min(255, img.data[i * 4 + 2] * k);
      height[i] = fine * 0.8 + broad * 0.2;
      rough[i] = 0.9 + fine * 0.1;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { colour: c, height, rough, size };
}

/* ---------- wood ---------- */
function woodCanvas(size, dark, light) {
  const c = makeCanvas(size), ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const d = new THREE.Color(dark), l = new THREE.Color(light);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      /* grain runs along x, warped so the rings are not ruler straight */
      const warp = fbm(x / 60, y / 14, size / 14, 4, 5) * 26;
      const rings = Math.abs(Math.sin((y + warp) * 0.42));
      const fibre = fbm(x / 1.6, y / 10, size / 1.6, 2, 71);
      const t = Math.pow(rings, 1.7) * 0.8 + fibre * 0.2;
      const col = d.clone().lerp(l, t);
      img.data[i * 4] = col.r * 255;
      img.data[i * 4 + 1] = col.g * 255;
      img.data[i * 4 + 2] = col.b * 255;
      img.data[i * 4 + 3] = 255;
      height[i] = t;
      rough[i] = 0.22 + (1 - t) * 0.2;         // lacquer, a little duller in the grain
    }
  }
  ctx.putImageData(img, 0, 0);
  return { colour: c, height, rough, size };
}

/* ---------- marble ---------- */
function marbleCanvas(size, base, vein) {
  const c = makeCanvas(size), ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const b = new THREE.Color(base), v = new THREE.Color(vein);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const turb = fbm(x / 24, y / 24, size / 24, 5, 3);
      const streak = Math.abs(Math.sin((x * 0.012 + y * 0.03 + turb * 3.2) * Math.PI));
      const t = Math.pow(1 - streak, 6);
      const col = b.clone().lerp(v, Math.min(1, t * 1.3));
      img.data[i * 4] = col.r * 255;
      img.data[i * 4 + 1] = col.g * 255;
      img.data[i * 4 + 2] = col.b * 255;
      img.data[i * 4 + 3] = 255;
      height[i] = t * 0.3 + turb * 0.1;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { colour: c, height, size };
}

/* ---------- the library the room asks for ---------- */
export function buildMaterials() {
  const carpet = carpetCanvas(1024, {
    ground: '#230812', petalA: '#6e1129', petalB: '#9a6f24',
    centre: '#e0b450', line: '#c79a42', lattice: 'rgba(190,150,70,.22)'
  });
  const carpetMat = new THREE.MeshStandardMaterial({
    map: texFrom(carpet.colour, 14, true),
    normalMap: texFrom(normalFromHeight(carpet.height, carpet.size, 2.4), carpet.size, false),
    roughnessMap: texFrom(roughFrom(carpet.rough, carpet.size), carpet.size, false),
    roughness: 1, metalness: 0
  });
  carpetMat.normalScale.set(0.55, 0.55);
  carpetMat.map.repeat.set(30, 23);
  carpetMat.normalMap.repeat.copy(carpetMat.map.repeat);
  carpetMat.roughnessMap.repeat.copy(carpetMat.map.repeat);

  const walnut = woodCanvas(512, '#2b170e', '#7a4420');
  const woodMat = new THREE.MeshStandardMaterial({
    map: texFrom(walnut.colour, 1, true),
    normalMap: texFrom(normalFromHeight(walnut.height, walnut.size, 1.1), walnut.size, false),
    roughnessMap: texFrom(roughFrom(walnut.rough, walnut.size), walnut.size, false),
    metalness: 0.08, roughness: 0.4
  });
  woodMat.normalScale.set(0.3, 0.3);

  const stone = marbleCanvas(512, '#2e2028', '#d8bd84');
  const marbleMat = new THREE.MeshStandardMaterial({
    map: texFrom(stone.colour, 2, true),
    normalMap: texFrom(normalFromHeight(stone.height, stone.size, 0.6), stone.size, false),
    metalness: 0.1, roughness: 0.14
  });

  const brass = new THREE.MeshStandardMaterial({ color: 0xc9992e, metalness: 1, roughness: 0.26 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1a1418, metalness: 0.9, roughness: 0.45 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a1526, roughness: 0.92, metalness: 0 });
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x2a1a22, roughness: 0.92 });
  const feltMat = new THREE.MeshStandardMaterial({ color: 0x0f4a2a, roughness: 0.96, metalness: 0 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x111318, metalness: 0, roughness: 0.08, transmission: 0.0,
    clearcoat: 1, clearcoatRoughness: 0.06
  });

  const emissive = (hex, power) => new THREE.MeshStandardMaterial({
    color: 0x000000, emissive: new THREE.Color(hex), emissiveIntensity: power,
    roughness: 1, metalness: 0, toneMapped: false
  });

  return { carpetMat, woodMat, marbleMat, brass, darkMetal, wallMat, ceilingMat, feltMat, glassMat, emissive };
}

/* ---------- swapping in scanned maps ----------
   Drop a Poly Haven set into textures/<name>/ (tools/fetch-polyhaven.sh does
   that for you) and call this instead of the generated material. The channel
   names match what Poly Haven ships. */
export function loadPBR(name, { repeat = 1, srgb = true, normalScale = 1, extra = {} } = {}) {
  const L = new THREE.TextureLoader().setPath('textures/' + name + '/');
  const pick = (file, isColour) => {
    const t = L.load(file, undefined, undefined, () => {});
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 16;
    if (isColour) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const mat = new THREE.MeshStandardMaterial(Object.assign({
    map: pick('diff.jpg', true),
    normalMap: pick('nor_gl.jpg', false),
    roughnessMap: pick('rough.jpg', false),
    aoMap: pick('ao.jpg', false),
    roughness: 1, metalness: 0
  }, extra));
  mat.normalScale.set(normalScale, normalScale);
  return mat;
}
