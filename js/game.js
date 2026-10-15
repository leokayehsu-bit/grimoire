// The séance itself: wrath (the timer), offenses (strikes) and the relics on the table.
// DOM-free so tests/check.js can run thousands of séances in Node.
(function (G) {
  'use strict';
  const { makeRng, hash } = G.util;

  const DIFFICULTY = {
    restless: { label: 'Restless', relics: 3, time: 300, blurb: '3 relics · 5:00' },
    vengeful: { label: 'Vengeful', relics: 4, time: 300, blurb: '4 relics · 5:00' },
    damned: { label: 'Damned', relics: 4, time: 210, blurb: '4 relics · 3:30' },
  };

  class Game {
    constructor({ seed, edition, difficulty }) {
      const rng = makeRng(seed);
      this.seed = seed;
      this.edition = edition;
      this.diff = DIFFICULTY[difficulty] || DIFFICULTY.restless;
      this.rules = G.rules.build(edition);
      this.ctx = G.seance.generate(rng);
      const ids = rng.sample(G.RELIC_ORDER, this.diff.relics);
      this.relics = ids.map((id) => {
        const def = G.relics[id];
        const state = def.generate(makeRng((seed ^ hash(id)) >>> 0), this.ctx, this.rules[id]);
        return { id, def, title: def.title, state, solved: false };
      });
      this.duration = this.diff.time;
      this.elapsed = 0;
      this.realTime = 0;
      this.strikes = 0;
      this.maxStrikes = 3;
      this.result = null;
      this.listeners = {};
    }

    on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
    emit(ev, arg) { for (const fn of this.listeners[ev] || []) fn(arg); }

    // Every offense makes the wrath rise 25% faster.
    get rate() { return 1 + 0.25 * this.strikes; }
    get wrath() { return Math.min(1, this.elapsed / this.duration); }
    get remaining() { return Math.max(0, (this.duration - this.elapsed) / this.rate); }

    tick(dt) {
      if (this.result) return;
      this.realTime += dt;
      this.elapsed += dt * this.rate;
      if (this.elapsed >= this.duration) this.end('lose', 'wrath');
    }

    attempt(index, input) {
      const r = this.relics[index];
      if (this.result || !r || r.solved) return 'ignored';
      const res = r.def.attempt(r.state, input, this.ctx, this.rules[r.id], this.strikes);
      if (res === 'strike') {
        this.strikes++;
        this.emit('strike', r);
        if (this.strikes >= this.maxStrikes) this.end('lose', 'strikes');
      } else if (res === 'solved') {
        r.solved = true;
        this.emit('solve', r);
        if (this.relics.every((x) => x.solved)) this.end('win', 'cleansed');
      }
      return res;
    }

    end(result, reason) {
      if (this.result) return;
      this.result = { result, reason };
      this.emit('end', {
        result, reason,
        time: Math.round(this.realTime),
        strikes: this.strikes,
        solved: this.relics.filter((r) => r.solved).length,
        total: this.relics.length,
        edition: this.edition,
      });
    }

    status() {
      return {
        wrath: this.wrath,
        remaining: this.remaining,
        strikes: this.strikes,
        maxStrikes: this.maxStrikes,
        relics: this.relics.map((r) => ({ id: r.id, title: r.title, solved: r.solved })),
      };
    }

    // Debug aid: what the book says for each relic right now.
    answers() {
      return this.relics.map((r) => ({ id: r.id, answer: r.def.expected(r.state, this.ctx, this.rules[r.id], this.strikes) }));
    }
  }

  G.DIFFICULTY = DIFFICULTY;
  G.Game = Game;
})(globalThis.GR = globalThis.GR || {});
