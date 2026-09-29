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
  /* Only touch the DOM when the markup actually changed. Keeps re-renders from
     restarting animations and thrashing layout. */
  function setHTML(el, html) {
    if (!el || el.__h === html) return false;
    el.__h = html; el.__t = null;
    el.innerHTML = html;
    return true;
  }
  function setText(el, txt) {
    if (!el || el.__t === txt) return false;
    el.__t = txt; el.__h = null;
    el.textContent = txt;
    return true;
  }
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
  /* A stack of casino chips for an amount, largest denomination first. */
  function chipStackHTML(amount, cls) {
    if (!amount) return '';
    var left = amount, picks = [], i;
    for (i = CHIPS.length - 1; i >= 0 && picks.length < 5; i--) {
      var v = CHIPS[i] * 100;
      while (left >= v && picks.length < 5) { picks.push(v); left -= v; }
    }
    if (!picks.length) picks.push(100);
    var h = '<span class="chipstack ' + (cls || '') + '">';
    picks.forEach(function (v, n) {
      var col = chipColor(v);
      h += '<i style="--n:' + n + ';background:' + col[0] + ';color:' + col[1] + '"></i>';
    });
    h += '<b>' + money(amount) + '</b></span>';
    return h;
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
  /* A dealing shoe and discard tray drawn in CSS. `used` is 0..1 */
  function shoeHTML(shoe, opts) {
    opts = opts || {};
    var left = Math.max(0, 1 - shoe.pos / shoe.cards.length);
    var stack = Math.max(1, Math.round(left * 20));
    var h = '<div class="shoebox" title="' + remaining(shoe) + ' cards left"><div class="body"></div><div class="well"><div class="shoe-stack">';
    for (var i = 0; i < stack; i++) h += '<i style="--i:' + i + '"></i>';
    h += '</div></div><div class="mouth"></div><span class="shoe-label">' + (opts.label || (shoe.decks + ' decks')) + '</span></div>';
    return h;
  }
  function discardHTML(shoe) {
    var stack = Math.max(0, Math.round(shoe.pos / shoe.cards.length * 20));
    var h = '<div class="discard" title="' + shoe.pos + ' cards used"><div class="tray"><div class="disc-stack">';
    for (var i = 0; i < stack; i++) h += '<i style="--i:' + i + '"></i>';
    h += '</div></div><span class="shoe-label">Discards</span></div>';
    return h;
  }

  /* An illustrated dealer in a small studio: red curtain, spotlight, and a croupier
     who breathes, blinks and reaches out when cards come off the shoe. */
  function dealerHTML(name) {
    var folds = '';
    for (var x = 0; x < 300; x += 12) folds += '<rect x="' + x + '" y="0" width="5" height="170" fill="rgba(0,0,0,.22)"/>';
    return '<div class="dealer-stage">'
      + '<svg class="dealer-svg" viewBox="0 0 300 170" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'
      + '<defs>'
      + '<linearGradient id="dl-curtain" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a161a"/><stop offset="1" stop-color="#2a0608"/></linearGradient>'
      + '<radialGradient id="dl-spot" cx="50%" cy="4%" r="72%"><stop offset="0" stop-color="rgba(255,228,175,.5)"/><stop offset="1" stop-color="rgba(255,228,175,0)"/></radialGradient>'
      + '<linearGradient id="dl-shirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdfbf5"/><stop offset="1" stop-color="#ddd7c9"/></linearGradient>'
      + '<linearGradient id="dl-vest" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2f38"/><stop offset="1" stop-color="#15181d"/></linearGradient>'
      + '<linearGradient id="dl-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d2317"/><stop offset="1" stop-color="#1b0e08"/></linearGradient>'
      + '</defs>'
      + '<rect width="300" height="170" fill="url(#dl-curtain)"/>'
      + '<g opacity=".5">' + folds + '</g>'
      + '<rect width="300" height="170" fill="url(#dl-spot)"/>'
      + '<g class="dl-fig">'
      // arms in shirt sleeves, hands resting on the table
      + '<g class="dl-arm dl-arm-l">'
      + '<path d="M122,96 C100,104 86,122 82,146 l22,6 C110,130 118,118 134,110 Z" fill="url(#dl-shirt)" stroke="rgba(0,0,0,.18)" stroke-width="1"/>'
      + '<ellipse cx="92" cy="150" rx="14" ry="8" fill="#e3b78f"/></g>'
      + '<g class="dl-arm dl-arm-r">'
      + '<path d="M178,96 C200,104 214,122 218,146 l-22,6 C190,130 182,118 166,110 Z" fill="url(#dl-shirt)" stroke="rgba(0,0,0,.18)" stroke-width="1"/>'
      + '<ellipse cx="208" cy="150" rx="14" ry="8" fill="#e3b78f"/></g>'
      + '<g class="dl-body">'
      // torso: dark vest with a white shirt V and tie
      + '<path d="M150,76 C118,82 106,104 102,152 h96 C194,104 182,82 150,76 Z" fill="url(#dl-vest)"/>'
      + '<path d="M150,80 l-15,13 15,45 15,-45 Z" fill="url(#dl-shirt)"/>'
      + '<path d="M150,86 l8,7 -8,34 -8,-34 Z" fill="#8f1d22"/>'
      + '<path d="M137,78 l13,11 13,-11 -6,-4 -7,6 -7,-6 Z" fill="#fff"/>'
      + '<rect x="142" y="58" width="16" height="20" rx="7" fill="#d8a37b"/>'
      + '<g class="dl-head">'
      + '<ellipse cx="150" cy="44" rx="20" ry="24" fill="#e8bb92"/>'
      + '<ellipse cx="130" cy="46" rx="3.4" ry="5" fill="#dca87f"/><ellipse cx="170" cy="46" rx="3.4" ry="5" fill="#dca87f"/>'
      + '<path d="M130,40 C130,19 170,19 170,40 C168,31 162,25 150,25 C138,25 132,31 130,40 Z" fill="#33251c"/>'
      + '<path d="M131,38 C136,30 143,27 150,27 C158,27 165,31 169,38 C163,33 157,31 150,31 C142,31 136,33 131,38 Z" fill="#433124"/>'
      + '<g class="dl-eyes">'
      + '<ellipse cx="142" cy="45" rx="3.8" ry="2.5" fill="#fff"/><circle cx="142" cy="45" r="1.5" fill="#33261b"/>'
      + '<ellipse cx="158" cy="45" rx="3.8" ry="2.5" fill="#fff"/><circle cx="158" cy="45" r="1.5" fill="#33261b"/>'
      + '<rect class="dl-lid" x="137.8" y="39.5" width="8.4" height="6" fill="#e8bb92"/>'
      + '<rect class="dl-lid" x="153.8" y="39.5" width="8.4" height="6" fill="#e8bb92"/>'
      + '</g>'
      + '<path d="M138,39.5 q4,-2.5 8,0" stroke="#33251c" stroke-width="1.5" fill="none" stroke-linecap="round"/>'
      + '<path d="M154,39.5 q4,-2.5 8,0" stroke="#33251c" stroke-width="1.5" fill="none" stroke-linecap="round"/>'
      + '<path d="M145,55 q5,3.5 10,0" stroke="#a9694f" stroke-width="1.7" fill="none" stroke-linecap="round"/>'
      + '</g></g></g>'
      + '<rect y="150" width="300" height="20" fill="url(#dl-wood)"/>'
      + '<rect y="148" width="300" height="3" fill="rgba(242,199,92,.55)"/>'
      + '</svg>'
      + '<span class="dl-name">' + esc(name || 'Dealer') + '</span>'
      + '<div class="dl-bubble" id="dlBubble"></div>'
      + '</div>';
  }
  var dealerTimer = null;
  var dealer = {
    mount: function (el, name) { if (el) el.innerHTML = dealerHTML(name); },
    state: function (s) {
      var stage = document.querySelector('.dealer-stage');
      if (!stage) return;
      stage.classList.remove('is-dealing', 'is-win', 'is-lose');
      if (s && s !== 'idle') stage.classList.add('is-' + s);
      clearTimeout(dealerTimer);
      dealerTimer = setTimeout(function () { stage.classList.remove('is-dealing', 'is-win', 'is-lose'); }, s === 'dealing' ? 700 : 1800);
    },
    speak: function (text, quiet) {
      var el = document.getElementById('dlBubble');
      if (el) {
        el.textContent = text;
        el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
      }
      if (!quiet) say(text);
    }
  };

  /* Big gold win banner, like the ones on live tables. */
  function winBanner(host, amount) {
    if (!host) return;
    var el = document.createElement('div');
    el.className = 'winbanner';
    el.innerHTML = '<span class="wb-lbl">YOU WIN</span><span class="wb-amt">' + money(amount) + '</span>'
      + '<i class="spark s1"></i><i class="spark s2"></i><i class="spark s3"></i><i class="spark s4"></i>';
    host.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, 1700);
    setTimeout(function () { el.remove(); }, 2300);
  }

  function nav(active) {
    var pages = [['index.html', 'Craps'], ['blackjack.html', 'Blackjack'], ['baccarat.html', 'Baccarat']];
    return '<nav class="games">' + pages.map(function (p) {
      return '<a href="' + p[0] + '"' + (p[1].toLowerCase() === active ? ' class="on" aria-current="page"' : '') + '>' + p[1] + '</a>';
    }).join('') + '</nav>';
  }

  var api = {
    ac: ac, play: play, say: say, toast: toast, esc: esc, setHTML: setHTML, setText: setText, chipHTML: chipHTML, cardHTML: cardHTML, renderChips: renderChips, nav: nav,
    shoeHTML: shoeHTML, discardHTML: discardHTML, chipStackHTML: chipStackHTML, dealerHTML: dealerHTML, dealer: dealer, winBanner: winBanner,
    KEY: KEY, START: START, CHIPS: CHIPS, RANKS: RANKS, SUITS: SUITS, SUIT_CH: SUIT_CH,
    money: money, chipText: chipText, chipColor: chipColor,
    load: load, save: save, bank: bank, addBank: addBank, setBank: setBank, game: game,
    randInt: randInt, card: card, isRed: isRed, bjValue: bjValue, bacValue: bacValue,
    newShoe: newShoe, shuffle: shuffle, draw: draw, needsShuffle: needsShuffle, remaining: remaining
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Casino = api;
})(this);
