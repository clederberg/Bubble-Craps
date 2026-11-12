/* The attract loops on the slot screens. One canvas per game, shared by every
   machine playing it, so twenty machines cost three textures. Reels roll, a
   line pays, the logo flashes: enough to tell from across the floor which bank
   is which. */
import * as THREE from 'three';

const W = 256, H = 320;

/* each game gets a palette, a name and a way of drawing one symbol */
const GAMES = {
  lights: {
    name: 'FESTIVAL OF LIGHTS', bg: '#0a1b3d', frame: '#ffd970', ink: '#ffeaa8',
    symbols: ['flame', 'star', 'dreidel', 'coin'],
    colours: ['#ffb43c', '#ffd970', '#7ab6ff', '#f0c460']
  },
  purim: {
    name: 'PURIM POTS', bg: '#2b0f1f', frame: '#f0c460', ink: '#ffd9a6',
    symbols: ['tri', 'crown', 'pot', 'coin'],
    colours: ['#e0a955', '#f0c460', '#cf7f45', '#b8862c']
  },
  pinball: {
    name: 'PINBALL CLASSIC', bg: '#14100c', frame: '#ff5a3c', ink: '#ffd0a8',
    symbols: ['bar', 'seven', 'cherry', 'bell'],
    colours: ['#f4efe4', '#ff5a3c', '#c0392b', '#ffcf6a']
  }
};

function drawSymbol(x, kind, cx, cy, r, colour) {
  x.fillStyle = colour;
  x.strokeStyle = colour;
  x.lineWidth = r * 0.26;
  switch (kind) {
    case 'flame':
      x.beginPath();
      x.moveTo(cx, cy - r);
      x.quadraticCurveTo(cx + r * 0.8, cy, cx, cy + r * 0.75);
      x.quadraticCurveTo(cx - r * 0.8, cy, cx, cy - r);
      x.fill();
      break;
    case 'star': {
      x.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 ? r * 0.45 : r;
        x[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      x.closePath(); x.fill();
      break;
    }
    case 'dreidel':
      x.beginPath();
      x.moveTo(cx - r * 0.65, cy - r * 0.5);
      x.lineTo(cx + r * 0.65, cy - r * 0.5);
      x.lineTo(cx, cy + r * 0.9);
      x.closePath(); x.fill();
      x.fillRect(cx - r * 0.12, cy - r, r * 0.24, r * 0.4);
      break;
    case 'tri':
      x.beginPath();
      x.moveTo(cx, cy - r);
      x.lineTo(cx + r * 0.92, cy + r * 0.72);
      x.lineTo(cx - r * 0.92, cy + r * 0.72);
      x.closePath(); x.fill();
      x.fillStyle = '#3a2340';
      x.beginPath();
      x.moveTo(cx, cy - r * 0.2);
      x.lineTo(cx + r * 0.5, cy + r * 0.55);
      x.lineTo(cx - r * 0.5, cy + r * 0.55);
      x.closePath(); x.fill();
      break;
    case 'crown':
      x.beginPath();
      x.moveTo(cx - r, cy + r * 0.5);
      x.lineTo(cx - r * 0.9, cy - r * 0.6);
      x.lineTo(cx - r * 0.35, cy - r * 0.1);
      x.lineTo(cx, cy - r * 0.8);
      x.lineTo(cx + r * 0.35, cy - r * 0.1);
      x.lineTo(cx + r * 0.9, cy - r * 0.6);
      x.lineTo(cx + r, cy + r * 0.5);
      x.closePath(); x.fill();
      break;
    case 'pot':
      x.beginPath();
      x.moveTo(cx - r * 0.85, cy - r * 0.2);
      x.lineTo(cx + r * 0.85, cy - r * 0.2);
      x.lineTo(cx + r * 0.6, cy + r * 0.8);
      x.lineTo(cx - r * 0.6, cy + r * 0.8);
      x.closePath(); x.fill();
      x.fillRect(cx - r, cy - r * 0.45, r * 2, r * 0.26);
      break;
    case 'bar':
      x.fillRect(cx - r, cy - r * 0.55, r * 2, r * 0.42);
      x.fillRect(cx - r, cy + r * 0.12, r * 2, r * 0.42);
      break;
    case 'seven':
      x.lineWidth = r * 0.34;
      x.beginPath();
      x.moveTo(cx - r * 0.6, cy - r * 0.8);
      x.lineTo(cx + r * 0.65, cy - r * 0.8);
      x.lineTo(cx - r * 0.1, cy + r * 0.9);
      x.stroke();
      break;
    case 'cherry':
      x.beginPath(); x.arc(cx - r * 0.35, cy + r * 0.35, r * 0.45, 0, Math.PI * 2); x.fill();
      x.beginPath(); x.arc(cx + r * 0.4, cy + r * 0.45, r * 0.38, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#4e7a2a'; x.lineWidth = r * 0.14;
      x.beginPath();
      x.moveTo(cx - r * 0.35, cy - r * 0.1); x.quadraticCurveTo(cx, cy - r, cx + r * 0.4, cy);
      x.stroke();
      break;
    default:
      x.beginPath(); x.arc(cx, cy, r * 0.8, 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgba(0,0,0,.25)';
      x.beginPath(); x.arc(cx, cy, r * 0.45, 0, Math.PI * 2); x.fill();
  }
}

class Screen {
  constructor(key) {
    this.g = GAMES[key];
    this.c = document.createElement('canvas');
    this.c.width = W; this.c.height = H;
    this.x = this.c.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.c);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.t = Math.random() * 6;
    this.phase = 'spin';
    this.timer = 1 + Math.random() * 2;
    this.offsets = [0, 0, 0];
    this.speeds = [0, 0, 0];
    this.win = 0;
    this.draw();
  }
  update(dt) {
    this.t += dt;
    this.timer -= dt;
    if (this.phase === 'spin') {
      for (let i = 0; i < 3; i++) {
        if (this.speeds[i] > 0) this.offsets[i] = (this.offsets[i] + this.speeds[i] * dt) % 1;
      }
      if (this.timer <= 0) { this.phase = 'win'; this.timer = 1.8; this.win = 1; this.speeds = [0, 0, 0]; }
    } else if (this.phase === 'win') {
      if (this.timer <= 0) { this.phase = 'idle'; this.timer = 0.9; this.win = 0; }
    } else {
      if (this.timer <= 0) {
        this.phase = 'spin';
        this.timer = 1.4 + Math.random() * 1.8;
        this.speeds = [5.5, 4.6, 3.8].map(s => s + Math.random());
      }
    }
    this.draw();
    this.tex.needsUpdate = true;
  }
  draw() {
    const { x, g } = this;
    x.fillStyle = g.bg;
    x.fillRect(0, 0, W, H);
    /* top glass with the name */
    x.fillStyle = 'rgba(0,0,0,.35)';
    x.fillRect(0, 0, W, 54);
    x.fillStyle = this.phase === 'win' && Math.floor(this.t * 6) % 2 ? '#fff' : g.frame;
    x.font = '700 19px Oswald, Arial';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(g.name, W / 2, 28);

    /* three reels */
    const rw = (W - 24) / 3, top = 64, h = H - 64 - 44;
    for (let r = 0; r < 3; r++) {
      const rx = 8 + r * (rw + 4);
      x.fillStyle = 'rgba(0,0,0,.45)';
      x.fillRect(rx, top, rw, h);
      x.save();
      x.beginPath(); x.rect(rx, top, rw, h); x.clip();
      const off = this.offsets[r] % 1;
      for (let i = -1; i < 4; i++) {
        const sy = top + (i + off) * (h / 3) + h / 6;
        const k = (((Math.floor(this.offsets[r] * 3) + i + r * 2) % g.symbols.length) + g.symbols.length) % g.symbols.length;
        drawSymbol(x, g.symbols[k], rx + rw / 2, sy, rw * 0.3, g.colours[k]);
      }
      x.restore();
      x.strokeStyle = 'rgba(255,255,255,.12)';
      x.lineWidth = 2;
      x.strokeRect(rx, top, rw, h);
    }
    /* the pay line, lit when it pays */
    if (this.win) {
      x.strokeStyle = '#fff6c8';
      x.lineWidth = 4;
      x.beginPath();
      x.moveTo(6, top + h / 2); x.lineTo(W - 6, top + h / 2);
      x.stroke();
      x.fillStyle = 'rgba(255,214,110,.16)';
      x.fillRect(6, top + h / 3, W - 12, h / 3);
    }
    /* credit strip */
    x.fillStyle = 'rgba(0,0,0,.5)';
    x.fillRect(0, H - 40, W, 40);
    x.fillStyle = g.ink;
    x.font = '600 15px Oswald, Arial';
    x.textAlign = 'left';
    x.fillText('CREDIT', 10, H - 20);
    x.textAlign = 'right';
    x.fillText(this.phase === 'win' ? 'WIN ' + (20 + Math.floor(this.t * 7) % 400) : '2,480', W - 10, H - 20);
  }
}

/* the lit sign above a machine: just the name, drawn once */
function topperTexture(key) {
  const g = GAMES[key];
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  const grd = x.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, g.bg);
  grd.addColorStop(1, '#000');
  x.fillStyle = grd;
  x.fillRect(0, 0, 512, 128);
  x.strokeStyle = g.frame;
  x.lineWidth = 6;
  x.strokeRect(8, 8, 496, 112);
  x.fillStyle = g.frame;
  x.font = '700 44px Oswald, Arial';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(g.name, 256, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createScreens() {
  const made = {};
  const toppers = {};
  Object.keys(GAMES).forEach(k => { made[k] = new Screen(k); toppers[k] = topperTexture(k); });
  return {
    topper(key) {
      return new THREE.MeshBasicMaterial({ map: toppers[key] || toppers.lights, toneMapped: false });
    },
    material(key) {
      const s = made[key] || made.lights;
      return new THREE.MeshBasicMaterial({ map: s.tex, toneMapped: false });
    },
    name(key) { return (GAMES[key] || GAMES.lights).name; },
    frame(key) { return (GAMES[key] || GAMES.lights).frame; },
    update(dt) { Object.keys(made).forEach(k => made[k].update(dt)); }
  };
}
