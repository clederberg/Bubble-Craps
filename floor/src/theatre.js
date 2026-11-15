/* The games being played.

   Every table on the floor runs its own round on its own clock: dice are
   thrown and read at craps, cards come out of the shoe and are swept away at
   blackjack and baccarat, the roulette ball drops into a pocket and the dealer
   marks the number. None of it is wired to the engines, because none of it
   needs to be. It is the thing you see from across the room that tells you a
   pit is open, and it is what the floor was missing: tables with people stood
   at them, doing nothing.

   Each table hands over a small kit of parts when it is built, and this drives
   them. Nothing here allocates during a round. */
import * as THREE from 'three';
import { numberUV } from './felt.js';

const rnd = (a, b) => a + Math.random() * (b - a);
/* the reds, so the board can colour a number without the rules engine */
const REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const colourOf = n => (n === 0 || n === '00') ? 'green' : (REDS.indexOf(n) >= 0 ? 'red' : 'black');
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/* the rotation that turns a die so a given number is face up */
const DIE_FACE = [
  null,
  [0, 0, 0],                       // 1
  [0, 0, -Math.PI / 2],            // 2
  [Math.PI / 2, 0, 0],             // 3
  [-Math.PI / 2, 0, 0],            // 4
  [0, 0, Math.PI / 2],             // 5
  [Math.PI, 0, 0]                  // 6
];

/* ---------------- craps ----------------
   The shooter throws from the near end, the dice run the length of the cloth,
   bounce off the far wall and settle. The stick pushes them back a beat later. */
function craps(a, dt) {
  a.t += dt;
  const d0 = a.dice[0], d1 = a.dice[1];
  if (a.phase === 'wait') {
    if (a.t < a.hold) return;
    a.t = 0; a.phase = 'throw';
    a.faces = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    a.spin = [rnd(8, 16), rnd(8, 16), rnd(8, 16), rnd(8, 16), rnd(8, 16), rnd(8, 16)];
    d0.visible = d1.visible = true;
  } else if (a.phase === 'throw') {
    const T = 1.15, u = Math.min(1, a.t / T);
    for (let i = 0; i < 2; i++) {
      const d = a.dice[i], k = ease(u);
      const off = (i ? 0.1 : -0.1);
      d.position.x = a.from[0] + (a.to[0] + off - a.from[0]) * k;
      d.position.z = a.from[1] + (a.to[1] - a.from[1]) * k;
      /* two bounces along the way, flattening out */
      d.position.y = a.y + Math.abs(Math.sin(u * Math.PI * 2.2)) * 0.17 * (1 - u) + 0.012;
      if (u < 1) {
        d.rotation.x += a.spin[i * 3] * dt;
        d.rotation.y += a.spin[i * 3 + 1] * dt;
        d.rotation.z += a.spin[i * 3 + 2] * dt;
      }
    }
    if (u >= 1) {
      /* settle showing the numbers that were rolled */
      for (let i = 0; i < 2; i++) {
        const f = DIE_FACE[a.faces[i]];
        a.dice[i].rotation.set(f[0], f[1] + rnd(-0.4, 0.4), f[2]);
        a.dice[i].position.y = a.y + 0.012;
      }
      a.t = 0; a.phase = 'read';
    }
  } else if (a.phase === 'read') {
    /* the dealers settle the bets: a stack appears or goes away */
    if (a.t > 1.6 && !a.paid) {
      a.paid = true;
      const win = a.faces[0] + a.faces[1];
      a.stacks.forEach((st, i) => { st.visible = ((win + i) % 3) !== 0; });
    }
    if (a.t > 3.4) { a.t = 0; a.phase = 'sweep'; }
  } else {
    const T = 0.8, u = Math.min(1, a.t / T);
    for (let i = 0; i < 2; i++) {
      const d = a.dice[i];
      d.position.x += (a.from[0] - d.position.x) * Math.min(1, dt * 6);
      d.position.z += (a.from[1] - d.position.z) * Math.min(1, dt * 6);
    }
    if (u >= 1) {
      d0.visible = d1.visible = false;
      a.t = 0; a.phase = 'wait'; a.paid = false;
      a.hold = rnd(2.5, 6);
    }
  }
}

/* ---------------- blackjack and baccarat ----------------
   Cards come off the shoe one at a time, skim across the cloth to a seat and
   land. When the hand is over the dealer sweeps them away. */
function cardgame(a, dt) {
  a.t += dt;
  if (a.phase === 'wait') {
    if (a.t < a.hold) return;
    a.t = 0; a.phase = 'deal'; a.dealt = 0;
  } else if (a.phase === 'deal') {
    const per = 0.26;
    const want = Math.min(a.cards.length, Math.floor(a.t / per) + 1);
    for (let i = 0; i < want; i++) {
      const c = a.cards[i];
      c.mesh.visible = true;
      const u = Math.min(1, (a.t - i * per) / 0.3);
      if (u <= 0) { c.mesh.visible = false; continue; }
      const k = ease(u);
      c.mesh.position.x = a.shoe[0] + (c.to[0] - a.shoe[0]) * k;
      c.mesh.position.z = a.shoe[1] + (c.to[1] - a.shoe[1]) * k;
      c.mesh.position.y = a.y + 0.004 + Math.sin(u * Math.PI) * 0.05;
      /* it turns over as it goes, unless it is the dealer's hole card */
      c.mesh.rotation.x = c.hole ? Math.PI : Math.PI * (1 - k);
      c.mesh.rotation.y = c.rot;
    }
    if (a.t > a.cards.length * per + 0.5) { a.t = 0; a.phase = 'hold'; }
  } else if (a.phase === 'hold') {
    if (a.t > a.look) {
      /* the hole card goes over at the end of the hand */
      a.cards.forEach(c => { if (c.hole) c.mesh.rotation.x = 0; });
    }
    if (a.t > a.look + 1.8) { a.t = 0; a.phase = 'sweep'; }
  } else {
    const k = Math.min(1, dt * 5);
    a.cards.forEach(c => {
      c.mesh.position.x += (a.discard[0] - c.mesh.position.x) * k;
      c.mesh.position.z += (a.discard[1] - c.mesh.position.z) * k;
    });
    if (a.t > 0.75) {
      a.cards.forEach(c => { c.mesh.visible = false; });
      a.t = 0; a.phase = 'wait'; a.hold = rnd(2, 5);
    }
  }
}

/* ---------------- roulette ----------------
   The ball runs the rim, drops into a pocket, and the dealer's marker goes on
   to the number that came up. */
function roulette(a, dt) {
  a.t += dt;
  const w = a.spin;
  if (a.phase === 'run') {
    a.speed += (a.fast - a.speed) * Math.min(1, dt * 0.6);
    if (a.t > a.hold) { a.t = 0; a.phase = 'slow'; a.pick = a.order[Math.floor(Math.random() * a.order.length)]; }
  } else if (a.phase === 'slow') {
    const T = 4.2, u = Math.min(1, a.t / T);
    a.speed = a.fast * (1 - u) * (1 - u);
    a.radius = 0.335 - 0.085 * u * u;
    if (u >= 1) {
      a.speed = 0;
      a.t = 0; a.phase = 'mark';
      /* park the ball where the number is, in the wheel's own frame */
      const i = a.order.indexOf(a.pick);
      a.angle = -w.disc.rotation.z + (i / a.order.length) * Math.PI * 2 + Math.PI / 2;
      a.marked = false;
    }
  } else if (a.phase === 'mark') {
    a.angle = -w.disc.rotation.z + (a.order.indexOf(a.pick) / a.order.length) * Math.PI * 2 + Math.PI / 2;
    if (!a.marked && a.t > 0.8) {
      a.marked = true;
      const p = a.numberPos(a.pick);
      a.dollyTo = [p[0], p[1]];
      /* and it goes up on the board, whether the table is playing itself or
         somebody is stood at it */
      if (a.board) {
        a.seen.unshift({ n: a.pick, colour: colourOf(a.pick) });
        if (a.seen.length > 14) a.seen.pop();
        a.board.draw(a.seen);
      }
    }
    if (a.dollyTo) {
      const k = Math.min(1, dt * 4);
      a.dolly.position.x += (a.dollyTo[0] - a.dolly.position.x) * k;
      a.dolly.position.z += (a.dollyTo[1] - a.dolly.position.z) * k;
    }
    if (a.t > 6.5) {
      a.t = 0; a.phase = 'run'; a.hold = rnd(6, 11);
      a.dollyTo = a.dollyHome;
      a.radius = 0.335;
    }
  }
  if (a.dollyTo && a.phase === 'run') {
    const k = Math.min(1, dt * 4);
    a.dolly.position.x += (a.dollyTo[0] - a.dolly.position.x) * k;
    a.dolly.position.z += (a.dollyTo[1] - a.dolly.position.z) * k;
  }
  a.angle += a.speed * dt;
  w.ball.position.x = Math.cos(a.angle) * a.radius;
  w.ball.position.z = w.wz + Math.sin(a.angle) * a.radius;
}

export function createTheatre(acts) {
  acts.forEach(a => {
    a.t = 0;
    a.hold = rnd(0.5, 5);
    if (a.kind === 'craps') { a.phase = 'wait'; a.paid = false; }
    else if (a.kind === 'cards') { a.phase = 'wait'; }
    else if (a.kind === 'roulette') {
      a.phase = 'run'; a.speed = 2.4; a.fast = rnd(3.2, 4.2);
      a.radius = 0.335; a.angle = Math.random() * 7;
      a.numberPos = n => {
        const uv = numberUV(n, a.american);
        return a.uvToLocal(uv[0], uv[1]);
      };
    }
  });
  return {
    update(dt) {
      for (let i = 0; i < acts.length; i++) {
        const a = acts[i];
        if (a.kind === 'craps') craps(a, dt);
        else if (a.kind === 'cards') cardgame(a, dt);
        else roulette(a, dt);
      }
    }
  };
}

/* a playing card: white face, red back, thin enough to lie flat */
export function cardMesh() {
  /* kept off white: a pure cream card under a pit spot goes over the bloom
     threshold and turns into a glowing rectangle */
  const face = new THREE.MeshStandardMaterial({ color: 0xcfc9b8, roughness: 0.75 });
  const back = new THREE.MeshStandardMaterial({ color: 0x7e2019, roughness: 0.7 });
  const edge = new THREE.MeshStandardMaterial({ color: 0xbdb6a4, roughness: 0.8 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.063, 0.0016, 0.089),
    [edge, edge, face, back, edge, edge]);
  m.castShadow = true;
  m.visible = false;
  return m;
}
