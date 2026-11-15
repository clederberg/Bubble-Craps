/* The playable roulette table, driven in a real browser.

   The point of these is the picking: aim the crosshair at every bet on the
   layout from where you actually stand and check the chip lands on that bet
   and no other. After that it is money: every cent that leaves the bankroll is
   on the cloth, every cent the engine says to pay comes back, and nothing is
   created or lost by sitting down, spinning, clearing or walking away.

   Run with: node test-table3d.js   (serve the repo on 8877 first) */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:8877/floor/index.html';

(async () => {
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto(URL);
  await page.waitForFunction(() => {
    const h = document.getElementById('hud');
    return h && !h.classList.contains('hidden');
  }, { timeout: 180000 });

  /* headless WebGL has no clock worth trusting, so drive it by hand */
  await page.evaluate(() => {
    const app = window.CASINO;
    app.renderer.setAnimationLoop(null);
    window.__step = (n, dt) => {
      for (let i = 0; i < n; i++) {
        app.player.update(dt); app.seating.update(dt);
        app.theatre.update(dt); app.crowd.update(dt);
      }
    };
    window.__t = () => {
      let o = null;
      app.scene.traverse(x => {
        if (!o && x.userData && x.userData.game && x.userData.game.id === 'roulette'
          && x.userData.cloth) o = x;
      });
      return o;
    };
  });

  const phase = fn => page.evaluate(fn);

  /* ---------------- sitting down, and the picking ---------------- */
  const a = await phase(() => {
    const app = window.CASINO, R = window.Roul;
    let n = 0; const log = [];
    const ok = (c, m) => { n++; if (!c) log.push('FAIL ' + m); };

    ok(!!window.Casino && !!window.Roul, 'the engine and the bankroll loaded on the floor');
    const roul = window.__t();
    ok(!!roul, 'found a roulette table with a pickable cloth');
    ok(!!roul.userData.game.play, 'it has a standing pose to play from');
    ok(app.table3d.claims(roul), 'the playable table claims it');

    app.seating.sit(roul);
    window.__step(150, 1 / 60);
    ok(app.seating.state === 'seated', 'you end up at the table, got ' + app.seating.state);
    ok(app.table3d.active, 'the cloth is live');
    ok(!document.getElementById('panel').classList.contains('on'), 'no page popped up over it');
    ok(document.getElementById('table3d').classList.contains('on'), 'the chip rail is up');
    ok(document.body.classList.contains('playing'), 'the floor knows you are playing');

    /* every bet, aimed at from where you stand */
    const bets = Object.keys(R.table(roul.userData.cloth.american ? 'american' : 'euro'));
    const wrong = [];
    bets.forEach(k => { if (app.table3d.aim(k) !== k) wrong.push(k + ' picked ' + app.table3d.aim(k)); });
    ok(wrong.length === 0, 'all ' + bets.length + ' bets pick themselves up ('
      + wrong.length + ' wrong: ' + wrong.slice(0, 10).join(', ') + ')');

    /* the window is up, and a click on the bare cloth at the edge of it is
       not a bet */
    ok(app.table3d.panel.shown, 'the betting window is open');
    ok(app.table3d.panel.pickAt(0.985, 0.995) === null, 'the corner of the cloth is not a bet');
    ok(app.table3d.panel.pickAt(0.5, 0.012) === null, 'nor is the top edge');

    return { n, log, bets: bets.length };
  });

  /* ---------------- the chips and the money ---------------- */
  const b = await phase(() => {
    const app = window.CASINO, R = window.Roul, C = window.Casino, t3 = app.table3d;
    let n = 0; const log = [];
    const ok = (c, m) => { n++; if (!c) log.push('FAIL ' + m); };
    const stacks = () => app.scene.getObjectByName('playerChips').children.length;

    C.setBank(100000);                               /* $1,000 */
    const start = C.bank();
    t3.pick(2500);                                   /* the green $25 */
    ok(t3.aim('s:17') === 's:17', 'aimed at 17');
    t3.lay(true);
    ok(t3.game.bets['s:17'] === 2500, 'a $25 chip went down on 17');
    ok(C.bank() === start - 2500, 'and came out of the bankroll');
    t3.lay(true);
    ok(t3.game.bets['s:17'] === 5000, 'a second chip stacks on it');
    t3.lay(false);
    ok(t3.game.bets['s:17'] === 2500, 'right-click takes one back off');
    ok(C.bank() === start - 2500, 'and the bankroll gets it back');

    t3.pick(10000);
    t3.aim('red'); t3.lay(true);
    t3.aim('doz:3'); t3.lay(true);
    ok(R.staked(t3.game) === 22500, 'the cloth holds $225, got ' + R.staked(t3.game));
    ok(C.bank() + R.staked(t3.game) === start, 'bankroll plus cloth is what you started with');
    ok(stacks() >= 3, 'there are chips on the table, ' + stacks() + ' stacks');

    t3.clearBets();
    ok(R.staked(t3.game) === 0, 'clearing empties the cloth');
    ok(C.bank() === start, 'and hands everything back');
    ok(stacks() === 0, 'the layout is bare again');

    /* a bet you cannot afford, and one the table will not take */
    C.setBank(1000);                                 /* $10 */
    t3.pick(10000);                                  /* a $100 chip */
    t3.aim('s:5'); t3.lay(true);
    ok(t3.game.bets['s:5'] === 1000, 'it puts down what you have, got ' + t3.game.bets['s:5']);
    ok(C.bank() === 0, 'which is all of it');
    t3.lay(true);
    ok(t3.game.bets['s:5'] === 1000, 'and nothing more');
    t3.clearBets();

    C.setBank(100000000);
    t3.pick(100000);
    t3.aim('s:7');
    for (let i = 0; i < 8; i++) t3.lay(true);
    ok(t3.game.bets['s:7'] === R.LIMITS.straight,
      'a straight stops at the table limit, got ' + t3.game.bets['s:7']);
    const held = C.bank();
    t3.lay(true);
    ok(C.bank() === held, 'a refused bet costs nothing');
    t3.clearBets();
    ok(C.bank() === 100000000, 'and the bankroll is whole');

    return { n, log };
  });

  /* ---------------- whole spins ---------------- */
  const c = await phase(() => {
    const app = window.CASINO, R = window.Roul, C = window.Casino, t3 = app.table3d;
    let n = 0; const log = [], seen = [];
    const ok = (cc, m) => { n++; if (!cc) log.push('FAIL ' + m); };
    const stacks = () => app.scene.getObjectByName('playerChips').children.length;

    C.setBank(1000000);                              /* $10,000 */
    let bank = C.bank();
    for (let r = 0; r < 8; r++) {
      t3.pick(10000);
      ['s:' + (r * 4 + 1), 'red', 'doz:2', 'col:1', 'c:1-2-4-5'].forEach(k => {
        ok(t3.aim(k) === k, 'round ' + r + ': aimed at ' + k);
        t3.lay(true);
      });
      const staked = R.staked(t3.game);
      ok(staked === 50000, 'round ' + r + ': $500 on the cloth, got ' + staked);
      ok(bank - C.bank() === staked, 'round ' + r + ': the stake left the bankroll');
      const before = C.bank();
      t3.spin();
      ok(t3.busy, 'round ' + r + ': the table is closed');
      ok(!t3.panel.shown, 'round ' + r + ': the window is out of the way');
      t3.lay(true);
      ok(R.staked(t3.game) === staked, 'round ' + r + ': no bet after the call');
      for (let i = 0; i < 1200 && t3.busy; i++) window.__step(1, 1 / 60);
      ok(!t3.busy, 'round ' + r + ': the ball dropped and it settled');
      ok(t3.panel.shown, 'round ' + r + ': the window came back for the next bet');
      const res = t3.game.last;
      ok(C.bank() === before + res.returned,
        'round ' + r + ': paid exactly the engine figure ' + res.returned);
      ok(R.staked(t3.game) === 0, 'round ' + r + ': the cloth was swept');
      ok(stacks() === 0, 'round ' + r + ': the chips are gone');
      ok(res.n === 0 || res.n === '00' || (res.n >= 1 && res.n <= 36), 'round ' + r + ': a real number');
      seen.push(res.n + res.colour.charAt(0) + (res.net > 0 ? '+' : ''));
      bank = C.bank();
    }
    /* the dolly ends on the number, not somewhere else, and the board keeps
       the count: the marker goes down a beat after the money moves */
    const act = window.__t().userData.act;
    ok(act.pick === t3.game.last.n, 'the marker is on the number that came up');
    for (let i = 0; i < 120 && !act.marked; i++) window.__step(1, 1 / 60);
    ok(act.marked, 'the dealer marked it');
    ok(!!act.board && act.seen.length > 0, 'the board has numbers on it');
    ok(act.seen[0].n === t3.game.last.n,
      'the top of the board is the number that just came up, got ' + act.seen[0].n);
    ok(act.seen[0].colour === t3.game.last.colour, 'in the colour it fell');
    return { n, log, seen, bank: C.bank() };
  });

  /* ---------------- the high limit table, which faces the other way ----------
     Same table, turned through 180 degrees. If anything in the picking is in
     world space rather than the table's own, this is where it shows. */
  const e = await phase(() => {
    const app = window.CASINO, R = window.Roul, C = window.Casino, t3 = app.table3d;
    let n = 0; const log = [];
    const ok = (cc, m) => { n++; if (!cc) log.push('FAIL ' + m); };
    app.seating.stand(); window.__step(150, 1 / 60);

    let hr = null;
    app.scene.traverse(o => {
      if (!hr && o.userData && o.userData.cloth && o.userData.game
        && o.userData.game.id === 'roulette' && Math.abs(o.rotation.y - Math.PI) < 0.01) hr = o;
    });
    ok(!!hr, 'found the high limit roulette table');
    if (!hr) return { n, log };
    app.seating.sit(hr); window.__step(150, 1 / 60);
    ok(t3.active, 'it plays on the cloth too');
    const bets = Object.keys(R.table('euro'));
    const wrong = [];
    bets.forEach(k => { if (t3.aim(k) !== k) wrong.push(k); });
    ok(wrong.length === 0, 'all ' + bets.length + ' bets pick up on the turned table ('
      + wrong.slice(0, 8).join(', ') + ')');
    C.setBank(500000);
    const start = C.bank();
    t3.pick(50000); t3.aim('s:0'); t3.lay(true);
    ok(t3.game.bets['s:0'] === 50000, 'a $500 chip on the zero');
    t3.spin();
    for (let i = 0; i < 1200 && t3.busy; i++) window.__step(1, 1 / 60);
    const res = t3.game.last;
    ok(C.bank() === start - 50000 + res.returned, 'and it settled right');
    const after = C.bank();
    app.seating.stand(); window.__step(150, 1 / 60);
    ok(C.bank() === after, 'nothing moved on the way out');
    return { n, log };
  });

  /* ---------------- getting up ---------------- */
  const d = await phase(() => {
    const app = window.CASINO, R = window.Roul, C = window.Casino, t3 = app.table3d;
    let n = 0; const log = [];
    const ok = (cc, m) => { n++; if (!cc) log.push('FAIL ' + m); };

    if (!t3.active) { app.seating.sit(window.__t()); window.__step(150, 1 / 60); }

    /* leaving mid-spin settles the round rather than handing the bet back */
    C.setBank(100000);
    t3.pick(10000); t3.aim('black'); t3.lay(true);
    const owed = C.bank();
    t3.spin();
    window.__step(30, 1 / 60);
    app.seating.stand(); window.__step(150, 1 / 60);
    const res = app.scene && window.__t().userData.act;
    ok(!t3.active, 'you can walk away mid-spin');
    ok(C.bank() === owed || C.bank() === owed + 20000,
      'and the round was settled, not refunded, got ' + C.bank());
    app.seating.sit(window.__t()); window.__step(150, 1 / 60);

    t3.pick(2500); t3.aim('s:3'); t3.lay(true);
    const held = R.staked(t3.game), bank = C.bank();
    app.seating.stand();
    window.__step(150, 1 / 60);
    ok(app.seating.state === 'walking', 'back on your feet, got ' + app.seating.state);
    ok(!t3.active, 'the table let go');
    ok(C.bank() === bank + held, 'you picked your chips up on the way out');
    ok(app.scene.getObjectByName('playerChips').children.length === 0, 'the cloth is clear');
    ok(!document.getElementById('table3d').classList.contains('on'), 'the rail is down');
    ok(!document.body.classList.contains('playing'), 'and the floor is back to normal');

    /* sitting back down is a fresh round, not the old one */
    const roul = window.__t();
    app.seating.sit(roul); window.__step(150, 1 / 60);
    ok(t3.active && R.staked(t3.game) === 0, 'a new session starts empty');
    app.seating.stand(); window.__step(150, 1 / 60);

    /* and the games that are not playable on the table still are not */
    let bj = null;
    app.scene.traverse(o => {
      if (!bj && o.userData && o.userData.game && o.userData.game.id === 'blackjack') bj = o;
    });
    ok(!t3.claims(bj), 'blackjack is not a cloth game yet');
    app.seating.sit(bj); window.__step(170, 1 / 60);
    ok(document.getElementById('panel').classList.contains('on'), 'it still comes up on a screen');
    ok(!t3.active, 'and does not go through the cloth');
    app.seating.stand(); window.__step(150, 1 / 60);
    return { n, log };
  });

  const all = [a, b, c, e, d];
  const n = all.reduce((s, r) => s + r.n, 0);
  const log = all.reduce((s, r) => s.concat(r.log), []);
  log.forEach(l => console.log(l));
  console.log('bets on the cloth: ' + a.bets + ' | spins: ' + c.seen.join(' '));
  if (errs.length) console.log('CONSOLE: ' + errs.slice(0, 8).join(' // '));
  console.log(log.length || errs.length
    ? 'table3d: ' + log.length + ' of ' + n + ' FAILED'
    : 'table3d: ' + n + ' checks passed');
  await browser.close();
  process.exit(log.length || errs.length ? 1 : 0);
})();
