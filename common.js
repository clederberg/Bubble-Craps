/* Shared pieces for the Bubble Craps casino: bankroll, chips, sounds, cards and shoes. */
(function (root) {
  'use strict';
  var KEY = 'bubblecraps.v1', START = 100000;
  var CHIPS = [1, 5, 25, 100, 500, 1000, 5000, 25000];

  /* ---------- money ---------- */
  function money(c, sign) {
    var neg = c < 0, v = Math.abs(c) / 100;
    var s = '$' + v.toLocaleString('en-US', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
    return (neg ? '-' : (sign && c > 0 ? '+' : '')) + s;
  }
  function chipText(c) { var d = c / 100; if (d >= 1000) return (Math.round(d / 100) / 10) + 'k'; return d % 1 ? d.toFixed(2).replace(/0$/, '') : String(d); }
  function chipColor(c) {
    if (c >= 2500000) return ['#8fb8d8', '#0d2233'];
    if (c >= 500000) return ['#e0701f', '#fff'];
    if (c >= 100000) return ['#d1a12f', '#221a03'];
    if (c >= 50000) return ['#6b3fa0', '#fff'];
    if (c >= 10000) return ['#1d1d1f', '#fff'];
    if (c >= 2500) return ['#2f8a4f', '#fff'];
    if (c >= 500) return ['#c9392f', '#fff'];
    return ['#ece6d6', '#222'];
  }

  /* ---------- shared saved state (bankroll is common to all three games) ---------- */
  var S = null;
  function load() {
    if (S) return S;
    try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
    if (!S || typeof S !== 'object') S = {};
    if (typeof S.bank !== 'number') S.bank = START;
    if (typeof S.chip !== 'number') S.chip = 500;
    if (S.sound === undefined) S.sound = true;
    if (S.voice === undefined) S.voice = true;
    return S;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(load())); } catch (e) {} }
  function bank() { return load().bank; }
  function addBank(c) { load().bank += c; save(); return load().bank; }
  function setBank(c) { load().bank = c; save(); }
  function game(name, init) {
    var s = load();
    if (!s[name]) s[name] = init;
    return s[name];
  }

  /* ---------- randomness ---------- */
  var LIMIT32 = 4294967296;
  function randInt(n) { // unbiased 0..n-1
    var max = LIMIT32 - (LIMIT32 % n), a = new Uint32Array(1);
    do { crypto.getRandomValues(a); } while (a[0] >= max);
    return a[0] % n;
  }

  /* ---------- cards and shoe ---------- */
  var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var SUITS = ['S', 'H', 'D', 'C'];
  var SUIT_CH = { S: '♠', H: '♥', D: '♦', C: '♣' };
  function card(r, s) { return { r: r, s: s }; }
  function isRed(c) { return c.s === 'H' || c.s === 'D'; }
  function bjValue(r) { return r === 'A' ? 11 : (r === 'K' || r === 'Q' || r === 'J' || r === '10') ? 10 : +r; }
  function bacValue(r) { return (r === 'A') ? 1 : (r === 'K' || r === 'Q' || r === 'J' || r === '10') ? 0 : +r; }

  function newShoe(decks, penetration) {
    var cards = [];
    for (var d = 0; d < decks; d++)
      for (var s = 0; s < 4; s++)
        for (var r = 0; r < 13; r++) cards.push(card(RANKS[r], SUITS[s]));
    var shoe = { decks: decks, cards: cards, pos: 0, cut: 0, pen: penetration || 0.75, shuffled: true };
    shuffle(shoe);
    return shoe;
  }
  function shuffle(shoe) {
    var c = shoe.cards;
    for (var i = c.length - 1; i > 0; i--) { var j = randInt(i + 1), t = c[i]; c[i] = c[j]; c[j] = t; }
    shoe.pos = 0;
    shoe.cut = Math.floor(c.length * shoe.pen) + randInt(Math.max(1, Math.floor(c.length * 0.04)));
    shoe.shuffled = true;
    return shoe;
  }
  function draw(shoe) {
    if (shoe.pos >= shoe.cards.length) shuffle(shoe);
    return shoe.cards[shoe.pos++];
  }
  function needsShuffle(shoe) { return shoe.pos >= shoe.cut; }
  function remaining(shoe) { return shoe.cards.length - shoe.pos; }

  /* ---------- sound (shared clips from sounds.js) ---------- */
  var actx = null, sfx = {}, sfxLoading = false, lastPick = {};
  function ac() {
    if (!load().sound) return null;
    try {
      if (!actx) actx = new (root.AudioContext || root.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      loadSfx();
      return actx;
    } catch (e) { return null; }
  }
  function loadSfx() {
    if (sfxLoading || !actx || !root.CRAPS_SOUNDS) return;
    sfxLoading = true;
    Object.keys(root.CRAPS_SOUNDS).forEach(function (name) {
      try {
        var bin = atob(root.CRAPS_SOUNDS[name]), u = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        var group = name.replace(/\d+$/, '');
        var p = actx.decodeAudioData(u.buffer, function (buf) { (sfx[group] = sfx[group] || []).push(buf); }, function () {});
        if (p && p.catch) p.catch(function () {});
      } catch (e) {}
    });
  }
  function play(group, delay, vol, rate) {
    var a = ac(); if (!a) return false;
    var list = sfx[group]; if (!list || !list.length) return false;
    var i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === lastPick[group]) i = (i + 1) % list.length;
    lastPick[group] = i;
    var src = a.createBufferSource(), g = a.createGain();
    src.buffer = list[i];
    src.playbackRate.value = rate || (0.94 + Math.random() * 0.12);
    g.gain.value = vol === undefined ? 0.8 : vol;
    src.connect(g); g.connect(a.destination);
    src.start(a.currentTime + (delay || 0));
    return true;
  }
  function say(text) {
    var s = load();
    if (!s.sound || !s.voice || !root.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      var vs = speechSynthesis.getVoices().filter(function (v) { return /^en/i.test(v.lang); });
      var pref = ['Daniel', 'Aaron', 'Alex', 'Fred', 'Google US English', 'Microsoft Guy', 'Microsoft David', 'Arthur', 'Samantha'], pick = null;
      for (var i = 0; i < pref.length && !pick; i++) pick = vs.filter(function (v) { return v.name.indexOf(pref[i]) >= 0; })[0] || null;
      pick = pick || vs.filter(function (v) { return /en-US/i.test(v.lang); })[0] || vs[0];
      if (pick) u.voice = pick;
      u.rate = 1.06; u.pitch = 0.92; u.volume = 0.95;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* ---------- small UI helpers ---------- */
  var toastTimer;
  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1900);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  function chipHTML(amount, cls) {
    var col = chipColor(amount);
    return '<span class="chipmark ' + (cls || '') + '" style="background:' + col[0] + ';color:' + col[1] + '">' + chipText(amount) + '</span>';
  }
  function cardHTML(c, cls) {
    if (!c) return '<div class="card back ' + (cls || '') + '"></div>';
    var red = isRed(c), ch = SUIT_CH[c.s];
    return '<div class="card ' + (red ? 'red ' : '') + (cls || '') + '"><span class="r">' + c.r + '<i>' + ch + '</i></span>'
      + '<span class="big">' + ch + '</span><span class="r rb">' + c.r + '<i>' + ch + '</i></span></div>';
  }
  function renderChips(el, selected, onPick) {
    el.innerHTML = CHIPS.map(function (d) {
      var c = d * 100;
      return '<button class="chip c' + d + '" data-chip="' + c + '" aria-pressed="' + (selected === c) + '" aria-label="$' + d + ' chip">' + chipText(c) + '</button>';
    }).join('');
    el.onclick = function (e) { var b = e.target.closest('[data-chip]'); if (b) onPick(+b.dataset.chip); };
  }
  function nav(active) {
    var pages = [['index.html', 'Craps'], ['blackjack.html', 'Blackjack'], ['baccarat.html', 'Baccarat']];
    return '<nav class="games">' + pages.map(function (p) {
      return '<a href="' + p[0] + '"' + (p[1].toLowerCase() === active ? ' class="on" aria-current="page"' : '') + '>' + p[1] + '</a>';
    }).join('') + '</nav>';
  }

  var api = {
    ac: ac, play: play, say: say, toast: toast, esc: esc, chipHTML: chipHTML, cardHTML: cardHTML, renderChips: renderChips, nav: nav,
    KEY: KEY, START: START, CHIPS: CHIPS, RANKS: RANKS, SUITS: SUITS, SUIT_CH: SUIT_CH,
    money: money, chipText: chipText, chipColor: chipColor,
    load: load, save: save, bank: bank, addBank: addBank, setBank: setBank, game: game,
    randInt: randInt, card: card, isRed: isRed, bjValue: bjValue, bacValue: bacValue,
    newShoe: newShoe, shuffle: shuffle, draw: draw, needsShuffle: needsShuffle, remaining: remaining
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Casino = api;
})(this);
