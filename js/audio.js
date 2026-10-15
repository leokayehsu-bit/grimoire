// All sound is synthesised with Web Audio — no files to load.
(function (G) {
  'use strict';

  class Sound {
    constructor() {
      this.ctx = null;
      this.out = null;
      this.amb = null;
      this.wrath = 0;
      this.beatTimer = null;
      this.noiseBuf = null;
    }

    unlock() {
      try {
        if (!this.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          this.ctx = new AC();
          this.out = this.ctx.createGain();
          this.out.gain.value = 0.7;
          this.out.connect(this.ctx.destination);
          const len = this.ctx.sampleRate * 2;
          this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
          const d = this.noiseBuf.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) { /* no audio, the game still works */ }
    }

    tone(freq, { type = 'sine', dur = 0.4, vol = 0.2, at = 0, attack = 0.006, slide = null } = {}) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + at;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.out);
      o.start(t);
      o.stop(t + dur + 0.05);
    }

    noise(dur, { vol = 0.2, freq = 1000, q = 1, at = 0, type = 'bandpass' } = {}) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + at;
      const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      src.buffer = this.noiseBuf;
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(this.out);
      src.start(t, Math.random());
      src.stop(t + dur + 0.05);
    }

    note(i) {
      const f = [523.25, 622.25, 783.99, 932.33][i] || 440;
      this.tone(f, { dur: 1.1, vol: 0.16 });
      this.tone(f * 2, { dur: 0.5, vol: 0.04 });
      this.tone(f * 3.01, { dur: 0.25, vol: 0.02 });
    }

    scrape() { this.noise(0.22, { vol: 0.05, freq: 2600, q: 0.8 }); }

    strike() {
      this.noise(0.7, { vol: 0.3, freq: 500, q: 0.6 });
      this.tone(110, { type: 'sawtooth', dur: 0.8, vol: 0.1, slide: 68 });
      this.tone(116.5, { type: 'sawtooth', dur: 0.8, vol: 0.1, slide: 72 });
    }

    solve() {
      [392, 523.25, 659.25, 783.99].forEach((f, k) => this.tone(f, { dur: 1.0, vol: 0.1, at: k * 0.09 }));
      this.noise(0.6, { vol: 0.05, freq: 5000, q: 0.5, at: 0.1, type: 'highpass' });
    }

    win() {
      [261.63, 329.63, 392, 523.25, 659.25].forEach((f, k) => this.tone(f, { dur: 2.2, vol: 0.09, at: k * 0.16 }));
    }

    lose() {
      this.tone(98, { type: 'sawtooth', dur: 2.4, vol: 0.14, slide: 40 });
      this.tone(103.8, { type: 'sawtooth', dur: 2.4, vol: 0.12, slide: 43 });
      this.noise(2.0, { vol: 0.25, freq: 300, q: 0.5, type: 'lowpass' });
    }

    startAmbience() {
      if (!this.ctx || this.amb) return;
      const g = this.ctx.createGain();
      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.05, this.ctx.currentTime + 3);
      g.connect(this.out);
      const a = this.ctx.createOscillator(), b = this.ctx.createOscillator();
      a.frequency.value = 55;
      b.frequency.value = 55.6;
      a.connect(g);
      b.connect(g);
      const wind = this.ctx.createBufferSource(), lp = this.ctx.createBiquadFilter(), wg = this.ctx.createGain();
      wind.buffer = this.noiseBuf;
      wind.loop = true;
      lp.type = 'lowpass';
      lp.frequency.value = 380;
      wg.gain.value = 0.35;
      wind.connect(lp).connect(wg).connect(g);
      a.start(); b.start(); wind.start();
      this.amb = { g, nodes: [a, b, wind] };
      this.beat();
    }

    stopAmbience() {
      clearTimeout(this.beatTimer);
      if (!this.amb) return;
      const { g, nodes } = this.amb;
      this.amb = null;
      try {
        g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.8);
        nodes.forEach((n) => n.stop(this.ctx.currentTime + 0.9));
      } catch (e) { /* already stopped */ }
    }

    setWrath(w) { this.wrath = w; }

    // A heartbeat that quickens as the spirit's wrath rises.
    beat() {
      if (!this.amb) return;
      const w = this.wrath;
      this.tone(62, { dur: 0.16, vol: 0.18 + 0.25 * w });
      this.noise(0.06, { vol: 0.05 + 0.08 * w, freq: 160, q: 1, type: 'lowpass' });
      this.tone(54, { dur: 0.2, vol: 0.12 + 0.2 * w, at: 0.2 });
      this.beatTimer = setTimeout(() => this.beat(), (1.5 - w * 1.0) * 1000);
    }
  }

  G.Sound = Sound;
})(globalThis.GR = globalThis.GR || {});
