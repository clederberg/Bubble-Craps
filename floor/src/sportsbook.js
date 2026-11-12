/* The screens over the bar. Two kinds: a game, and the board of lines. Both
   are canvases that tick along on their own, so from a stool it looks like
   something is actually happening. Nothing here is a real team or a real
   league: the names are invented and the numbers are made up. */
import * as THREE from 'three';

const TEAMS = [
  ['HARBOUR', 'KESTRELS'], ['IRONSIDE', 'COMETS'], ['WESTGATE', 'BISON'],
  ['NORTHBAY', 'OTTERS'], ['CRESTVIEW', 'MINERS'], ['ASHFORD', 'RAVENS'],
  ['LOWELL', 'TIDE'], ['MARLOW', 'FOXES'], ['DUNMORE', 'STAGS'], ['PELHAM', 'WOLVES']
];
const SPORTS = ['court', 'pitch', 'diamond'];

function pick(a, i) { return a[i % a.length]; }

/* ---------- one game ---------- */
class Game {
  constructor(i) {
    this.i = i;
    this.sport = pick(SPORTS, i);
    this.home = pick(TEAMS, i * 3)[0];
    this.away = pick(TEAMS, i * 3 + 1)[1];
    this.hs = 0; this.as = 0;
    this.clock = 540 + Math.random() * 180;
    this.period = 1 + (i % 4);
    this.ball = { x: 0.5, y: 0.5, vx: 0.22 + Math.random() * 0.2, vy: 0.16 };
    this.flash = 0;
    this.t = Math.random() * 20;
    this.c = document.createElement('canvas');
    this.c.width = 512; this.c.height = 288;
    this.x = this.c.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.c);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.draw();
  }
  update(dt) {
    this.t += dt;
    this.clock -= dt;
    if (this.clock < 0) { this.clock = 600; this.period = this.period % 4 + 1; }
    const b = this.ball;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < 0.08 || b.x > 0.92) {
      b.vx *= -1;
      /* reaching an end is worth a score now and then */
      if (Math.random() < 0.35) {
        const pts = this.sport === 'diamond' ? 1 : this.sport === 'pitch' ? 1 : (Math.random() < 0.3 ? 3 : 2);
        if (b.x > 0.5) this.hs += pts; else this.as += pts;
        this.flash = 1.6;
      }
    }
    if (b.y < 0.12 || b.y > 0.88) b.vy *= -1;
    if (this.flash > 0) this.flash -= dt;
    this.draw();
    this.tex.needsUpdate = true;
  }
  draw() {
    const { x } = this, W = 512, H = 288;
    const green = this.sport === 'pitch' ? '#1c5c2a' : this.sport === 'diamond' ? '#2a6b33' : '#8a5a2a';
    x.fillStyle = green;
    x.fillRect(0, 0, W, H);
    /* the field, drawn simply: it only has to read as a sport from four metres */
    x.strokeStyle = 'rgba(255,255,255,.55)';
    x.lineWidth = 3;
    if (this.sport === 'court') {
      x.strokeRect(36, 44, W - 72, H - 96);
      x.beginPath(); x.moveTo(W / 2, 44); x.lineTo(W / 2, H - 52); x.stroke();
      x.beginPath(); x.arc(W / 2, (H - 8) / 2, 34, 0, Math.PI * 2); x.stroke();
      [36, W - 36].forEach(cx => { x.beginPath(); x.arc(cx, (H - 8) / 2, 54, -Math.PI / 2, Math.PI / 2, cx > W / 2); x.stroke(); });
    } else if (this.sport === 'pitch') {
      x.strokeRect(30, 40, W - 60, H - 92);
      x.beginPath(); x.moveTo(W / 2, 40); x.lineTo(W / 2, H - 52); x.stroke();
      x.beginPath(); x.arc(W / 2, (H - 12) / 2, 38, 0, Math.PI * 2); x.stroke();
      [[30, 0], [W - 86, 0]].forEach(([bx]) => x.strokeRect(bx, 84, 56, 76));
      /* yard stripes */
      x.strokeStyle = 'rgba(255,255,255,.12)';
      for (let i = 1; i < 10; i++) { x.beginPath(); x.moveTo(30 + i * (W - 60) / 10, 40); x.lineTo(30 + i * (W - 60) / 10, H - 52); x.stroke(); }
    } else {
      x.fillStyle = '#7a5230';
      x.beginPath();
      x.moveTo(W / 2, H - 60); x.lineTo(W / 2 + 95, H - 150); x.lineTo(W / 2, H - 238); x.lineTo(W / 2 - 95, H - 150);
      x.closePath(); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.6)';
      x.stroke();
    }
    /* the ball */
    const b = this.ball;
    x.fillStyle = '#fff';
    x.beginPath();
    x.arc(b.x * W, 40 + b.y * (H - 100), 6, 0, Math.PI * 2);
    x.fill();

    /* the bug in the corner, the way a broadcast does it */
    const bw = 300, bh = 42, bx = 12, by = H - bh - 10;
    x.fillStyle = 'rgba(8,10,14,.88)';
    x.fillRect(bx, by, bw, bh);
    x.fillStyle = this.flash > 0 && Math.floor(this.t * 8) % 2 ? '#ffd970' : '#e8e2d4';
    x.font = '700 19px Oswald, Arial';
    x.textAlign = 'left';
    x.textBaseline = 'middle';
    x.fillText(this.away.slice(0, 8), bx + 10, by + bh / 2);
    x.fillText(this.home.slice(0, 8), bx + 150, by + bh / 2);
    x.textAlign = 'right';
    x.fillStyle = '#fff';
    x.fillText(String(this.as), bx + 136, by + bh / 2);
    x.fillText(String(this.hs), bx + 286, by + bh / 2);
    /* clock */
    x.fillStyle = 'rgba(8,10,14,.88)';
    x.fillRect(W - 112, by, 100, bh);
    x.fillStyle = '#9fe8c0';
    x.textAlign = 'center';
    const m = Math.floor(this.clock / 60), sec = Math.floor(this.clock % 60);
    x.fillText(m + ':' + String(sec).padStart(2, '0'), W - 62, by + bh / 2 - 7);
    x.fillStyle = 'rgba(232,226,212,.7)';
    x.font = '600 13px Oswald, Arial';
    x.fillText('PERIOD ' + this.period, W - 62, by + bh / 2 + 11);
  }
}

/* ---------- the board of lines ---------- */
class Board {
  constructor() {
    this.rows = TEAMS.slice(0, 8).map((t, i) => ({
      a: t[0], b: TEAMS[(i + 4) % TEAMS.length][1],
      spread: (Math.random() * 12 - 6).toFixed(1),
      total: (38 + Math.random() * 20).toFixed(1),
      ml: Math.round((Math.random() * 400 - 200) / 5) * 5,
      flash: 0
    }));
    this.t = 0;
    this.c = document.createElement('canvas');
    this.c.width = 512; this.c.height = 512;
    this.x = this.c.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.c);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.draw();
  }
  update(dt) {
    this.t += dt;
    /* a line moves every couple of seconds, and the row it moved on flashes */
    if (Math.random() < dt * 0.5) {
      const r = this.rows[Math.floor(Math.random() * this.rows.length)];
      r.spread = (parseFloat(r.spread) + (Math.random() < 0.5 ? -0.5 : 0.5)).toFixed(1);
      r.ml += (Math.random() < 0.5 ? -5 : 5);
      r.flash = 1.4;
    }
    this.rows.forEach(r => { if (r.flash > 0) r.flash -= dt; });
    this.draw();
    this.tex.needsUpdate = true;
  }
  draw() {
    const { x } = this, W = 512, H = 512;
    x.fillStyle = '#07090d';
    x.fillRect(0, 0, W, H);
    x.fillStyle = '#10151d';
    x.fillRect(0, 0, W, 54);
    x.fillStyle = '#f0c460';
    x.font = '700 24px Oswald, Arial';
    x.textAlign = 'left';
    x.textBaseline = 'middle';
    x.fillText('TONIGHT', 16, 28);
    x.fillStyle = 'rgba(232,226,212,.55)';
    x.font = '600 14px Oswald, Arial';
    x.textAlign = 'right';
    ['SPREAD', 'TOTAL', 'MONEY'].forEach((h, i) => x.fillText(h, 230 + i * 92, 28));
    this.rows.forEach((r, i) => {
      const y = 76 + i * 54;
      x.fillStyle = i % 2 ? 'rgba(255,255,255,.03)' : 'transparent';
      x.fillRect(0, y - 22, W, 50);
      x.textAlign = 'left';
      x.fillStyle = '#e8e2d4';
      x.font = '600 17px Oswald, Arial';
      x.fillText(r.a.slice(0, 9), 16, y - 6);
      x.fillStyle = 'rgba(232,226,212,.7)';
      x.fillText(r.b.slice(0, 9), 16, y + 16);
      const hot = r.flash > 0 && Math.floor(this.t * 7) % 2;
      x.textAlign = 'right';
      x.font = '700 18px Oswald, Arial';
      x.fillStyle = hot ? '#ffd970' : '#9fe8c0';
      const sp = parseFloat(r.spread);
      x.fillText((sp > 0 ? '+' : '') + sp.toFixed(1), 230, y + 4);
      x.fillStyle = hot ? '#ffd970' : '#cfd8e3';
      x.fillText('o' + r.total, 322, y + 4);
      x.fillStyle = hot ? '#ffd970' : (r.ml > 0 ? '#9fe8c0' : '#ff9b8a');
      x.fillText((r.ml > 0 ? '+' : '') + r.ml, 414, y + 4);
    });
    /* a ticker along the bottom */
    x.fillStyle = '#10151d';
    x.fillRect(0, H - 40, W, 40);
    x.save();
    x.beginPath(); x.rect(0, H - 40, W, 40); x.clip();
    x.fillStyle = '#e8e2d4';
    x.font = '600 16px Oswald, Arial';
    x.textAlign = 'left';
    const msg = '   FINAL  KESTRELS 94  BISON 88   ·   OTTERS LEAD SERIES 2-1   ·   RAVENS -3.5 TONIGHT   ·   TIDE ON A SIX GAME RUN   ';
    const w = x.measureText(msg).width;
    const off = (this.t * 70) % w;
    x.fillText(msg, -off, H - 20);
    x.fillText(msg, -off + w, H - 20);
    x.restore();
  }
}

export function createSportsbook(games) {
  const list = [];
  for (let i = 0; i < games; i++) list.push(new Game(i));
  const board = new Board();
  return {
    gameMaterial(i) {
      return new THREE.MeshBasicMaterial({ map: list[i % list.length].tex, toneMapped: false });
    },
    boardMaterial() {
      return new THREE.MeshBasicMaterial({ map: board.tex, toneMapped: false });
    },
    update(dt) {
      list.forEach(g => g.update(dt));
      board.update(dt);
    }
  };
}
