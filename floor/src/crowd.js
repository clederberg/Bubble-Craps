/* The floor's own custom.

   Twenty or so people who are not scenery: each one walks the aisles to a
   place at a game, plays it for a while with the gestures that go with it,
   and then goes looking for somewhere else. Everything they do is decided
   here and posed through the rig in props.js, so a patron at a craps rail
   and the same patron two minutes later on a stool are one object.

   Walking is done on a small graph of lanes rather than by steering, because
   a casino floor is a maze of tables and a steering agent spends its life
   grinding along the side of one. The lanes are the gaps a person would
   actually use: the ring around the pit, the two gates in the pit rail, and
   the clear runs between the table rows. */
import * as THREE from 'three';
import { patron, setPose } from './props.js';
import { ROOM } from './room.js';

/* the pit is a shallow well, so anyone inside it stands a step lower */
const HIP = 0.86;
function floorAt(x, z) {
  return (Math.abs(x) < ROOM.pit.w / 2 - 0.1 && Math.abs(z) < ROOM.pit.d / 2 - 0.1) ? -ROOM.pit.drop : 0;
}

/* the lane graph, in metres, laid out for ROOM 38 x 30 with the pit rail at
   x = +-11.2 and z = +-7.95 and gates in the middle of the long sides */
const NODES = [
  /* the side runs keep off x = +-12.9, which is where the columns stand */
  [-11.9, -10.6], [0, -10.6], [11.9, -10.6],      /*  0  1  2  back aisle  */
  [11.9, 0], [11.9, 10.6], [0, 10.6],             /*  3  4  5             */
  [-11.9, 10.6], [-11.9, 0],                      /*  6  7                */
  [0, -8.8], [0, -6.2],                           /*  8  9  north gate    */
  [-9.2, -6.2], [9.2, -6.2],                      /* 10 11                */
  [-9.2, 0], [9.2, 0],                            /* 12 13  the side runs */
  [-9.2, 6.3], [9.2, 6.3], [0, 6.5], [0, 8.8],    /* 14 15 16 17 south gate */
  [-4.9, -0.4], [4.9, -0.4]                       /* 18 19  behind the craps rails */
];
/* Roulette stands in the middle of the pit now, so there is no crossing the
   floor down the centre line any more: the two side runs are the way through. */
const EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0],
  [1, 8], [8, 9], [9, 10], [9, 11],
  [10, 12], [11, 13],
  [12, 14], [13, 15], [14, 16], [15, 16], [16, 17], [17, 5],
  [12, 18], [13, 19]
];

function buildGraph() {
  const adj = NODES.map(() => []);
  EDGES.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
  return adj;
}
const ADJ = buildGraph();

function nearestNode(x, z) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < NODES.length; i++) {
    const d = (NODES[i][0] - x) ** 2 + (NODES[i][1] - z) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
/* breadth first, because every lane is about as long as every other and the
   graph is twenty nodes */
function route(a, b) {
  if (a === b) return [a];
  const prev = new Array(NODES.length).fill(-1);
  const seen = new Array(NODES.length).fill(false);
  const q = [a];
  seen[a] = true;
  while (q.length) {
    const n = q.shift();
    if (n === b) break;
    for (const m of ADJ[n]) {
      if (seen[m]) continue;
      seen[m] = true; prev[m] = n; q.push(m);
    }
  }
  if (!seen[b]) return [b];
  const path = [b];
  let n = b;
  while (prev[n] !== -1) { n = prev[n]; path.unshift(n); }
  return path;
}

const facingTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export function createCrowd(scene, spots, count) {
  const people = [];
  const free = spots.map(() => true);
  /* Every place has a step-back point behind it, the spot you would stand on
     before taking it. Routing through that is what keeps people from cutting
     the corner of the table they are walking up to. */
  const approach = spots.map(s => s.gate || [
    s.x - Math.sin(s.facing) * 0.85,
    s.z - Math.cos(s.facing) * 0.85
  ]);

  function claim(avoid) {
    const open = [];
    for (let i = 0; i < spots.length; i++) if (free[i] && i !== avoid) open.push(i);
    if (!open.length) return -1;
    const i = open[Math.floor(Math.random() * open.length)];
    free[i] = false;
    return i;
  }

  for (let n = 0; n < count; n++) {
    const si = claim(-1);
    if (si < 0) break;
    const s = spots[si];
    const fig = patron(s.x, s.z, s.facing, s.sit);
    fig.rotation.y = s.facing;
    scene.add(fig);
    people.push({
      fig, spot: si, state: 'play',
      /* everybody arrives having already been there a while, so they do not
         all get up at the same moment */
      timer: 8 + Math.random() * 40,
      phase: Math.random() * 7, gesture: 0, gestureKind: 'bet',
      path: [], px: s.x, pz: s.z, sitK: s.sit ? 1 : 0, y: floorAt(s.x, s.z),
      speed: 1.05 + Math.random() * 0.45, seed: Math.random() * 10
    });
  }

  function leave(p) {
    free[p.spot] = true;
    const want = claim(p.spot);
    if (want < 0) { p.timer = 6; return; }
    p.want = want;
    const from = approach[p.spot], to = approach[want];
    const a = nearestNode(from[0], from[1]), b = nearestNode(to[0], to[1]);
    const lanes = route(a, b).map(i => NODES[i]);
    /* out of the place, along the lanes, up to the new one */
    p.path = [from].concat(a === b ? [] : lanes, [to, [spots[want].x, spots[want].z]]);
    p.state = 'walk';
    p.spot = -1;
  }

  function update(dt, now) {
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      const a = p.fig.userData.anim;
      if (!a) continue;

      if (p.state === 'play') {
        p.timer -= dt;
        /* a gesture now and then: reach out and place something, or throw the
           hands up, which is what tells you from across the room that a table
           is live */
        if (p.gesture <= 0 && Math.random() < dt * 0.33) {
          p.gesture = 1;
          p.gestureKind = Math.random() < 0.22 ? 'cheer' : 'bet';
        }
        if (p.timer <= 0) leave(p);
      } else if (p.state === 'walk') {
        const tgt = p.path[0];
        if (!tgt) {
          const s = spots[p.want];
          p.spot = p.want;
          p.state = 'arrive';
          p.timer = 0;
          p.toFacing = s.facing + (Math.random() - 0.5) * 0.2;
          p.fromFacing = p.fig.rotation.y;
          continue;
        }
        const dx = tgt[0] - p.px, dz = tgt[1] - p.pz;
        const d = Math.hypot(dx, dz);
        if (d < 0.22) { p.path.shift(); continue; }
        const step = Math.min(d, p.speed * dt);
        p.px += (dx / d) * step;
        p.pz += (dz / d) * step;
        p.phase += step * 3.4;
        const want = facingTo(0, 0, dx, dz);
        p.fig.rotation.y += wrap(want - p.fig.rotation.y) * Math.min(1, dt * 6);
      } else if (p.state === 'arrive') {
        /* the last step onto the spot, and turning to face the game */
        const s = spots[p.spot];
        p.timer = Math.min(1, p.timer + dt / 0.55);
        const k = p.timer;
        p.px += (s.x - p.px) * Math.min(1, dt * 5);
        p.pz += (s.z - p.pz) * Math.min(1, dt * 5);
        p.fig.rotation.y = p.fromFacing + wrap(p.toFacing - p.fromFacing) * k;
        if (k >= 1) {
          p.state = 'play';
          p.timer = 18 + Math.random() * 50;
        }
      }

      /* ---- posing ---- */
      const wantSit = p.state === 'play' || p.state === 'arrive'
        ? (spots[p.spot] && spots[p.spot].sit ? 1 : 0) : 0;
      p.sitK += (wantSit - p.sitK) * Math.min(1, dt * 3.2);
      /* how far the hips drop is the seat's business: a card-room chair, a
         slot stool and a bar stool are three different heights */
      const st = spots[p.spot];
      const drop = st && st.sit ? Math.max(0, HIP - (st.seatY + 0.1)) : 0.2;
      setPose(p.fig, p.sitK, drop);
      const g = floorAt(p.px, p.pz);
      p.y += (g - p.y) * Math.min(1, dt * 7);
      p.fig.position.set(p.px, p.y, p.pz);

      const walking = p.state === 'walk';
      if (walking) {
        const sw = Math.sin(p.phase), co = Math.cos(p.phase);
        a.legs[0].leg.rotation.x = sw * 0.58;
        a.legs[1].leg.rotation.x = -sw * 0.58;
        a.legs[0].knee.rotation.x = Math.max(0, -sw) * 0.75;
        a.legs[1].knee.rotation.x = Math.max(0, sw) * 0.75;
        a.arms[0].sh.rotation.x = -0.1 - sw * 0.42;
        a.arms[1].sh.rotation.x = -0.1 + sw * 0.42;
        a.arms[0].elbow.rotation.x = -0.35;
        a.arms[1].elbow.rotation.x = -0.35;
        a.body.position.y = Math.abs(co) * 0.022;
        a.body.rotation.z = sw * 0.03;
        a.body.rotation.y = 0;
        a.head.rotation.set(0, Math.sin(now * 0.5 + p.seed) * 0.25, 0);
      } else {
        a.body.position.y = Math.sin(now * 1.2 + p.seed) * 0.009;
        a.body.rotation.z = Math.sin(now * 0.33 + p.seed) * 0.014;
        a.body.rotation.y = Math.sin(now * 0.4 + p.seed * 2) * 0.05;
        a.head.rotation.set(0, Math.sin(now * 0.37 + p.seed) * 0.3, 0);
        if (p.gesture > 0) {
          p.gesture -= dt / (p.gestureKind === 'cheer' ? 1.9 : 1.2);
          /* one smooth out and back */
          const k = Math.sin(Math.max(0, Math.min(1, 1 - p.gesture)) * Math.PI);
          if (p.gestureKind === 'cheer') {
            a.arms.forEach(m => {
              m.sh.rotation.x = -0.22 - 0.45 * p.sitK - k * 2.3;
              m.elbow.rotation.x = -0.55 - 0.5 * p.sitK + k * 0.4;
            });
            a.body.position.y += k * 0.05;
            a.head.rotation.x = -k * 0.3;
          } else {
            const m = a.arms[p.seed > 5 ? 0 : 1];
            m.sh.rotation.x = -0.22 - 0.45 * p.sitK - k * 0.85;
            m.elbow.rotation.x = -0.55 - 0.5 * p.sitK + k * 0.62;
            a.body.rotation.x = k * 0.1;
          }
          if (p.gesture <= 0) { p.gesture = 0; a.body.rotation.x = 0; }
        } else {
          a.body.rotation.x = 0;
        }
      }
    }
  }

  return { update, people, count: people.length };
}
