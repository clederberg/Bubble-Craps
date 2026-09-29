/* Baccarat rules engine: 8-deck shoe, standard drawing tableau.
   Two games: Commission (banker pays 19:20) and EZ (banker pays even, but a banker
   three-card 7 pushes). Side bets: pairs, perfect pair, Dragon 7 and Panda 8.
   All money is in cents. */
(function (root) {
  'use strict';
  var C = (typeof require === 'function' && typeof module !== 'undefined') ? require('./common.js') : root.Casino;

  var RULES = { decks: 8, penetration: 0.82 };
  var PAYS = {
    player: [1, 1], bankerEZ: [1, 1], bankerComm: [19, 20], tie: [8, 1],
    pPair: [11, 1], bPair: [11, 1], either: [5, 1], perfect: [25, 1], perfectBoth: [200, 1],
    dragon: [40, 1], panda: [25, 1]
  };
  var LIMITS = { main: 1000000, side: 100000 };
  var BETS = {
    player: 'Player', banker: 'Banker', tie: 'Tie', pPair: 'Player Pair', bPair: 'Banker Pair',
    either: 'Either Pair', perfect: 'Perfect Pair', dragon: 'Dragon 7', panda: 'Panda 8'
  };

  function total(cards) {
    var t = 0;
    cards.forEach(function (c) { t += C.bacValue(c.r); });
    return t % 10;
  }
  function isPair(cards) { return cards.length >= 2 && cards[0].r === cards[1].r; }
  function isPerfect(cards) { return isPair(cards) && cards[0].s === cards[1].s; }

  function newGame(decks) { return { shoe: C.newShoe(decks || RULES.decks, RULES.penetration), rounds: [] }; }

  /* Deals one coup and returns the result. */
  function deal(G) {
    var shuffled = false;
    if (C.needsShuffle(G.shoe)) { C.shuffle(G.shoe); shuffled = true; }
    var p = [], b = [];
    p.push(C.draw(G.shoe)); b.push(C.draw(G.shoe)); p.push(C.draw(G.shoe)); b.push(C.draw(G.shoe));
    var pt = total(p), bt = total(b), p3 = null;
    var natural = pt >= 8 || bt >= 8;
    if (!natural) {
      if (pt <= 5) { p.push(C.draw(G.shoe)); p3 = C.bacValue(p[2].r); pt = total(p); }
      var drawB;
      if (p3 === null) drawB = bt <= 5;
      else if (bt <= 2) drawB = true;
      else if (bt === 3) drawB = p3 !== 8;
      else if (bt === 4) drawB = p3 >= 2 && p3 <= 7;
      else if (bt === 5) drawB = p3 >= 4 && p3 <= 7;
      else if (bt === 6) drawB = p3 === 6 || p3 === 7;
      else drawB = false;
      if (drawB) { b.push(C.draw(G.shoe)); bt = total(b); }
    }
    var res = pt > bt ? 'P' : bt > pt ? 'B' : 'T';
    var round = {
      player: p, banker: b, pt: pt, bt: bt, result: res, shuffled: shuffled,
      dragon7: res === 'B' && bt === 7 && b.length === 3,
      panda8: res === 'P' && pt === 8 && p.length === 3,
      pPair: isPair(p), bPair: isPair(b), pPerfect: isPerfect(p), bPerfect: isPerfect(b),
      natural: natural
    };
    G.rounds.unshift(round);
    if (G.rounds.length > 200) G.rounds.length = 200;
    return round;
  }

  function mul(c, r) { return Math.floor(c * r[0] / r[1]); }

  /* bets: { player, banker, tie, pPair, bPair, either, perfect, dragon, panda } in cents.
     mode: 'commission' | 'ez'. Returns money back to the bankroll plus a row per bet. */
  function settle(round, bets, mode) {
    var out = { back: 0, net: 0, rows: [] };
    function row(k, label, amount, net, kind) {
      out.back += amount; out.net += net;
      out.rows.push({ k: k, label: label, amount: amount, net: net, kind: kind });
    }
    function win(k, label, bet, pay, note) { var w = mul(bet, pay); row(k, label + (note ? ' ' + note : ''), bet + w, w, 'win'); }
    function lose(k, label, bet) { row(k, label, 0, -bet, 'lose'); }
    function push(k, label, bet, note) { row(k, label + (note ? ' ' + note : ''), bet, 0, 'push'); }
    var ez = mode === 'ez', r = round;

    if (bets.player) {
      if (r.result === 'P') win('player', 'Player', bets.player, PAYS.player, r.panda8 ? '(Panda 8)' : '');
      else if (r.result === 'T') push('player', 'Player', bets.player, '(tie)');
      else lose('player', 'Player', bets.player);
    }
    if (bets.banker) {
      if (r.result === 'B') {
        if (ez && r.dragon7) push('banker', 'Banker', bets.banker, '(Dragon 7 — pushes)');
        else win('banker', 'Banker', bets.banker, ez ? PAYS.bankerEZ : PAYS.bankerComm, ez ? '' : '(5% commission)');
      } else if (r.result === 'T') push('banker', 'Banker', bets.banker, '(tie)');
      else lose('banker', 'Banker', bets.banker);
    }
    if (bets.tie) {
      if (r.result === 'T') win('tie', 'Tie', bets.tie, PAYS.tie);
      else lose('tie', 'Tie', bets.tie);
    }
    if (bets.pPair) { if (r.pPair) win('pPair', 'Player Pair', bets.pPair, PAYS.pPair); else lose('pPair', 'Player Pair', bets.pPair); }
    if (bets.bPair) { if (r.bPair) win('bPair', 'Banker Pair', bets.bPair, PAYS.bPair); else lose('bPair', 'Banker Pair', bets.bPair); }
    if (bets.either) { if (r.pPair || r.bPair) win('either', 'Either Pair', bets.either, PAYS.either); else lose('either', 'Either Pair', bets.either); }
    if (bets.perfect) {
      if (r.pPerfect && r.bPerfect) win('perfect', 'Perfect Pair', bets.perfect, PAYS.perfectBoth, '(both sides)');
      else if (r.pPerfect || r.bPerfect) win('perfect', 'Perfect Pair', bets.perfect, PAYS.perfect);
      else lose('perfect', 'Perfect Pair', bets.perfect);
    }
    if (ez && bets.dragon) { if (r.dragon7) win('dragon', 'Dragon 7', bets.dragon, PAYS.dragon); else lose('dragon', 'Dragon 7', bets.dragon); }
    if (ez && bets.panda) { if (r.panda8) win('panda', 'Panda 8', bets.panda, PAYS.panda); else lose('panda', 'Panda 8', bets.panda); }
    return out;
  }

  var api = { RULES: RULES, PAYS: PAYS, LIMITS: LIMITS, BETS: BETS, total: total, newGame: newGame, deal: deal, settle: settle, isPair: isPair, isPerfect: isPerfect };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BAC = api;
})(this);
