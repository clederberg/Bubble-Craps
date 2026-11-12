/* Light comes from three places: a cold ambient fill so nothing is pure black,
   warm pendants over the pit that actually cast the shadows, and a lot of
   emissive geometry (cove, neon, screens) that the bloom pass turns into glow.
   Only the pit lights cast shadows, because shadow maps are the expensive part
   and the pit is where the eye goes. */
import * as THREE from 'three';
import { ROOM } from './room.js';

const SHADE_Y = 3.25;        // the lamp hangs this far above the carpet

function pendant(M, x, z, colour) {
  const g = new THREE.Group();
  const rodLen = ROOM.pitH - SHADE_Y - 0.2;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, rodLen, 8), M.darkMetal);
  rod.position.y = SHADE_Y + 0.2 + rodLen / 2;
  g.add(rod);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.46, 32, 1, true), new THREE.MeshStandardMaterial({
    color: 0x3a1a22, metalness: 0.65, roughness: 0.3, side: THREE.DoubleSide
  }));
  shade.position.y = SHADE_Y;
  shade.castShadow = true;
  g.add(shade);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.54, 28), M.emissive(colour, 3.4));
  glow.rotation.x = Math.PI / 2;
  glow.position.y = SHADE_Y - 0.2;
  g.add(glow);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.022, 8, 40), M.brass);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = SHADE_Y - 0.23;
  g.add(ring);
  g.position.set(x, 0, z);
  return g;
}

export function buildLighting(scene, renderer, M) {
  const L = new THREE.Group();
  L.name = 'lighting';

  scene.add(new THREE.AmbientLight(0x3a2430, 1.05));
  /* a dim cool bounce from above so the carpet is not flat */
  const hemi = new THREE.HemisphereLight(0x5e3e55, 0x201016, 0.55);
  scene.add(hemi);

  /* the pit: three warm pendants, two of them casting */
  const spots = [];
  [[-4.8, -2.9, 0xffe0b0, true], [4.8, -2.9, 0xffe0b0, true], [-6.4, 3.3, 0xffd7a0, true],
   [0, 3.6, 0xffd7a0, false], [6.4, 3.3, 0xffd7a0, false]].forEach(([x, z, c, cast], i) => {
    L.add(pendant(M, x, z, c));
    /* bright and tight: the pool of light on the felt is the whole look of a pit */
    const s = new THREE.SpotLight(c, 95, 12, 0.52, 0.45, 1.5);
    s.position.set(x, SHADE_Y - 0.26, z);
    s.target.position.set(x, 0, z);
    if (cast) {
      s.castShadow = true;
      s.shadow.mapSize.set(1024, 1024);
      s.shadow.bias = -0.0015;
      s.shadow.normalBias = 0.02;
      s.shadow.camera.near = 0.5;
      s.shadow.camera.far = 10;
    }
    L.add(s, s.target);
    spots.push(s);
  });

  /* the cove behind the coffer lip: a wide, soft, warm wash with no shadow */
  const cove = new THREE.PointLight(0xffa860, 42, 30, 2);
  cove.position.set(0, ROOM.h + 0.9, 0);
  L.add(cove);

  /* the slot banks each get a cheap coloured fill so the aisles read */
  [[-14.6, -7.0, 0x7ab6ff], [-14.6, 7.0, 0xe0a955], [14.6, -7.0, 0xff7a4c], [14.6, 7.0, 0x7ab6ff]]
    .forEach(([x, z, c]) => {
      const p = new THREE.PointLight(c, 11, 13, 2);
      p.position.set(x + (x < 0 ? 1.5 : -1.5), 2.2, z);
      L.add(p);
    });

  /* cage and bar */
  const cageL = new THREE.PointLight(0xffc98a, 9, 12, 2);
  cageL.position.set(0, 3.0, -ROOM.d / 2 + 2.6);
  L.add(cageL);
  const barL = new THREE.PointLight(0x7fe8ff, 8, 12, 2);
  barL.position.set(0, 2.6, ROOM.d / 2 - 2.8);
  L.add(barL);

  const fill = new THREE.PointLight(0xffb98a, 20, 40, 1.6);
  fill.position.set(0, ROOM.h - 0.6, 0);
  L.add(fill);
  [[-12, -9], [12, -9], [-12, 9], [12, 9]].forEach(([x, z]) => {
    const f = new THREE.PointLight(0xffc09a, 9, 16, 1.8);
    f.position.set(x, ROOM.h - 1.0, z);
    L.add(f);
  });

  scene.add(L);
  return { group: L, spots };
}
