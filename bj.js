/* Blackjack rules engine. 6-deck shoe, dealer stands on all 17s, blackjack pays 3:2.
   Double on any two, double after split, split to four hands, split aces get one card,
   late surrender, insurance 2:1. Side bets: Match the Dealer and Buster Blackjack.
   All money is in cents. */
(function (root) {
  'use strict';
  var C = (typeof require === 'function' && typeof module !== 'undefined') ? require('./common.js') : root.Casino;

  var RULES = {
    decks: 6, penetration: 0.75, maxHands: 4, s17: true, das: true, surrender: true,
    resplitAces: false, hitSplitAces: false, blackjack: [3, 2], insurance: [2, 1]
  };
  // Match the Dealer, 6 decks: each player card matching the dealer up card.
  var MTD = { unsuited: 4, suited: 9 };
  // Buster Blackjack, 6 decks: pays on the number of cards in the dealer's busted hand.
  var BUSTER = { 3: 2, 4: 2, 5: 4, 6: 18, 7: 50, 8: 250 };
  var LIMITS = { main: 2500000, side: 100000, minBet: 100 };

  function value(cards) {
    var t = 0, aces = 0;
    cards.forEach(function (c) { var v = C.bjValue(c.r); t += v; if (c.r === 'A') aces++; });
    while (t > 21 && aces) { t -= 10; aces--; }
    return { total: t, soft: aces > 0 };
  }
  function total(cards) { return value(cards).total; }
  function isBust(h) { return total(h.cards) > 21; }
  function isBlackjack(h) { return !h.fromSplit && h.cards.length === 2 && total(h.cards) === 21; }
  function handLabel(h) {
    var v = value(h.cards);
    if (isBlackjack(h)) return 'Blackjack';
    if (v.total > 21) return 'Bust ' + v.total;
    return (v.soft && v.total !== 21 ? 'Soft ' : '') + v.total;
  }

  function newGame(decks) {
    return { shoe: C.newShoe(decks || RULES.decks, RULES.penetration), spots: [], dealer: [], phase: 'betting', active: null, peeked: false, events: [] };
  }
  function newHand(bet, fromSplit, aceSplit) {
    return { cards: [], bet: bet, stood: false, doubled: false, surrendered: false, fromSplit: !!fromSplit, aceSplit: !!aceSplit };
  }

  /* bets: [{ seat, bet, mtd, buster }] — seat is just a label for the UI */
  function deal(G, bets) {
    G.events = [];
    if (C.needsShuffle(G.shoe)) { C.shuffle(G.shoe); G.events.push({ t: 'shuffle' }); }
    G.dealer = [];
    G.peeked = false;
    G.dealerHole = true;
    G.spots = bets.filter(function (b) { return b.bet > 0; }).map(function (b, i) {
      return { seat: b.seat === undefined ? i : b.seat, bet: b.bet, mtd: b.mtd || 0, buster: b.buster || 0, ins: 0, hands: [newHand(b.bet)], active: 0, side: [] };
    });
    if (!G.spots.length) return G;
    // two cards to each spot, then the dealer
    for (var round = 0; round < 2; round++) {
      G.spots.forEach(function (sp) { sp.hands[0].cards.push(C.draw(G.shoe)); });
      G.dealer.push(C.draw(G.shoe));
    }
    resolveMatchTheDealer(G);
    var up = G.dealer[0];
    if (up.r === 'A') { G.phase = 'insurance'; return G; }
    if (C.bjValue(up.r) === 10) return peek(G);
    G.peeked = true;
    return startPlay(G);
  }

  function resolveMatchTheDealer(G) {
    var up = G.dealer[0];
    G.spots.forEach(function (sp) {
      if (!sp.mtd) return;
      var pay = 0, hits = [];
      sp.hands[0].cards.forEach(function (c) {
        if (c.r !== up.r) return;
        var suited = c.s === up.s;
        pay += sp.mtd * (suited ? MTD.suited : MTD.unsuited);
        hits.push((suited ? 'suited ' : '') + c.r);
      });
      sp.side.push(pay
        ? { k: 'mtd', win: true, amount: pay + sp.mtd, net: pay, note: hits.join(' + ') }
        : { k: 'mtd', win: false, amount: 0, net: -sp.mtd, note: 'no match' });
    });
  }

  function dealerBlackjack(G) { return G.dealer.length === 2 && total(G.dealer) === 21; }

  /* A player holding a natural against an ace can take even money: a guaranteed 1:1
     instead of the 3:2 that pushes when the dealer also has blackjack. */
  function canTakeEvenMoney(G, spotIndex) {
    var sp = G.spots[spotIndex];
    return G.phase === 'insurance' && sp && !sp.even && !sp.ins && sp.hands.length === 1 && isBlackjack(sp.hands[0]);
  }
  function evenMoneySpots(G) {
    return G.spots.map(function (sp, i) { return i; }).filter(function (i) { return canTakeEvenMoney(G, i); });
  }
  function takeEvenMoney(G, spotIndex) {
    if (!canTakeEvenMoney(G, spotIndex)) return { ok: false, reason: 'Even money is only offered on a blackjack against an ace' };
    G.spots[spotIndex].even = true;
    return { ok: true };
  }

  function insure(G, spotIndex, amount) {
    if (G.phase !== 'insurance') return { ok: false, reason: 'Insurance is closed' };
    var sp = G.spots[spotIndex];
    if (sp.even) return { ok: false, reason: 'That hand already took even money' };
    var max = Math.floor(sp.bet / 2) - sp.ins;
    var a = Math.min(amount, max);
    if (a <= 0) return { ok: false, reason: 'Insurance is limited to half your bet' };
    sp.ins += a;
    return { ok: true, added: a };
  }
  function closeInsurance(G) {
    if (G.phase !== 'insurance') return G;
    return peek(G);
  }

  function peek(G) {
    G.peeked = true;
    if (dealerBlackjack(G)) {
      G.dealerHole = false;
      G.phase = 'payout';
      return G;
    }
    return startPlay(G);
  }

  function startPlay(G) {
    G.phase = 'player';
    G.active = { spot: 0, hand: 0 };
    settleAceSplits(G);
    skipDone(G);
    return G;
  }

  function current(G) {
    if (!G.active) return null;
    var sp = G.spots[G.active.spot];
    return sp ? sp.hands[G.active.hand] : null;
  }
  function handDone(h) { return h.stood || h.surrendered || h.doubled || total(h.cards) >= 21; }
  function settleAceSplits(G) {
    G.spots.forEach(function (sp) { sp.hands.forEach(function (h) { if (h.aceSplit && h.cards.length === 2) h.stood = true; }); });
  }
  function skipDone(G) {
    while (G.active) {
      var sp = G.spots[G.active.spot];
      if (!sp) { return finishPlayers(G); }
      var h = sp.hands[G.active.hand];
      if (h && !handDone(h)) return G;
      // next hand or next spot
      if (h && G.active.hand + 1 < sp.hands.length) G.active.hand++;
      else if (G.active.spot + 1 < G.spots.length) { G.active.spot++; G.active.hand = 0; }
      else return finishPlayers(G);
    }
    return G;
  }
  function anyLive(G) {
    return G.spots.some(function (sp) {
      return sp.hands.some(function (h) { return !h.surrendered && total(h.cards) <= 21 && !isBlackjack(h); });
    });
  }
  function anyBusterBet(G) { return G.spots.some(function (sp) { return sp.buster > 0; }); }

  function finishPlayers(G) {
    G.active = null;
    G.phase = 'dealer';
    G.dealerHole = false;
    if (anyLive(G) || anyBusterBet(G)) dealerPlay(G);
    G.phase = 'payout';
    return G;
  }
  function dealerPlay(G) {
    while (true) {
      var v = value(G.dealer);
      if (v.total > 21) break;
      if (v.total >= 17) break; // stands on all 17s
      G.dealer.push(C.draw(G.shoe));
    }
    return G;
  }

  function options(G) {
    var h = current(G);
    if (!h || G.phase !== 'player') return {};
    var sp = G.spots[G.active.spot], first = h.cards.length === 2;
    var v = C.bjValue(h.cards[0] && h.cards[0].r) === C.bjValue(h.cards[1] && h.cards[1].r);
    return {
      hit: !h.aceSplit,
      stand: true,
      double: first && !h.aceSplit && (!h.fromSplit || RULES.das),
      split: first && v && sp.hands.length < RULES.maxHands && (!h.fromSplit || h.cards[0].r !== 'A' || RULES.resplitAces),
      surrender: first && !h.fromSplit && RULES.surrender && sp.hands.length === 1
    };
  }

  /* action: 'hit' | 'stand' | 'double' | 'split' | 'surrender'.
     Returns { ok, cost } — cost is extra money the player must put up (double / split). */
  function act(G, action) {
    if (G.phase !== 'player') return { ok: false, reason: 'Not your turn' };
    var h = current(G), sp = G.spots[G.active.spot], o = options(G);
    if (!h) return { ok: false, reason: 'No hand' };
    if (!o[action]) return { ok: false, reason: 'You can’t ' + action + ' here' };
    var cost = 0;
    if (action === 'hit') {
      h.cards.push(C.draw(G.shoe));
    } else if (action === 'stand') {
      h.stood = true;
    } else if (action === 'double') {
      cost = h.bet;
      h.bet *= 2; h.doubled = true;
      h.cards.push(C.draw(G.shoe));
    } else if (action === 'split') {
      cost = h.bet;
      var isAces = h.cards[0].r === 'A';
      var moved = h.cards.pop();
      var nh = newHand(h.bet, true, isAces);
      nh.cards.push(moved);
      h.fromSplit = true;
      h.aceSplit = isAces;
      h.cards.push(C.draw(G.shoe));
      nh.cards.push(C.draw(G.shoe));
      sp.hands.splice(G.active.hand + 1, 0, nh);
      settleAceSplits(G);
    } else if (action === 'surrender') {
      h.surrendered = true;
    }
    skipDone(G);
    return { ok: true, cost: cost, action: action };
  }

  /* Settles everything and returns the money going back to the bankroll. */
  function settle(G) {
    var dv = value(G.dealer), dealerBJ = dealerBlackjack(G), dBust = dv.total > 21;
    var out = { back: 0, net: 0, rows: [] };
    function row(spot, label, amount, net, kind) {
      out.back += amount; out.net += net;
      out.rows.push({ spot: spot, label: label, amount: amount, net: net, kind: kind });
    }
    G.spots.forEach(function (sp, si) {
      // side bets resolved at the deal
      sp.side.forEach(function (s) {
        if (s.k === 'mtd') row(si, 'Match the Dealer' + (s.note ? ' (' + s.note + ')' : ''), s.amount, s.net, s.win ? 'win' : 'lose');
      });
      if (sp.buster) {
        if (dBust) {
          var n = Math.min(8, G.dealer.length), mult = BUSTER[n];
          row(si, 'Buster (dealer busts with ' + G.dealer.length + ')', sp.buster * (mult + 1), sp.buster * mult, 'win');
        } else row(si, 'Buster', 0, -sp.buster, 'lose');
      }
      if (sp.ins) {
        if (dealerBJ) row(si, 'Insurance', sp.ins * 3, sp.ins * 2, 'win');
        else row(si, 'Insurance', 0, -sp.ins, 'lose');
      }
      sp.hands.forEach(function (h, hi) {
        var label = sp.hands.length > 1 ? 'Hand ' + (hi + 1) : 'Hand';
        var pv = value(h.cards), bj = isBlackjack(h);
        if (sp.even && bj) { row(si, label + ' took even money', h.bet * 2, h.bet, 'win'); return; }
        if (h.surrendered) { row(si, label + ' surrendered', Math.floor(h.bet / 2), -Math.ceil(h.bet / 2), 'lose'); return; }
        if (pv.total > 21) { row(si, label + ' busts ' + pv.total, 0, -h.bet, 'lose'); return; }
        if (dealerBJ) {
          if (bj) row(si, label + ' pushes (both blackjack)', h.bet, 0, 'push');
          else row(si, label + ' loses to blackjack', 0, -h.bet, 'lose');
          return;
        }
        if (bj) { var w = Math.floor(h.bet * RULES.blackjack[0] / RULES.blackjack[1]); row(si, label + ' blackjack', h.bet + w, w, 'win'); return; }
        if (dBust) { row(si, label + ' wins, dealer busts', h.bet * 2, h.bet, 'win'); return; }
        if (pv.total > dv.total) { row(si, label + ' wins ' + pv.total + ' to ' + dv.total, h.bet * 2, h.bet, 'win'); return; }
        if (pv.total === dv.total) { row(si, label + ' pushes on ' + pv.total, h.bet, 0, 'push'); return; }
        row(si, label + ' loses ' + pv.total + ' to ' + dv.total, 0, -h.bet, 'lose');
      });
    });
    G.phase = 'settled';
    return out;
  }

  var api = {
    RULES: RULES, MTD: MTD, BUSTER: BUSTER, LIMITS: LIMITS,
    value: value, total: total, isBust: isBust, isBlackjack: isBlackjack, handLabel: handLabel,
    newGame: newGame, deal: deal, insure: insure, closeInsurance: closeInsurance,
    canTakeEvenMoney: canTakeEvenMoney, evenMoneySpots: evenMoneySpots, takeEvenMoney: takeEvenMoney,
    options: options, act: act, current: current, settle: settle,
    dealerBlackjack: dealerBlackjack, dealerPlay: dealerPlay
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BJ = api;
})(this);
