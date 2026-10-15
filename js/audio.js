// All sound is synthesised with Web Audio — no files to load.
//
// Graph: effects bus + music bus → (dry + a shared stone-room reverb) → master → gentle compressor → speakers.
// The séance score is adaptive: setIntensity() feeds it the wrath, offenses and time left, and layers join
// as it rises — heartbeat, trembling strings, a choir, a ticking clock, and booms in the final seconds.
(function (G) {
  'use strict';

  const D3 = 146.83;
  const st = (n) => D3 * Math.pow(2, n / 12); // semitones from D3
  // Chords as semitones from D3. Calm: Dm – B♭ – Gm – A. Tense: Dm – E♭ (a half-step that never resolves).
  const PROG_CALM = [[0, 3, 7], [-4, 0, 3], [-7, -4, 0], [-5, -1, 2]];
  const PROG_TENSE = [[0, 3, 7], [1, 5, 8], [0, 3, 7], [1, 4, 7]];
  const PROG_FINAL = [[0, 3, 6], [1, 4, 7]];
  const SCALE = [0, 2, 3, 5, 7, 8, 11]; // D harmonic minor
  const STINGERS = [0.5, 0.75, 0.9];
  const LOOKAHEAD = 1.2; // seconds scheduled ahead (background tabs only wake once a second)

  const loadVol = (k, d) => { try { const v = parseFloat(localStorage.getItem('grimoire.vol.' + k)); return Number.isFinite(v) ? v : d; } catch (e) { return d; } };
  const saveVol = (k, v) => { try { localStorage.setItem('grimoire.vol.' + k, String(v)); } catch (e) { /* private mode */ } };

  class Sound {
    constructor() {
      this.ctx = null;
      this.vol = { music: loadVol('music', 0.6), sfx: loadVol('sfx', 0.8) };
      this.mus = null;          // the running score, if any
      this.I = 0;               // smoothed intensity 0..1
      this.state = { wrath: 0, strikes: 0, remaining: Infinity };
      this.passed = new Set();  // wrath stingers already played this séance
      this.k = 1;               // loudness multiplier for tone()/noise() (see BOOST)
    }

    // ---- Setup ----------------------------------------------------------------
    unlock() {
      try {
        if (!this.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          this.attach(new AC());
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) { /* no audio, the game still works */ }
    }

    // Build the graph on any context (an OfflineAudioContext works too, for tests).
    attach(ctx) {
      this.ctx = ctx;
      this.offline = typeof ctx.startRendering === 'function';
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      comp.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(comp);

      this.verb = ctx.createConvolver();
      this.verb.buffer = this.impulse(3.2);
      this.verb.connect(this.master);

      this.sfx = ctx.createGain();
      this.sfx.gain.value = this.vol.sfx;
      this.sfx.connect(this.master);
      const sfxSend = ctx.createGain();
      sfxSend.gain.value = 0.22;
      this.sfx.connect(sfxSend).connect(this.verb);

      this.music = ctx.createGain();
      this.music.gain.value = this.vol.music * 0.8;
      this.music.connect(this.master);
      const musSend = ctx.createGain();
      musSend.gain.value = 0.55;
      this.music.connect(musSend).connect(this.verb);

      this.out = this.sfx;
      const len = ctx.sampleRate * 2;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }

    // A stone room: decaying stereo noise with a darker tail.
    impulse(sec) {
      const rate = this.ctx.sampleRate, len = Math.floor(rate * sec);
      const buf = this.ctx.createBuffer(2, len, rate);
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        let lp = 0;
        for (let i = 0; i < len; i++) {
          const k = i / len;
          lp += ((Math.random() * 2 - 1) - lp) * (0.6 - 0.45 * k);
          d[i] = lp * Math.pow(1 - k, 2.6) * (i < rate * 0.01 ? i / (rate * 0.01) : 1);
        }
      }
      return buf;
    }

    setVolume(kind, v) {
      v = Math.max(0, Math.min(1, v));
      this.vol[kind] = v;
      saveVol(kind, v);
      if (!this.ctx) return;
      const node = kind === 'music' ? this.music : this.sfx;
      node.gain.setTargetAtTime(kind === 'music' ? v * 0.8 : v, this.ctx.currentTime, 0.05);
    }

    // ---- Building blocks ------------------------------------------------------
    // `when` is an absolute time (for the score); otherwise `at` seconds from now.
    tone(freq, { type = 'sine', dur = 0.4, vol = 0.2, at = 0, when, attack = 0.006, slide = null, dest } = {}) {
      if (!this.ctx) return;
      const t = when != null ? when : this.ctx.currentTime + at;
      vol *= this.k;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(dest || this.sfx);
      o.start(t);
      o.stop(t + dur + 0.05);
    }

    noise(dur, { vol = 0.2, freq = 1000, q = 1, at = 0, when, type = 'bandpass', sweep = null, attack = 0.02, dest } = {}) {
      if (!this.ctx) return;
      const t = when != null ? when : this.ctx.currentTime + at;
      vol *= this.k;
      const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      src.buffer = this.noiseBuf;
      f.type = type;
      f.frequency.setValueAtTime(freq, t);
      if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
      f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(dest || this.sfx);
      src.start(t, Math.random());
      src.stop(t + dur + 0.05);
    }

    // A sustained voice with a soft attack and release, optionally through a filter or two (formants).
    voice(freq, when, dur, { type = 'sine', vol = 0.05, attack = 0.6, release = 1.2, detune = 0, filters = [], dest } = {}) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = detune;
      let node = o;
      for (const [kind, f, q] of filters) {
        const b = this.ctx.createBiquadFilter();
        b.type = kind;
        b.frequency.value = f;
        b.Q.value = q || 1;
        node.connect(b);
        node = b;
      }
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(vol, when + attack);
      g.gain.setValueAtTime(vol, when + Math.max(attack, dur - release));
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      node.connect(g).connect(dest || this.music);
      o.start(when);
      o.stop(when + dur + 0.1);
    }

    // A bell or music-box tine: inharmonic partials, long decay.
    tine(freq, when, vol, dest) {
      [[1, 1], [2.01, 0.35], [3.98, 0.12], [5.4, 0.05]].forEach(([m, v]) => this.tone(freq * m, { when, dur: 2.2 / Math.sqrt(m), vol: vol * v, attack: 0.004, dest }));
    }

    // ---- Effects (names kept: the relics call these) --------------------------
    note(i) {
      if (!this.ctx) return;
      const f = [523.25, 622.25, 783.99, 932.33][i] || 440;
      this.tine(f, this.ctx.currentTime, 0.16);
    }

    scrape() { this.noise(0.22, { vol: 0.09, freq: 2600, q: 0.8, sweep: 1800 }); }

    // An offense: a hollow impact, a dissonant swell and a scream that falls away.
    strike() {
      if (!this.ctx) return;
      this.tone(130, { dur: 0.9, vol: 0.6, slide: 38 });
      this.noise(0.5, { vol: 0.5, freq: 900, type: 'lowpass', sweep: 120 });
      [146.83, 207.65, 155.56].forEach((f) => this.tone(f, { type: 'sawtooth', dur: 1.1, vol: 0.08, attack: 0.08, slide: f * 0.8 }));
      this.noise(0.9, { vol: 0.2, freq: 1400, q: 6, sweep: 500, attack: 0.05, at: 0.05 });
      this.whisper(0.6);
    }

    // A relic is cleansed: a rising chime and a sigh of relief.
    solve() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      [587.33, 739.99, 880, 1174.66].forEach((f, k) => this.tine(f, t + k * 0.09, 0.09));
      this.noise(1.4, { vol: 0.07, freq: 3200, q: 1.5, sweep: 600, attack: 0.15 });
    }

    // The doll (or a stinger) whispers: breathy sibilants and a falling hum.
    whisper(level = 1) {
      for (let k = 0; k < 6; k++) this.noise(0.16, { vol: 0.09 * level, freq: 3000 + Math.random() * 2400, q: 5, at: k * 0.15 });
      this.tone(740, { dur: 1.4, vol: 0.03 * level, slide: 370, at: 0.1 });
    }

    hush() {
      this.tone(659.25, { dur: 0.9, vol: 0.06 });
      this.tone(523.25, { dur: 1.2, vol: 0.05, at: 0.14 });
      this.noise(0.9, { vol: 0.03, freq: 2400, q: 1, sweep: 700, attack: 0.1 });
    }

    tick() { this.tone(1400, { type: 'triangle', dur: 0.06, vol: 0.09 }); }

    // Dull knocks on old wood, n in a row.
    knock(n = 1) {
      for (let k = 0; k < n; k++) {
        this.tone(95, { dur: 0.14, vol: 0.32, at: k * 0.32, slide: 70 });
        this.noise(0.09, { vol: 0.2, freq: 420, q: 1.2, at: k * 0.32 });
      }
    }

    bell(vol = 1) {
      [[880, 0.12], [1320 * 1.01, 0.06], [2210, 0.035], [3010, 0.02]].forEach(([f, v]) => this.tone(f, { dur: 1.8, vol: v * vol }));
    }

    // A hoarse caw: a falling rasp through a throat-like filter, twice as loud when angry.
    caw(angry = false) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      for (const [a, b, d] of [[760, 430, 0], [1520, 860, 0.004]]) {
        const o = this.ctx.createOscillator(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(a, t + d);
        o.frequency.exponentialRampToValueAtTime(b, t + d + 0.3);
        f.type = 'bandpass';
        f.frequency.value = 1150;
        f.Q.value = 3.5;
        g.gain.setValueAtTime(0.0001, t + d);
        g.gain.exponentialRampToValueAtTime(angry ? 0.6 : 0.42, t + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.32);
        o.connect(f).connect(g).connect(this.sfx);
        o.start(t + d);
        o.stop(t + d + 0.35);
      }
      this.noise(0.28, { vol: 0.3, freq: 1800, q: 2, sweep: 900, attack: 0.01 });
    }

    // ---- Relic sounds -----------------------------------------------------------
    // Candles: pinched out with a hiss of smoke; or flaring up angrily.
    pinch() {
      this.noise(0.07, { vol: 0.16, freq: 2400, type: 'highpass', attack: 0.004 });
      this.noise(1.3, { vol: 0.05, freq: 1300, q: 1.2, sweep: 380, attack: 0.08, at: 0.05 });
      this.tone(330, { type: 'triangle', dur: 0.12, vol: 0.03, slide: 160 });
    }

    flare() {
      this.noise(0.7, { vol: 0.28, freq: 500, q: 0.8, sweep: 3200, attack: 0.03 });
      this.tone(80, { dur: 0.6, vol: 0.18, slide: 55 });
    }

    // Tarot: a card catching fire and crackling away.
    burn() {
      if (!this.ctx) return;
      this.noise(1.2, { vol: 0.16, freq: 300, type: 'lowpass', sweep: 2200, attack: 0.15 });
      for (let k = 0; k < 26; k++) this.noise(0.02 + Math.random() * 0.04, { vol: 0.05 + Math.random() * 0.09, freq: 2500 + Math.random() * 4000, type: 'highpass', attack: 0.002, at: 0.1 + Math.random() * 1.3 });
    }

    cardFlick() {
      this.noise(0.08, { vol: 0.12, freq: 2600, q: 1.5, attack: 0.004 });
      this.noise(0.06, { vol: 0.08, freq: 1200, q: 1.5, attack: 0.004, at: 0.07 });
    }

    // Spirit Board: the planchette sliding over wood, and a firm tap on an answer.
    glide() { this.noise(0.5, { vol: 0.08, freq: 380, q: 0.7, sweep: 520, attack: 0.12 }); }

    woodTap() {
      this.tone(185, { type: 'triangle', dur: 0.09, vol: 0.2, slide: 140 });
      this.noise(0.05, { vol: 0.12, freq: 900, q: 1.5, attack: 0.002 });
    }

    // Music box: winding the crank.
    ratchet() {
      for (let k = 0; k < 9; k++) {
        this.noise(0.016, { vol: 0.11, freq: 3200, type: 'highpass', attack: 0.002, at: k * 0.065 });
        this.tone(2300 + (k % 2) * 300, { type: 'square', dur: 0.012, vol: 0.012, attack: 0.001, at: k * 0.065 });
      }
    }

    // Locked Diary: dial detents, a rattle on the wrong code, a heavy latch on the right one.
    dialClick() {
      this.noise(0.022, { vol: 0.16, freq: 3300, q: 8, attack: 0.001 });
      this.tone(1750, { type: 'square', dur: 0.014, vol: 0.025, attack: 0.001 });
    }

    lockRattle() {
      for (let k = 0; k < 3; k++) {
        this.tone(880 + k * 90, { type: 'square', dur: 0.035, vol: 0.04, attack: 0.002, at: k * 0.075 });
        this.noise(0.04, { vol: 0.12, freq: 2600, q: 4, attack: 0.002, at: k * 0.075 });
      }
    }

    latch() {
      this.tone(140, { dur: 0.14, vol: 0.32, slide: 90, attack: 0.003 });
      this.noise(0.1, { vol: 0.2, freq: 800, type: 'lowpass', attack: 0.003 });
      this.tone(2400, { dur: 0.5, vol: 0.03, attack: 0.002 });
      this.tone(92, { dur: 0.22, vol: 0.25, slide: 70, at: 0.18 });
      this.pageTurn();
    }

    // Haunted Mirror: a clear chime, or the glass splintering.
    glassChime() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.tine(1567.98, t, 0.08);
      this.tine(2093, t + 0.07, 0.06);
      this.noise(0.5, { vol: 0.03, freq: 7000, type: 'highpass', attack: 0.05 });
    }

    glassCrack() {
      for (let k = 0; k < 7; k++) this.noise(0.03 + Math.random() * 0.05, { vol: 0.14, freq: 3500 + Math.random() * 4500, q: 5, attack: 0.001, at: Math.random() * 0.28 });
      this.tone(3100, { type: 'triangle', dur: 0.25, vol: 0.03, attack: 0.001, slide: 2600 });
      this.tone(120, { dur: 0.15, vol: 0.15, slide: 80 });
    }

    // Weathered Headstone: a chisel biting stone.
    chisel() {
      this.tone(2650, { type: 'square', dur: 0.018, vol: 0.04, attack: 0.001 });
      this.noise(0.06, { vol: 0.18, freq: 4200, q: 3, attack: 0.001 });
      this.noise(0.25, { vol: 0.06, freq: 1500, q: 1, sweep: 900, attack: 0.01, at: 0.03 });
    }

    // Crystal Ball: a glassy hum as the mist changes colour; a stone click on a rune.
    crystalHum(i = 0) {
      const f = [659.25, 880, 987.77, 1318.5, 1174.66][i % 5];
      this.tone(f, { dur: 1.3, vol: 0.022, attack: 0.35 });
      this.tone(f * 1.006, { dur: 1.3, vol: 0.016, attack: 0.4 });
      this.tone(f * 2, { dur: 0.9, vol: 0.006, attack: 0.3 });
    }

    stoneClick() {
      this.tone(620, { type: 'triangle', dur: 0.05, vol: 0.12, attack: 0.002 });
      this.noise(0.035, { vol: 0.1, freq: 2100, q: 2, attack: 0.001 });
    }

    // The Raven: wings beating as it takes the offering.
    wings() {
      for (let k = 0; k < 6; k++) this.noise(0.1, { vol: 0.16 - k * 0.02, freq: 420, q: 0.9, sweep: 950, attack: 0.02, at: k * 0.11 });
    }

    // Palm Reading: a soft press on skin.
    skinTap() {
      this.tone(110, { dur: 0.1, vol: 0.2, slide: 78, attack: 0.004 });
      this.noise(0.05, { vol: 0.06, freq: 300, type: 'lowpass', attack: 0.003 });
    }

    // Gramophone: switches, the needle catching, and a crackly old tune.
    mechClick() {
      this.noise(0.02, { vol: 0.12, freq: 2600, type: 'highpass', attack: 0.001 });
      this.tone(1180, { type: 'square', dur: 0.012, vol: 0.025, attack: 0.001 });
    }

    needleScratch() {
      this.noise(0.32, { vol: 0.22, freq: 3200, q: 2, sweep: 600, attack: 0.005 });
      this.noise(0.2, { vol: 0.16, freq: 700, q: 2, sweep: 2600, attack: 0.005, at: 0.3 });
    }

    phonograph() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      for (let k = 0; k < 40; k++) this.noise(0.012, { vol: 0.03 + Math.random() * 0.05, freq: 3000 + Math.random() * 3000, type: 'highpass', attack: 0.001, at: Math.random() * 3 });
      this.noise(3, { vol: 0.02, freq: 1200, q: 0.5, attack: 0.2 });
      const tune = [587.33, 698.46, 880, 783.99, 698.46, 659.25, 587.33];
      tune.forEach((f, k) => {
        const o = this.ctx.createOscillator(), b = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
        const w = t + 0.25 + k * 0.32;
        o.type = 'square';
        o.frequency.value = f;
        b.type = 'bandpass';
        b.frequency.value = 1400;
        b.Q.value = 1.2;
        g.gain.setValueAtTime(0.0001, w);
        g.gain.exponentialRampToValueAtTime(0.05, w + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, w + 0.42);
        o.connect(b).connect(g).connect(this.sfx);
        o.start(w);
        o.stop(w + 0.45);
      });
    }

    // Pendulum: the chain swishing as it is caught.
    swish() { this.noise(0.3, { vol: 0.08, freq: 700, q: 1.2, sweep: 1700, attack: 0.05 }); }

    // Knucklebones: bones clattering on the table.
    boneClatter() {
      for (let k = 0; k < 6; k++) {
        const at = k * 0.05 + Math.random() * 0.04;
        this.tone(900 + Math.random() * 600, { type: 'triangle', dur: 0.035, vol: 0.06, attack: 0.001, at });
        this.noise(0.03, { vol: 0.08, freq: 2400, q: 3, attack: 0.001, at });
      }
    }

    // Salt Circle: a thin stream of salt; or the whole circle scattering.
    saltPour() {
      for (let k = 0; k < 32; k++) this.noise(0.008, { vol: 0.03 + Math.random() * 0.03, freq: 5000 + Math.random() * 3000, type: 'highpass', attack: 0.001, at: Math.random() * 0.6 });
      this.noise(0.6, { vol: 0.02, freq: 6000, type: 'highpass', attack: 0.1 });
    }

    saltScatter() {
      this.noise(0.5, { vol: 0.14, freq: 3200, type: 'highpass', attack: 0.004 });
      for (let k = 0; k < 20; k++) this.noise(0.01, { vol: 0.06, freq: 4000 + Math.random() * 4000, type: 'highpass', attack: 0.001, at: Math.random() * 0.5 });
    }

    // Apothecary: liquid poured and bubbling; or a jar clinking against the wrong one.
    pour() {
      this.noise(0.7, { vol: 0.06, freq: 900, type: 'lowpass', attack: 0.08 });
      for (let k = 0; k < 10; k++) this.tone(220 + Math.random() * 180, { dur: 0.06, vol: 0.05, attack: 0.003, slide: 600 + Math.random() * 300, at: 0.1 + Math.random() * 0.6 });
    }

    glassClink() {
      this.tone(2400, { dur: 0.4, vol: 0.05, attack: 0.001 });
      this.tone(3720, { dur: 0.28, vol: 0.03, attack: 0.001 });
      this.noise(0.4, { vol: 0.04, freq: 5000, type: 'highpass', attack: 0.05, at: 0.05 });
    }

    // A soft wooden tick for menu buttons.
    uiTap() {
      this.tone(430, { type: 'triangle', dur: 0.045, vol: 0.035, attack: 0.002 });
      this.noise(0.02, { vol: 0.02, freq: 2000, q: 2, attack: 0.001 });
    }

    creak() {
      this.tone(140, { type: 'sawtooth', dur: 1.4, vol: 0.09, slide: 210 });
      this.noise(1.2, { vol: 0.08, freq: 900, q: 6, sweep: 1400 });
    }

    flame() {
      this.noise(0.9, { vol: 0.12, freq: 1200, q: 0.4, sweep: 3000 });
      this.tone(300, { type: 'triangle', dur: 0.5, vol: 0.04, slide: 600 });
    }

    // Turning a page of the grimoire.
    pageTurn() { this.noise(0.28, { vol: 0.09, freq: 1800, q: 0.7, sweep: 4200, attack: 0.04 }); }

    // The séance begins: a match flares and a low gong sounds.
    startSeance() {
      if (!this.ctx) return;
      this.noise(0.35, { vol: 0.12, freq: 3000, type: 'highpass', attack: 0.01 });
      this.noise(0.8, { vol: 0.05, freq: 800, q: 0.6, at: 0.1 });
      [[73.42, 0.3], [146.1, 0.12], [221.5, 0.07], [302, 0.04]].forEach(([f, v]) => this.tone(f, { dur: 4, vol: v, at: 0.25, attack: 0.01 }));
    }

    // A wrath milestone: a deep boom, a rush of air and a whisper.
    stinger(level) {
      if (!this.ctx) return;
      this.tone(55, { dur: 2.5, vol: 0.35 + 0.15 * level, slide: 32 });
      this.noise(1.6, { vol: 0.08 + 0.05 * level, freq: 200, q: 0.7, sweep: 2600, attack: 1.2 });
      this.whisper(0.5 + 0.3 * level);
    }

    // Blackout curse: every flame snuffed at once, then a match relights them.
    snuff() {
      this.noise(0.6, { vol: 0.18, freq: 900, q: 0.5, sweep: 200, attack: 0.01 });
      this.tone(220, { type: 'triangle', dur: 0.5, vol: 0.05, slide: 90 });
      this.whisper(0.4);
    }

    relight() {
      this.noise(0.3, { vol: 0.1, freq: 3200, type: 'highpass', attack: 0.01 });
      this.noise(0.6, { vol: 0.04, freq: 700, q: 0.6, at: 0.08 });
    }

    // The spirit kills you: a rumble in the dark, silence, then a scream rushing at the glass,
    // a sub-bass hit and shattering, and a long dying echo.
    death() {
      if (!this.ctx) return;
      this.stopScore(0.25);
      const t = this.ctx.currentTime;
      // 0–1.6 s: the room holds its breath — a low rumble swelling under a heartbeat that stops.
      this.noise(1.6, { when: t, vol: 0.18, freq: 120, type: 'lowpass', attack: 1.2 });
      [0, 0.55].forEach((d, k) => { this.tone(58, { when: t + d, dur: 0.2, vol: 0.35 - k * 0.1, slide: 44 }); this.tone(50, { when: t + d + 0.2, dur: 0.2, vol: 0.25 - k * 0.08, slide: 40 }); });
      this.whisper(0.8);
      // 1.65 s: the scream — rising detuned saws through a vowel-like filter, with a breath of noise.
      const s = t + 1.65;
      [[310, 1250], [327, 1310], [620, 2200]].forEach(([a, b]) => {
        const o = this.ctx.createOscillator(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(a, s);
        o.frequency.exponentialRampToValueAtTime(b, s + 0.5);
        o.frequency.exponentialRampToValueAtTime(b * 0.6, s + 1.4);
        f.type = 'bandpass';
        f.frequency.setValueAtTime(900, s);
        f.frequency.exponentialRampToValueAtTime(2400, s + 0.5);
        f.Q.value = 3;
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(0.16, s + 0.12);
        g.gain.exponentialRampToValueAtTime(0.0001, s + 1.5);
        o.connect(f).connect(g).connect(this.sfx);
        o.start(s);
        o.stop(s + 1.6);
      });
      this.noise(1.2, { when: s, vol: 0.3, freq: 1600, q: 1.2, sweep: 5200, attack: 0.08 });
      // 2.15 s: impact and breaking glass.
      const c = t + 2.15;
      this.tone(42, { when: c, dur: 2.2, vol: 0.7, slide: 24, attack: 0.005 });
      this.noise(0.6, { when: c, vol: 0.5, freq: 400, type: 'lowpass', sweep: 60, attack: 0.005 });
      for (let k = 0; k < 9; k++) this.noise(0.25 + Math.random() * 0.4, { when: c + k * 0.05 + Math.random() * 0.06, vol: 0.12, freq: 4000 + Math.random() * 5000, q: 6, attack: 0.002 });
      this.noise(1.5, { when: c, vol: 0.15, freq: 6000, type: 'highpass', attack: 0.005 });
      // 2.6 s on: a dying chord and thunder far away.
      [73.42, 77.78, 110, 155.56].forEach((f) => this.tone(f, { when: t + 2.6, type: 'sawtooth', dur: 3.4, vol: 0.05, attack: 0.3, slide: f * 0.7 }));
      for (let k = 0; k < 4; k++) this.noise(1.4, { when: t + 2.9 + k * 0.6, vol: 0.18 - k * 0.04, freq: 220 - k * 30, type: 'lowpass', attack: 0.1 });
    }

    // Victory: the room exhales and a choir resolves to D major over a cascade of bells.
    win() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      [st(12), st(16), st(19), st(24)].forEach((f) => this.voice(f, t + 0.1, 4.2, { type: 'sawtooth', vol: 0.03, attack: 0.8, release: 2.4, filters: [['bandpass', 750, 3], ['lowpass', 2400]], dest: this.sfx }));
      [1174.66, 880, 739.99, 587.33, 880, 1174.66, 1479.98].forEach((f, k) => this.tine(f, t + 0.2 + k * 0.16, 0.07, this.sfx));
      this.noise(2.4, { vol: 0.06, freq: 3000, q: 1, sweep: 400, attack: 0.3 });
    }

    // Defeat: a boom, a falling dissonant chord, and thunder rolling away.
    lose() {
      if (!this.ctx) return;
      this.tone(60, { dur: 3, vol: 0.5, slide: 28 });
      [146.83, 155.56, 207.65, 220].forEach((f) => this.tone(f, { type: 'sawtooth', dur: 2.6, vol: 0.05, attack: 0.05, slide: f * 0.5 }));
      for (let k = 0; k < 5; k++) this.noise(1.2 + k * 0.3, { vol: 0.25 - k * 0.04, freq: 260 - k * 30, type: 'lowpass', at: 0.2 + k * 0.45, attack: 0.08 });
      this.whisper(1);
    }

    // ---- The score ------------------------------------------------------------
    // 'seance' is the adaptive score; 'menu' is a quiet music box and organ for the menus.
    startScore(mode) {
      if (!this.ctx) return;
      if (this.mus && this.mus.mode === mode) return;
      this.stopScore(0.6);
      const ctx = this.ctx, t = ctx.currentTime;
      const bus = ctx.createGain();
      bus.gain.setValueAtTime(0.0001, t);
      bus.gain.exponentialRampToValueAtTime(mode === 'menu' ? 0.5 : 1, t + 3);
      bus.connect(this.music);
      const m = { mode, bus, nodes: [], next: t + 0.15, step: 0, timer: null };

      if (mode === 'seance') {
        // Drone: low D and A, through a filter that opens as the wrath rises.
        m.droneFilter = ctx.createBiquadFilter();
        m.droneFilter.type = 'lowpass';
        m.droneFilter.frequency.value = 180;
        m.droneGain = ctx.createGain();
        m.droneGain.gain.value = 0.05;
        m.droneFilter.connect(m.droneGain).connect(bus);
        for (const [f, det] of [[73.42, -6], [73.42, 7], [110, 3], [36.71, 0]]) {
          const o = ctx.createOscillator();
          o.type = f < 50 ? 'sine' : 'sawtooth';
          o.frequency.value = f;
          o.detune.value = det;
          o.connect(m.droneFilter);
          o.start(t);
          m.nodes.push(o);
        }
        // Wind through the house.
        const wind = ctx.createBufferSource(), wf = ctx.createBiquadFilter();
        wind.buffer = this.noiseBuf;
        wind.loop = true;
        wf.type = 'bandpass';
        wf.frequency.value = 400;
        wf.Q.value = 0.6;
        m.windGain = ctx.createGain();
        m.windGain.gain.value = 0.025;
        wind.connect(wf).connect(m.windGain).connect(bus);
        wind.start(t);
        m.windFilter = wf;
        m.nodes.push(wind);
        // Trembling strings: three saws on the chord's root, fifth and octave, their volume shivering.
        m.strFilter = ctx.createBiquadFilter();
        m.strFilter.type = 'lowpass';
        m.strFilter.frequency.value = 1600;
        m.strTrem = ctx.createGain();
        m.strTrem.gain.value = 0.5;
        m.strGain = ctx.createGain();
        m.strGain.gain.value = 0;
        m.strFilter.connect(m.strTrem).connect(m.strGain).connect(bus);
        m.strOsc = [0, 7, 12].map((n, k) => {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = st(n);
          o.detune.value = [-5, 4, 0][k];
          o.connect(m.strFilter);
          o.start(t);
          m.nodes.push(o);
          return o;
        });
        m.lfo = ctx.createOscillator();
        m.lfo.frequency.value = 7;
        const depth = ctx.createGain();
        depth.gain.value = 0.45;
        m.lfo.connect(depth).connect(m.strTrem.gain);
        m.lfo.start(t);
        m.nodes.push(m.lfo);
        // A high, wavering shimmer for the final seconds.
        m.shimGain = ctx.createGain();
        m.shimGain.gain.value = 0;
        m.shimGain.connect(bus);
        for (const f of [st(36), st(37), st(31)]) {
          const o = ctx.createOscillator();
          o.frequency.value = f;
          o.connect(m.shimGain);
          o.start(t);
          m.nodes.push(o);
        }
      }

      this.mus = m;
      this.I = 0;
      this.passed.clear();
      if (!this.offline) {
        const pump = () => this.scheduleUntil(this.ctx.currentTime + LOOKAHEAD);
        pump();
        m.timer = setInterval(pump, 100);
      }
    }

    stopScore(fade = 1.2) {
      const m = this.mus;
      if (!m) return;
      this.mus = null;
      clearInterval(m.timer);
      try {
        const t = this.ctx.currentTime;
        m.bus.gain.cancelScheduledValues(t);
        m.bus.gain.setValueAtTime(Math.max(0.0001, m.bus.gain.value), t);
        m.bus.gain.exponentialRampToValueAtTime(0.0001, t + fade);
        m.nodes.forEach((n) => n.stop(t + fade + 0.1));
        setTimeout(() => { try { m.bus.disconnect(); } catch (e) { /* gone */ } }, (fade + 0.5) * 1000);
      } catch (e) { /* already stopped */ }
    }

    // Older names, still used by main.js.
    startAmbience() { this.startScore('seance'); }
    stopAmbience() { this.stopScore(); }
    menuMusic(on) { if (on) this.startScore('menu'); else if (this.mus && this.mus.mode === 'menu') this.stopScore(); }

    setWrath(w) { this.setIntensity({ wrath: w }); }

    // How dire things are: the wrath, plus a push for every offense and for the final seconds.
    setIntensity({ wrath, strikes, remaining } = {}) {
      if (wrath != null) this.state.wrath = wrath;
      if (strikes != null) this.state.strikes = strikes;
      if (remaining != null) this.state.remaining = remaining;
      if (!this.mus || this.mus.mode !== 'seance') return;
      for (let k = 0; k < STINGERS.length; k++) {
        if (this.state.wrath >= STINGERS[k] && !this.passed.has(k)) {
          this.passed.add(k);
          if (this.ctx) this.stinger(k);
        }
      }
    }

    // Reset for a new séance (wrath, offenses, time).
    resetIntensity() { this.state = { wrath: 0, strikes: 0, remaining: Infinity }; this.I = 0; this.passed.clear(); }

    targetIntensity() {
      const s = this.state;
      const final = s.remaining <= 15 ? 0.25 : 0;
      return Math.max(0, Math.min(1, s.wrath * 0.85 + s.strikes * 0.1 + final));
    }

    // Schedule every eighth-note step up to `until` (absolute context time).
    scheduleUntil(until) {
      const m = this.mus;
      if (!m) return;
      while (m.next < until) {
        this.I += (this.targetIntensity() - this.I) * 0.12;
        const bpm = m.mode === 'menu' ? 58 : 54 + 76 * this.I + (this.state.remaining <= 15 ? 18 : 0);
        const stepDur = 60 / bpm / 2;
        this.playStep(m, m.step, m.next, stepDur);
        m.next += stepDur;
        m.step++;
      }
    }

    playStep(m, step, t, stepDur) {
      const I = m.mode === 'menu' ? 0 : this.I;
      const final = m.mode === 'seance' && this.state.remaining <= 15;
      const pos = step % 8, bar = Math.floor(step / 8);
      const prog = final ? PROG_FINAL : I > 0.68 ? PROG_TENSE : PROG_CALM;
      const chord = prog[bar % prog.length];
      const barDur = stepDur * 8;

      if (m.mode === 'seance') {
        // Continuous layers follow the intensity.
        const k = 0.8;
        m.droneFilter.frequency.setTargetAtTime(160 + 900 * I * I, t, k);
        m.droneGain.gain.setTargetAtTime(0.05 + 0.11 * I, t, k);
        m.windGain.gain.setTargetAtTime(0.025 + 0.11 * I, t, k);
        m.windFilter.frequency.setTargetAtTime(350 + 500 * I + 200 * Math.sin(step / 5), t, 1.5);
        m.strGain.gain.setTargetAtTime(I < 0.3 ? 0 : 0.055 * Math.min(1, (I - 0.3) / 0.35), t, 1);
        m.lfo.frequency.setTargetAtTime(6 + 8 * I, t, 1);
        m.strFilter.frequency.setTargetAtTime(900 + 2400 * I, t, 1);
        m.shimGain.gain.setTargetAtTime(final ? 0.012 : 0, t, 0.6);
        if (pos === 0) m.strOsc.forEach((o, i) => o.frequency.setTargetAtTime(st(chord[0] + [0, 7, 12][i]), t, 0.08));
      }

      // Organ pad on every bar: the chord, voiced low.
      if (pos === 0) {
        const padVol = m.mode === 'menu' ? 0.03 : 0.022 + 0.03 * I;
        chord.forEach((n, i) => {
          this.voice(st(n), t, barDur + 0.6, { type: 'triangle', vol: padVol * (i ? 0.8 : 1), attack: Math.min(1.4, barDur / 3), release: barDur / 2, filters: [['lowpass', 900 + 1500 * I]], dest: m.bus });
          this.voice(st(n + 12), t, barDur + 0.6, { type: 'sine', vol: padVol * 0.5, attack: Math.min(1.6, barDur / 2.5), release: barDur / 2, dest: m.bus });
        });
      }

      // Music box: sparse and fragile; it falls silent as the wrath takes over.
      if (I < 0.62 && (pos === 0 || pos === 3 || pos === 5 || (pos === 6 && step % 16 === 6))) {
        const chance = m.mode === 'menu' ? 0.7 : 0.6 - 0.8 * I;
        if (Math.random() < chance) {
          const deg = pos === 0 ? chord[Math.floor(Math.random() * 3)] : SCALE[Math.floor(Math.random() * SCALE.length)];
          this.tine(st(deg + 24), t, (m.mode === 'menu' ? 0.035 : 0.03) * (1 - I * 0.8), m.bus);
        }
      }

      if (m.mode !== 'seance') return;

      // Heartbeat: once a bar when calm, then twice, then on every beat; racing in the final seconds.
      const beats = final ? [0, 1, 2, 3, 4, 5, 6, 7] : I < 0.3 ? [0] : I < 0.55 ? [0, 4] : [0, 2, 4, 6];
      if (beats.includes(pos)) {
        const v = 0.08 + 0.34 * I;
        this.tone(58, { when: t, dur: 0.18, vol: v, attack: 0.005, slide: 44, dest: m.bus });
        if (!final) this.tone(50, { when: t + Math.min(0.2, stepDur * 0.6), dur: 0.2, vol: v * 0.75, attack: 0.005, slide: 40, dest: m.bus });
        this.noise(0.08, { when: t, vol: 0.03 + 0.05 * I, freq: 150, type: 'lowpass', dest: m.bus });
      }

      // Choir: a formant "aah" on the chord once the spirit is truly angry.
      if (I > 0.58 && pos === 0) {
        const v = 0.02 * Math.min(1, (I - 0.58) / 0.25) + (final ? 0.008 : 0);
        chord.forEach((n) => this.voice(st(n + 12), t, barDur + 0.4, { type: 'sawtooth', vol: v, attack: barDur * 0.4, release: barDur * 0.4, detune: (Math.random() - 0.5) * 14, filters: [['bandpass', 720, 4], ['lowpass', 2600]], dest: m.bus }));
      }

      // A clock: tick, tock, and louder as time runs out.
      if (I > 0.72 && pos % 2 === 0) {
        this.tone(pos % 4 === 0 ? 2100 : 1600, { when: t, type: 'triangle', dur: 0.05, vol: 0.02 + 0.03 * I, attack: 0.002, dest: m.bus });
        this.noise(0.03, { when: t, vol: 0.02, freq: 4000, type: 'highpass', attack: 0.002, dest: m.bus });
      }

      // The last fifteen seconds: a boom on every half bar.
      if (final && pos % 4 === 0) {
        this.tone(46, { when: t, dur: 1.2, vol: 0.34, attack: 0.01, slide: 30, dest: m.bus });
        this.noise(0.5, { when: t, vol: 0.1, freq: 300, type: 'lowpass', sweep: 80, dest: m.bus });
      }
    }
  }

  // Small interaction sounds measured too quiet under the music: scale each one up as a whole.
  const BOOST = { dialClick: 5, uiTap: 3, mechClick: 2.5, chisel: 5, stoneClick: 3, cardFlick: 3, swish: 4, pinch: 2.5, glide: 2, skinTap: 2, woodTap: 2, scrape: 3, glassCrack: 1.8, lockRattle: 1.6 };
  for (const [name, k] of Object.entries(BOOST)) {
    const f = Sound.prototype[name];
    Sound.prototype[name] = function (...args) {
      const prev = this.k;
      this.k = prev * k;
      try { return f.apply(this, args); } finally { this.k = prev; }
    };
  }

  G.Sound = Sound;
})(globalThis.GR = globalThis.GR || {});
