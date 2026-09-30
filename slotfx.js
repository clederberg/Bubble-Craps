/* Slot machine sound, synthesized on the fly with the Web Audio API.
   No samples, no files: every cue here is built from oscillators and noise.
   Uses the shared audio context from Casino.ac() and the shared audio toggle. */
(function (root) {
  'use strict';
  var K = root.Casino;
  var master = null, noiseBuf = null, ctx = null;

  function on() {
    try { return !!(K && K.load && K.load().sound); } catch (e) { return false; }
  }
  function ac() {
    try {
      var a = K && K.ac ? K.ac() : null;
      if (!a) return null;
      if (a !== ctx) { ctx = a; master = null; }
      if (!master) {
        master = a.createGain();
        master.gain.value = 0.34;
        master.connect(a.destination);
      }
      return a;
    } catch (e) { return null; }
  }
  function now(a) { return a.currentTime; }
  function noise(a) {
    if (noiseBuf && noiseBuf.sampleRate === a.sampleRate) return noiseBuf;
    var n = Math.floor(a.sampleRate * 1.2), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    noiseBuf = b;
    return b;
  }

  /* one oscillator with an attack/decay envelope, optionally sliding in pitch */
  function tone(opt) {
    var a = ac(); if (!a || !on()) return null;
    var t = (opt.at || 0) + now(a);
    var o = a.createOscillator(), g = a.createGain();
    o.type = opt.type || 'sine';
    o.frequency.setValueAtTime(opt.f, t);
    if (opt.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opt.to), t + (opt.dur || 0.2));
    var peak = opt.gain === undefined ? 0.3 : opt.gain;
    var atk = opt.atk === undefined ? 0.004 : opt.atk;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (opt.dur || 0.2));
    var tail = g;
    if (opt.filter) {
      var f = a.createBiquadFilter();
      f.type = opt.filter; f.frequency.value = opt.ff || 1200; f.Q.value = opt.q || 1;
      g.connect(f); tail = f;
    }
    o.connect(g); tail.connect(master);
    o.start(t); o.stop(t + (opt.dur || 0.2) + 0.05);
    return o;
  }
  /* a burst of filtered noise: clicks, whooshes, sizzles, rumbles */
  function hiss(opt) {
    var a = ac(); if (!a || !on()) return null;
    var t = (opt.at || 0) + now(a);
    var s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
    s.buffer = noise(a); s.loop = true;
    f.type = opt.filter || 'bandpass';
    f.frequency.setValueAtTime(opt.f || 1000, t);
    if (opt.to) f.frequency.exponentialRampToValueAtTime(Math.max(40, opt.to), t + (opt.dur || 0.2));
    f.Q.value = opt.q === undefined ? 1 : opt.q;
    var peak = opt.gain === undefined ? 0.2 : opt.gain;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + (opt.atk === undefined ? 0.01 : opt.atk));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (opt.dur || 0.2));
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + (opt.dur || 0.2) + 0.05);
    return s;
  }
  /* a struck bell: a partial stack that rings and fades */
  function bell(f, dur, gain, at) {
    tone({ f: f, dur: dur, gain: gain, type: 'sine', at: at, atk: 0.002 });
    tone({ f: f * 2.76, dur: dur * 0.6, gain: gain * 0.35, type: 'sine', at: at, atk: 0.002 });
    tone({ f: f * 5.4, dur: dur * 0.3, gain: gain * 0.15, type: 'sine', at: at, atk: 0.002 });
  }

  var PENT = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];
  function semis(base, n) { return base * Math.pow(2, n / 12); }

  var anticipating = null;

  var FX = {
    /* --- reels --- */
    tick: function () {
      tone({ f: 2100, dur: 0.022, gain: 0.05, type: 'square' });
      hiss({ f: 3200, dur: 0.018, gain: 0.05, q: 2 });
    },
    reelStop: function (i) {
      var f = 168 - (i || 0) * 16;
      tone({ f: f, to: f * 0.55, dur: 0.16, gain: 0.34, type: 'sine' });
      tone({ f: f * 3.1, dur: 0.05, gain: 0.08, type: 'triangle' });
      hiss({ f: 900, to: 300, dur: 0.07, gain: 0.12, q: 0.8 });
    },
    /* the last reel teasing a feature: a rising, wobbling tone until it stops */
    anticipate: function (seconds) {
      var a = ac(); if (!a || !on()) return;
      FX.stopAnticipate();
      var t = now(a), dur = seconds || 1.4;
      var o = a.createOscillator(), g = a.createGain(), lfo = a.createOscillator(), lg = a.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(240, t);
      o.frequency.exponentialRampToValueAtTime(1150, t + dur);
      var f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 6;
      f.frequency.setValueAtTime(400, t);
      f.frequency.exponentialRampToValueAtTime(2200, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.12);
      lfo.type = 'sine'; lfo.frequency.setValueAtTime(9, t);
      lfo.frequency.linearRampToValueAtTime(22, t + dur);
      lg.gain.value = 0.09;
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t); lfo.start(t);
      anticipating = { o: o, lfo: lfo, g: g };
      o.stop(t + dur + 0.4); lfo.stop(t + dur + 0.4);
    },
    stopAnticipate: function () {
      var a = ac(); if (!a || !anticipating) return;
      try {
        var t = now(a);
        anticipating.g.gain.cancelScheduledValues(t);
        anticipating.g.gain.setValueAtTime(anticipating.g.gain.value || 0.0001, t);
        anticipating.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
        anticipating.o.stop(t + 0.12); anticipating.lfo.stop(t + 0.12);
      } catch (e) {}
      anticipating = null;
    },
    /* --- wins: a run of coins, longer and higher the bigger the win --- */
    coinRun: function (ratio) {
      var a = ac(); if (!a || !on()) return 0;
      var r = Math.max(0, ratio || 0);
      var n = Math.max(3, Math.min(16, Math.round(3 + Math.log(1 + r * 4) * 3.2)));
      var gap = r > 8 ? 0.075 : 0.095;
      for (var i = 0; i < n; i++) {
        var f = semis(523.25, PENT[Math.min(PENT.length - 1, i)]);
        bell(f, 0.3, 0.16, i * gap);
        hiss({ f: 5200, dur: 0.02, gain: 0.05, q: 3, at: i * gap });
      }
      return n * gap;
    },
    /* --- hold and spin --- */
    candle: function (n) {
      var step = PENT[Math.min(PENT.length - 1, (n || 0) % PENT.length)];
      bell(semis(659.25, step), 0.44, 0.22);
      hiss({ f: 2600, to: 5200, dur: 0.12, gain: 0.05, q: 2 });
    },
    jackpot: function (tier) {
      var big = tier === 'grand' || tier === 'major';
      var notes = big ? [0, 4, 7, 12, 16, 19, 24, 28] : [0, 4, 7, 12, 16];
      for (var i = 0; i < notes.length; i++) {
        bell(semis(523.25, notes[i]), big ? 0.7 : 0.45, 0.24, i * 0.085);
      }
      tone({ f: 130.81, dur: big ? 1.2 : 0.7, gain: 0.18, type: 'triangle' });
      tone({ f: 196, dur: big ? 1.2 : 0.7, gain: 0.14, type: 'triangle' });
      if (big) hiss({ f: 600, to: 6000, dur: 0.8, gain: 0.08, q: 0.7 });
    },
    /* --- latke round --- */
    whoosh: function () { hiss({ f: 380, to: 2600, dur: 0.26, gain: 0.14, q: 0.9 }); },
    sizzle: function () {
      hiss({ filter: 'highpass', f: 2400, dur: 0.55, gain: 0.14, q: 0.5, atk: 0.04 });
      tone({ f: 420, to: 260, dur: 0.14, gain: 0.12, type: 'triangle' });
    },
    thud: function () {
      tone({ f: 96, to: 62, dur: 0.22, gain: 0.32, type: 'sine' });
      hiss({ f: 380, to: 140, dur: 0.14, gain: 0.12, q: 0.7 });
    },
    /* --- free games --- */
    arkOpen: function () {
      hiss({ filter: 'lowpass', f: 90, to: 260, dur: 1.5, gain: 0.3, q: 0.4, atk: 0.5 });
      tone({ f: 48, to: 72, dur: 1.6, gain: 0.22, type: 'sine', atk: 0.4 });
      tone({ f: 98, dur: 1.2, gain: 0.08, type: 'triangle', at: 0.3, atk: 0.3 });
    },
    scroll: function () {
      hiss({ filter: 'bandpass', f: 1500, to: 900, dur: 0.6, gain: 0.1, q: 0.8, atk: 0.12 });
      tone({ f: 190, dur: 0.1, gain: 0.14, type: 'triangle', at: 0.55 });
    },
    reveal: function () {
      for (var i = 0; i < 4; i++) bell(semis(783.99, [0, 5, 9, 12][i]), 0.6, 0.2, i * 0.07);
      hiss({ f: 900, to: 7000, dur: 0.5, gain: 0.07, q: 0.6 });
    },
    /* --- pinball --- */
    ratchet: function () {
      var a = ac(); if (!a || !on()) return;
      for (var i = 0, t = 0; i < 11; i++) {
        tone({ f: 1500 - i * 40, dur: 0.02, gain: 0.12, type: 'square', at: t });
        t += 0.018 + i * 0.006;
      }
      tone({ f: 140, to: 90, dur: 0.18, gain: 0.26, type: 'sine', at: 0.22 });
    },
    bumper: function () {
      tone({ f: 880, to: 620, dur: 0.1, gain: 0.2, type: 'sine' });
      hiss({ f: 3400, dur: 0.03, gain: 0.07, q: 3 });
    },
    pocket: function () {
      bell(659.25, 0.5, 0.22);
      bell(987.77, 0.5, 0.18, 0.1);
    }
  };

  /* Nothing in here may ever break a spin: wrap every cue. */
  Object.keys(FX).forEach(function (k) {
    var fn = FX[k];
    FX[k] = function () { try { return fn.apply(null, arguments); } catch (e) { return null; } };
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = FX;
  else root.SlotFX = FX;
})(typeof window !== 'undefined' ? window : this);
