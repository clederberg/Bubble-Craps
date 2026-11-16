/* The floor as a room: that everything is where it should be, that nothing is
   standing inside anything else, and that the people walking around do not
   walk through the furniture.

   Run with: node test-floor.js   (serve the repo on 8877 first) */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:8877/floor/index.html';

(async () => {
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto(URL);
  await page.waitForFunction(() => {
    const h = document.getElementById('hud');
    return h && !h.classList.contains('hidden');
  }, { timeout: 180000 });

  const out = await page.evaluate(() => {
    const app = window.CASINO;
    let n = 0; const log = [];
    const ok = (c, m) => { n++; if (!c) log.push('FAIL ' + m); };

    /* ---- every game on the floor is reachable and knows its page ---- */
    const games = {};
    app.scene.traverse(o => {
      if (o.userData && o.userData.game) {
        games[o.userData.game.id] = (games[o.userData.game.id] || 0) + 1;
      }
    });
    ['craps', 'crapless', 'roulette', 'blackjack', 'baccarat', 'holdem',
     'lights', 'purim', 'pinball'].forEach(id =>
      ok(games[id] > 0, 'there is a ' + id + ' on the floor'));
    ok(games.holdem === 1, "one Ultimate Texas Hold'em table, got " + (games.holdem || 0));

    /* it opens the page the flat site serves, not a stub */
    let uth = null;
    app.scene.traverse(o => { if (!uth && o.userData.game && o.userData.game.id === 'holdem') uth = o; });
    app.seating.sit(uth);
    for (let i = 0; i < 200; i++) { app.player.update(1 / 60); app.seating.update(1 / 60); }
    ok(app.seating.state === 'seated', 'you can sit at it, got ' + app.seating.state);
    const frame = document.getElementById('panelFrame');
    ok(/holdem\.html$/.test(frame.getAttribute('src') || ''),
      'it opens holdem.html, got ' + frame.getAttribute('src'));
    ok(document.getElementById('seatedName').textContent.indexOf('Ultimate') === 0,
      'and says what it is: ' + document.getElementById('seatedName').textContent);
    app.seating.stand();
    for (let i = 0; i < 200; i++) { app.player.update(1 / 60); app.seating.update(1 / 60); }

    /* ---- the salon bar ---- */
    const S = { x0: 19, w: 15, d: 15 };
    let bottles = 0, lathes = 0;
    app.scene.traverse(o => {
      if (o.isMesh && o.geometry && o.geometry.type === 'LatheGeometry'
        && o.position && o.parent && o.parent.parent) lathes++;
    });
    /* the three are groups of lathed parts sitting inside the salon */
    const inSalon = p => p.x > S.x0 && p.x < S.x0 + S.w && Math.abs(p.z) < S.d / 2;
    const v = new (app.camera.position.constructor)();
    app.scene.traverse(o => {
      if (!o.isMesh || !o.geometry || o.geometry.type !== 'LatheGeometry') return;
      o.getWorldPosition(v);
      if (inSalon(v) && v.y > 1.2 && v.y < 2.4) bottles++;
    });
    ok(bottles >= 3, 'three bottles are on the salon shelf, found ' + bottles);
    ok(lathes >= 3, 'and they are turned shapes, not boxes');

    /* ---- nothing solid stands inside anything else ---- */
    const R = app.solids.rects;
    const corners = o => {
      const pts = [];
      [[-o.hw, -o.hd], [o.hw, -o.hd], [o.hw, o.hd], [-o.hw, o.hd]].forEach(([lx, lz]) => {
        pts.push([o.cx + lx * o.c + lz * o.s, o.cz - lx * o.s + lz * o.c]);
      });
      return pts;
    };
    const inside = (o, x, z) => {
      const dx = x - o.cx, dz = z - o.cz;
      const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
      return Math.abs(lx) < o.hw - 1e-6 && Math.abs(lz) < o.hd - 1e-6;
    };
    const clash = [];
    for (let i = 0; i < R.length; i++) {
      for (let j = i + 1; j < R.length; j++) {
        /* the walls meet at the corners, and furniture is meant to stand
           against them; this is about two pieces in the same square metre */
        if (!R[i].tag || !R[j].tag) continue;
        if (/wall/.test(R[i].tag) || /wall/.test(R[j].tag)) continue;
        const hit = corners(R[i]).some(([x, z]) => inside(R[j], x, z))
          || corners(R[j]).some(([x, z]) => inside(R[i], x, z));
        if (hit) clash.push(R[i].tag + ' / ' + R[j].tag);
      }
    }
    ok(clash.length === 0, 'no two fixtures stand in the same place: ' + clash.join(', '));

    /* ---- the crowd walks round the furniture, not through it ----
       Where somebody stands to play is beside a table on purpose, so this only
       watches the ones on the move, which is what the lanes are for. */
    const people = app.crowd.people;
    ok(people.length > 10, 'there are people on the floor, ' + people.length);
    let through = 0, walked = 0; const tally = {};
    for (let step = 0; step < 9000; step++) {
      app.crowd.update(1 / 60);
      if (step % 10) continue;
      for (let k = 0; k < people.length; k++) {
        const p = people[k];
        if (p.state !== 'walk') continue;
        walked++;
        for (let i = 0; i < R.length; i++) {
          if (!R[i].tag || /wall/.test(R[i].tag)) continue;
          if (inside(R[i], p.px, p.pz)) { through++; const kk = R[i].tag + '@' + R[i].cx.toFixed(1) + ',' + R[i].cz.toFixed(1); tally[kk] = (tally[kk]||0)+1; }
        }
      }
    }
    ok(walked > 400, 'and they walked about, ' + walked + ' samples on the move');
    ok(through === 0, 'none of them walked through a table: '
      + Object.keys(tally).map(k => k + ' x' + tally[k]).join(', '));

    return { n, log, games, bottles, walked };
  });

  out.log.forEach(l => console.log(l));
  console.log('games on the floor: ' + Object.keys(out.games).sort().join(' '));
  if (errs.length) console.log('CONSOLE: ' + errs.slice(0, 6).join(' // '));
  console.log(out.log.length || errs.length
    ? 'floor: ' + out.log.length + ' of ' + out.n + ' FAILED'
    : 'floor: ' + out.n + ' checks passed');
  await browser.close();
  process.exit(out.log.length || errs.length ? 1 : 0);
})();
