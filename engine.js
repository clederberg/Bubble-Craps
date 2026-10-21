/* Craps / Crapless Craps rules engine. All money is in cents. */
(function (root) {
  'use strict';

  var TRUE = { 2: [6, 1], 12: [6, 1], 3: [3, 1], 11: [3, 1], 4: [2, 1], 10: [2, 1], 5: [3, 2], 9: [3, 2], 6: [6, 5], 8: [6, 5] };
  var PLACE = { 2: [11, 2], 12: [11, 2], 3: [11, 4], 11: [11, 4], 4: [9, 5], 10: [9, 5], 5: [7, 5], 9: [7, 5], 6: [7, 6], 8: [7, 6] };
  var HARD = { 4: [7, 1], 10: [7, 1], 6: [9, 1], 8: [9, 1] };
  var PROPS = {
    any7: { name: 'Any Seven', pay: '4:1' },
    anyCraps: { name: 'Any Craps', pay: '7:1' },
    two: { name: 'Aces (2)', pay: '30:1' },
    three: { name: 'Ace-Deuce (3)', pay: '15:1' },
    eleven: { name: 'Yo (11)', pay: '15:1' },
    twelve: { name: 'Boxcars (12)', pay: '30:1' },
    horn: { name: 'Horn', pay: '2,12: 27:4 · 3,11: 3:1' },
    ce: { name: 'C & E', pay: 'Craps 3:1 · 11 7:1' }
  };
  var ATS = {
    small: { name: 'All Small', nums: [2, 3, 4, 5, 6], pay: 34 },
    tall: { name: 'All Tall', nums: [8, 9, 10, 11, 12], pay: 34 },
    all: { name: "Make 'Em All", nums: [2, 3, 4, 5, 6, 8, 9, 10, 11, 12], pay: 175 }
  };
  /* Regular craps runs flat 5x odds on every point, pass line and come alike.
     Crapless keeps the 3-4-5x ladder, since it carries the extra numbers. */
  var ODDS_FLAT5 = { 4: 5, 5: 5, 6: 5, 8: 5, 9: 5, 10: 5 };
  var ODDS_345 = { 2: 3, 3: 3, 4: 3, 10: 3, 11: 3, 12: 3, 5: 4, 9: 4, 6: 5, 8: 5 };
  var MODES = {
    craps: { name: 'Craps', points: [4, 5, 6, 8, 9, 10], dont: true, odds: ODDS_FLAT5, oddsText: '5x on every point', oddsLabel: '5X' },
    crapless: { name: 'Crapless', points: [2, 3, 4, 5, 6, 8, 9, 10, 11, 12], dont: false, odds: ODDS_345,
      oddsText: '3x on 2,3,4,10,11,12 \u00b7 4x on 5,9 \u00b7 5x on 6,8', oddsLabel: '3X 4X 5X' }
  };
  var ODDS_X = ODDS_345;
  function oddsX(t, n) { var o = (MODES[t.mode] || MODES.craps).odds; return o[n] || 0; }
  // Lay odds may win up to 6x the flat bet.
  var LAY_WIN_X = 6;
  var NAMES = { pass: 'Pass Line', passOdds: 'Pass Odds', dp: "Don't Pass", dpOdds: "Don't Pass Odds", come: 'Come', dc: "Don't Come", field: 'Field' };

  function mul(c, r) { return Math.floor(c * r[0] / r[1]); }
  function inv(r) { return [r[1], r[0]]; }
  function parse(k) {
    var i = k.indexOf(':');
    var type = i < 0 ? k : k.slice(0, i), arg = i < 0 ? null : k.slice(i + 1);
    var n = arg !== null && /^\d+$/.test(arg) ? +arg : null;
    return { type: type, arg: arg, n: n };
  }
  function label(k) {
    var p = parse(k);
    switch (p.type) {
      case 'place': return 'Place ' + p.n;
      case 'buy': return 'Buy ' + p.n;
      case 'lay': return 'Lay ' + p.n;
      case 'hard': return 'Hard ' + p.n;
      case 'comeOn': return 'Come on ' + p.n;
      case 'comeOdds': return 'Come Odds on ' + p.n;
      case 'dcOn': return "Don't Come on " + p.n;
      case 'dcOdds': return "Don't Come Odds on " + p.n;
      case 'prop': return PROPS[p.arg].name;
      case 'ats': return ATS[p.arg].name;
      default: return NAMES[k] || k;
    }
  }

  /* P(a hand lasts at least n rolls), from the Markov chain over come-out and
     the six point states. Worked out once and tabulated, so the table can tell
     you how rare the roll you just made is. */
  var HAND_ODDS = { 10: 3, 15: 7, 20: 14, 25: 29, 30: 60, 40: 265, 50: 1161, 60: 5100,
    75: 46920, 100: 1895441, 125: 76570775, 150: 3093257037, 175: 124960953047, 200: 5050668757641 };
  var MILESTONES = [10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 175, 200];
  function handOdds(n) {
    if (HAND_ODDS[n]) return HAND_ODDS[n];
    // past the table, each further roll survives with probability 0.86241
    return Math.round(HAND_ODDS[200] / Math.pow(0.86241, n - 200));
  }

  function newTable(mode) { return { mode: mode, point: null, bets: {}, atsHits: [], rolls: [], working: false, off: {}, on: {}, hand: 0 }; }

  /* Is this bet live on the next roll?
     Every place, buy, lay, hardway and come-odds bet carries its own setting:

       auto     the house default: place, buy and hardway bets sit off on the
                come-out the way they do on a real table, lays stay on
       working  works on every roll, come-out included, which is the equivalent
                of telling the dealer "my hard four is working"
       off      off until you turn it back on

     The table-wide come-out switch only moves bets still on auto, so setting
     one number working leaves the rest alone. This is the one place that
     decides it, so the table art and the payout logic can never disagree. */
  var TOGGLEABLE = ['place', 'buy', 'hard', 'comeOdds', 'lay'];
  function canToggle(t, k) {
    return TOGGLEABLE.indexOf(parse(k).type) >= 0 && amt(t, k) > 0;
  }
  function betState(t, k) {
    if (TOGGLEABLE.indexOf(parse(k).type) < 0) return 'always';
    if (t.off && t.off[k]) return 'off';
    if (t.on && t.on[k]) return 'working';
    return 'auto';
  }
  function setState(t, k, state) {
    if (!canToggle(t, k)) return false;
    if (!t.off) t.off = {};
    if (!t.on) t.on = {};
    delete t.off[k]; delete t.on[k];
    if (state === 'off') t.off[k] = 1;
    else if (state === 'working') t.on[k] = 1;
    return true;
  }
  function cycleState(t, k) {
    var next = { auto: 'working', working: 'off', off: 'auto' }[betState(t, k)];
    return setState(t, k, next) ? next : null;
  }
  function toggleOff(t, k) {
    return setState(t, k, betState(t, k) === 'off' ? 'auto' : 'off');
  }
  function isWorking(t, k) {
    var p = parse(k);
    if (TOGGLEABLE.indexOf(p.type) < 0) return true;
    if (t.off && t.off[k]) return false;
    if (t.on && t.on[k]) return true;
    if (p.type === 'lay') return true;
    return t.point !== null || !!t.working;
  }
  function amt(t, k) { return t.bets[k] || 0; }

  // '' when allowed, otherwise the reason it is not
  function canAdd(t, k) {
    var m = MODES[t.mode], p = parse(k), on = t.point !== null;
    switch (p.type) {
      case 'pass': return on ? 'Pass Line bets go down before the come-out roll' : '';
      case 'dp': if (!m.dont) return 'Not offered in crapless'; return on ? "Don't Pass bets go down before the come-out roll" : '';
      case 'passOdds': if (!on) return 'Odds need a point'; return amt(t, 'pass') ? '' : 'Make a Pass Line bet first';
      case 'dpOdds': if (!on) return 'Odds need a point'; return amt(t, 'dp') ? '' : "Make a Don't Pass bet first";
      case 'come': return on ? '' : 'Come bets need a point (use the Pass Line)';
      case 'dc': if (!m.dont) return 'Not offered in crapless'; return on ? '' : "Don't Come bets need a point (use Don't Pass)";
      case 'comeOdds': return amt(t, 'comeOn:' + p.n) ? '' : 'No Come bet on ' + p.n;
      case 'dcOdds': return amt(t, 'dcOn:' + p.n) ? '' : "No Don't Come bet on " + p.n;
      case 'place': case 'buy': case 'lay': return m.points.indexOf(p.n) >= 0 ? '' : 'Not available';
      case 'hard': return HARD[p.n] ? '' : 'Not available';
      case 'field': return '';
      case 'prop': return PROPS[p.arg] ? '' : 'Not available';
      case 'ats': if (!ATS[p.arg]) return 'Not available'; return t.atsHits.length ? 'Small / Tall / All open again after the next 7' : '';
      case 'comeOn': case 'dcOn': return 'Come bets travel here on their own';
    }
    return 'Unknown bet';
  }
  // Table limits (cents). Lay bets are capped by what they win.
  /* Table limits, in cents. A lay is capped by what it stands to win rather
     than what it puts up, the way a real table does it, so the $50,000 here
     means $50,000 won: laying the 4 at 1:2 can put up $100,000 to win it.
     Odds are capped separately, as a multiple of the flat bet. */
  var LIMITS = {
    line: 2500000,    // pass, don't pass, come, don't come
    place: 5000000,   // each place or buy bet, per number
    layWin: 5000000,  // most a lay can win
    field: 1000000,
    hard: 1000000,
    prop: 500000      // props and the all small / all tall / make 'em all bets
  };
  function dollars(c) { return '$' + (c / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function maxFor(t, k) {
    var p = parse(k);
    switch (p.type) {
      case 'pass': case 'dp': case 'come': case 'dc': return LIMITS.line;
      case 'place': case 'buy': return LIMITS.place;
      case 'field': return LIMITS.field;
      case 'hard': return LIMITS.hard;
      case 'prop': case 'ats': return LIMITS.prop;
      case 'lay': return mul(LIMITS.layWin, TRUE[p.n]);
      case 'passOdds': return amt(t, 'pass') * oddsX(t, t.point);
      case 'dpOdds': return mul(amt(t, 'dp') * LAY_WIN_X, TRUE[t.point]);
      case 'comeOdds': return amt(t, 'comeOn:' + p.n) * oddsX(t, p.n);
      case 'dcOdds': return mul(amt(t, 'dcOn:' + p.n) * LAY_WIN_X, TRUE[p.n]);
    }
    return Infinity;
  }
  function limitText(t, k) {
    var p = parse(k), n = p.n !== null ? p.n : t.point;
    switch (p.type) {
      case 'dpOdds': case 'dcOdds': return 'Lay odds max: win ' + LAY_WIN_X + 'x your flat bet';
      case 'passOdds': case 'comeOdds': return 'Odds max on ' + n + ' is ' + oddsX(t, n) + 'x';
    }
    /* Everything else runs with no table limit, so the only thing that can
       stop a bet is the bankroll. */
    var m = maxFor(t, k);
    return m === Infinity ? 'Not enough in your bankroll' : 'Max on ' + label(k) + ' is ' + dollars(m);
  }
  function add(t, k, c) {
    var r = canAdd(t, k);
    if (r) return { ok: false, reason: r };
    var room = maxFor(t, k) - amt(t, k);
    var a = Math.min(c, room);
    if (a <= 0) return { ok: false, reason: limitText(t, k) };
    t.bets[k] = amt(t, k) + a;
    return { ok: true, added: a, capped: a < c ? limitText(t, k) : '' };
  }
  function canRemove(t, k) {
    var p = parse(k);
    if (!amt(t, k)) return 'Nothing to take down';
    if (p.type === 'pass' && t.point !== null) return 'Pass Line is a contract bet once a point is set';
    if (p.type === 'comeOn' || p.type === 'dcOn') return 'Come bets stay until they resolve';
    if (p.type === 'ats' && t.atsHits.length) return 'Small / Tall / All stay until they resolve';
    return '';
  }
  function remove(t, k, c) {
    var r = canRemove(t, k);
    if (r) return { ok: false, reason: r };
    var a = Math.min(c === undefined ? Infinity : c, amt(t, k));
    t.bets[k] -= a;
    if (!t.bets[k]) delete t.bets[k];
    // removing a flat bet takes its odds with it
    var extra = 0, p = parse(k);
    var pair = { pass: 'passOdds', dp: 'dpOdds' }[p.type];
    if (pair && !t.bets[k] && t.bets[pair]) { extra = t.bets[pair]; delete t.bets[pair]; }
    if (!t.bets[k]) { if (t.off) delete t.off[k]; if (t.on) delete t.on[k]; }
    return { ok: true, removed: a + extra };
  }
  // Move a bet to another number (same kind), respecting table limits
  function moveBet(t, from, to) {
    var a = amt(t, from);
    if (!a) return { ok: false, reason: 'Nothing to move' };
    var why = canAdd(t, to);
    if (why) return { ok: false, reason: why };
    var room = maxFor(t, to) - amt(t, to);
    var m = Math.min(a, room);
    if (m <= 0) return { ok: false, reason: limitText(t, to) };
    t.bets[to] = amt(t, to) + m;
    t.bets[from] = a - m;
    if (!t.bets[from]) delete t.bets[from];
    return { ok: true, moved: m, left: t.bets[from] || 0 };
  }
  function removeAll(t) {
    var back = 0;
    Object.keys(t.bets).forEach(function (k) { if (!canRemove(t, k)) { back += t.bets[k]; delete t.bets[k]; if (t.off) delete t.off[k]; if (t.on) delete t.on[k]; } });
    // odds orphaned by a removed flat bet are returned as well
    ['passOdds', 'dpOdds'].forEach(function (k) {
      var flat = k === 'passOdds' ? 'pass' : 'dp';
      if (t.bets[k] && !t.bets[flat]) { back += t.bets[k]; delete t.bets[k]; }
    });
    return back;
  }
  function onTable(t) { var s = 0; for (var k in t.bets) s += t.bets[k]; return s; }

  function roll(t, d1, d2) {
    var s = d1 + d2, hard = d1 === d2, on = t.point !== null, m = MODES[t.mode], B = t.bets;
    var ev = [], back = 0, pointBefore = t.point, kept = 0;
    /* A hand is every roll one shooter makes, and it ends only on a seven out.
       The mean is 8.53 rolls, so a long one is worth noticing. */
    t.hand = (t.hand || 0) + 1;
    function has(k) { return B[k] > 0; }
    function live(k) { return isWorking(t, k); }
    function win(k, profit, keep) {
      back += profit + (keep ? 0 : B[k]);
      ev.push({ k: k, r: 'win', net: profit, keep: !!keep });
      if (!keep) delete B[k];
    }
    function lose(k) { ev.push({ k: k, r: 'lose', net: -B[k] }); delete B[k]; }
    function giveBack(k, why) { back += B[k]; ev.push({ k: k, r: 'push', net: 0, why: why }); delete B[k]; }
    function move(from, to) {
      B[to] = (B[to] || 0) + B[from];
      ev.push({ k: from, r: 'move', net: 0, to: to });
      delete B[from];
    }

    // Field (one roll)
    if (has('field')) {
      if ([3, 4, 9, 10, 11].indexOf(s) >= 0) win('field', B.field, true);
      else if (s === 2) win('field', B.field * 2, true);
      else if (s === 12) win('field', B.field * 3, true);
      else lose('field');
    }
    // Props (one roll)
    var mult = { any7: s === 7 ? 4 : 0, anyCraps: [2, 3, 12].indexOf(s) >= 0 ? 7 : 0, two: s === 2 ? 30 : 0, three: s === 3 ? 15 : 0, eleven: s === 11 ? 15 : 0, twelve: s === 12 ? 30 : 0 };
    Object.keys(mult).forEach(function (p) {
      var k = 'prop:' + p;
      if (has(k)) { if (mult[p]) win(k, B[k] * mult[p], true); else lose(k); }
    });
    if (has('prop:horn')) {
      if (s === 2 || s === 12) win('prop:horn', mul(B['prop:horn'], [27, 4]), true);
      else if (s === 3 || s === 11) win('prop:horn', B['prop:horn'] * 3, true);
      else lose('prop:horn');
    }
    if (has('prop:ce')) {
      if (s === 2 || s === 3 || s === 12) win('prop:ce', B['prop:ce'] * 3, true);
      else if (s === 11) win('prop:ce', B['prop:ce'] * 7, true);
      else lose('prop:ce');
    }
    // Hardways (off on the come-out)
    [4, 6, 8, 10].forEach(function (n) {
      var k = 'hard:' + n;
      if (!has(k) || !live(k)) return;
      if (s === n && hard) win(k, mul(B[k], HARD[n]), true);
      else if (s === n || s === 7) lose(k);
    });
    // Place / Buy (off on the come-out), Lay (always working)
    m.points.forEach(function (n) {
      var pk = 'place:' + n, bk = 'buy:' + n, lk = 'lay:' + n;
      if (has(pk) && live(pk)) { if (s === n) win(pk, mul(B[pk], PLACE[n]), true); else if (s === 7) lose(pk); }
      if (has(bk) && live(bk)) {
        if (s === n) win(bk, mul(B[bk], TRUE[n]) - Math.round(B[bk] * 0.05), true);
        else if (s === 7) lose(bk);
      }
      if (has(lk) && live(lk)) {
        if (s === 7) { var w = mul(B[lk], inv(TRUE[n])); win(lk, w - Math.round(w * 0.05), true); }
        else if (s === n) lose(lk);
      }
    });
    // Come / Don't Come bets already sitting on numbers
    m.points.forEach(function (n) {
      var ck = 'comeOn:' + n, co = 'comeOdds:' + n, dk = 'dcOn:' + n, dO = 'dcOdds:' + n;
      if (has(ck)) {
        if (s === n) {
          /* Keep it up: the flat rides again in the Come box instead of coming
             back to you. Self-funding, so the bankroll only sees the profit. */
          if (t.keepCome) {
            var flat = B[ck];
            back += flat;
            ev.push({ k: ck, r: 'win', net: flat, keep: true, kept: true });
            delete B[ck];
            /* Held back until the come box has been read, so the bet rides on
               the next roll rather than travelling again on this one. */
            kept += flat;
          } else win(ck, B[ck], false);
          if (has(co)) { if (live(co)) win(co, mul(B[co], TRUE[n]), false); else giveBack(co, 'odds were off'); }
        } else if (s === 7) {
          lose(ck);
          if (has(co)) { if (live(co)) lose(co); else giveBack(co, 'odds were off'); }
        }
      }
      if (has(dk)) {
        if (s === 7) {
          win(dk, B[dk], false);
          if (has(dO)) win(dO, mul(B[dO], inv(TRUE[n])), false);
        } else if (s === n) {
          lose(dk);
          if (has(dO)) lose(dO);
        }
      }
    });
    // Come / Don't Come bets waiting in the box
    if (has('come')) {
      if (m.dont) {
        if (s === 7 || s === 11) win('come', B.come, false);
        else if (s === 2 || s === 3 || s === 12) lose('come');
        else move('come', 'comeOn:' + s);
      } else {
        if (s === 7) win('come', B.come, false);
        else move('come', 'comeOn:' + s);
      }
    }
    if (has('dc')) {
      if (s === 2 || s === 3) win('dc', B.dc, false);
      else if (s === 12) ev.push({ k: 'dc', r: 'push', net: 0, why: 'bar 12', keep: true });
      else if (s === 7 || s === 11) lose('dc');
      else move('dc', 'dcOn:' + s);
    }
    // Line bets and the point
    if (!on) {
      if (m.dont) {
        if (s === 7 || s === 11) { if (has('pass')) win('pass', B.pass, true); if (has('dp')) lose('dp'); }
        else if (s === 2 || s === 3 || s === 12) {
          if (has('pass')) lose('pass');
          if (has('dp')) { if (s === 12) ev.push({ k: 'dp', r: 'push', net: 0, why: 'bar 12', keep: true }); else win('dp', B.dp, true); }
        } else t.point = s;
      } else {
        if (s === 7) { if (has('pass')) win('pass', B.pass, true); }
        else t.point = s;
      }
    } else {
      var p = t.point;
      if (s === p) {
        if (has('pass')) win('pass', B.pass, true);
        if (has('passOdds')) win('passOdds', mul(B.passOdds, TRUE[p]), false);
        if (has('dp')) lose('dp');
        if (has('dpOdds')) lose('dpOdds');
        t.point = null;
      } else if (s === 7) {
        if (has('pass')) lose('pass');
        if (has('passOdds')) lose('passOdds');
        if (has('dp')) win('dp', B.dp, true);
        if (has('dpOdds')) win('dpOdds', mul(B.dpOdds, inv(TRUE[p])), false);
        t.point = null;
      }
    }
    // All Small / All Tall / Make 'Em All
    if (s === 7) {
      Object.keys(ATS).forEach(function (a) { if (has('ats:' + a)) lose('ats:' + a); });
      t.atsHits = [];
    } else {
      if (t.atsHits.indexOf(s) < 0) t.atsHits.push(s);
      Object.keys(ATS).forEach(function (a) {
        var k = 'ats:' + a;
        if (has(k) && ATS[a].nums.every(function (v) { return t.atsHits.indexOf(v) >= 0; })) win(k, B[k] * ATS[a].pay, false);
      });
    }

    t.rolls.unshift({ d1: d1, d2: d2, s: s });
    if (t.rolls.length > 40) t.rolls.length = 40;
    var net = ev.reduce(function (a, e) { return a + e.net; }, 0);
    if (kept) B.come = (B.come || 0) + kept;
    var handOver = pointBefore !== null && s === 7, handLength = t.hand;
    if (handOver) t.hand = 0;
    var pointMade = pointBefore !== null && s === pointBefore;
    return { s: s, hard: hard, d1: d1, d2: d2, ev: ev, back: back, net: net, kept: kept,
      hand: handLength, handOver: handOver, pointMade: pointMade,
      pointBefore: pointBefore, pointAfter: t.point };
  }

  var api = {
    TRUE: TRUE, PLACE: PLACE, HARD: HARD, PROPS: PROPS, ATS: ATS, MODES: MODES, ODDS_X: ODDS_X, LIMITS: LIMITS, LAY_WIN_X: LAY_WIN_X, maxFor: maxFor,
    parse: parse, label: label, newTable: newTable, amt: amt, canAdd: canAdd, add: add,
    isWorking: isWorking, canToggle: canToggle, toggleOff: toggleOff,
    betState: betState, setState: setState, cycleState: cycleState,
    handOdds: handOdds, MILESTONES: MILESTONES,
    canRemove: canRemove, remove: remove, moveBet: moveBet, limitText: limitText, removeAll: removeAll, onTable: onTable, roll: roll
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Craps = api;
})(this);
