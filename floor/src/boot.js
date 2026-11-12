/* Boot: renderer, environment, composer, loop. Everything the floor needs is
   generated at load, so the only thing between opening the page and walking
   about is the texture build. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildMaterials } from './materials.js';
import { buildRoom, ROOM } from './room.js';
import { buildFixtures } from './fixtures.js';
import { createScreens } from './attract.js';
import { animateDealers } from './props.js';
import { buildLighting } from './lighting.js';
import { createPlayer } from './player.js';
import { createSeating } from './sit.js';
import { Solids } from './collide.js';

const app = {};
window.CASINO = app;

function setStatus(text, pct) {
  const el = document.getElementById('loadText');
  const bar = document.getElementById('loadBar');
  if (el) el.textContent = text;
  if (bar) bar.style.width = Math.round(pct * 100) + '%';
}
/* let the browser paint the loading screen between the heavy steps */
const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

async function start() {
  const canvas = document.getElementById('view');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  app.renderer = renderer;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08040a);
  /* a little haze: it separates the far wall from the near tables and is what
     makes a big room feel big */
  scene.fog = new THREE.FogExp2(0x24111c, 0.012);
  app.scene = scene;

  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.08, 120);
  app.camera = camera;

  setStatus('Weaving the carpet', 0.1);
  await frame();
  const M = buildMaterials();
  app.materials = M;

  setStatus('Building the room', 0.4);
  await frame();
  const solids = new Solids().addRoom(ROOM.w, ROOM.d);
  buildRoom(scene, M, solids);

  setStatus('Setting the tables', 0.6);
  await frame();
  const screens = createScreens();
  const fixtures = buildFixtures(scene, M, solids, screens);
  app.screens = screens;

  setStatus('Turning on the lights', 0.8);
  await frame();
  buildLighting(scene, renderer, M);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.08).texture;
  scene.environmentIntensity = 0.45;

  setStatus('Polishing the brass', 0.92);
  await frame();
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  /* a high threshold so only the real light sources bloom, not a white shirt */
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.46, 0.7, 0.95);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  app.composer = composer;
  app.bloom = bloom;

  scene.updateMatrixWorld(true);
  const player = createPlayer(camera, canvas, solids);
  const seating = createSeating(camera, scene, player, canvas);
  app.player = player;
  app.seating = seating;

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  });

  setStatus('Ready', 1);
  await frame();
  document.getElementById('loader').classList.add('gone');
  document.getElementById('hud').classList.remove('hidden');

  const clock = new THREE.Clock();
  let now = 0;
  let fpsT = 0, fpsN = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta());
    now += dt;
    player.update(dt);
    seating.update(dt);
    screens.update(dt);
    animateDealers(fixtures.userData.dealers, now);
    composer.render();
    fpsT += dt; fpsN++;
    if (fpsT > 0.5) {
      const el = document.getElementById('fps');
      if (el) el.textContent = Math.round(fpsN / fpsT) + ' fps';
      fpsT = 0; fpsN = 0;
    }
  });
  app.ready = true;
}

start().catch(err => {
  setStatus('Something went wrong: ' + err.message, 1);
  console.error(err);
});
