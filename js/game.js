// The séance itself: wrath (the timer), offenses (strikes) and the relics on the table.
// DOM-free so tests/check.js can run thousands of séances in Node.
(function (G) {
  'use strict';
  const { makeRng, hash } = G.util;

  const DIFFICULTY = {
    restless: { label: 'Restless', relics: 3, needy: 0, time: 300, blurb: '3 relics · 5:00' },
    vengeful: { label: 'Vengeful', relics: 4, needy: 1, time: 300, blurb: '4 relics + the doll · 5:00' },
    // Damned also smudges one passage per relic page in the Scholars' copy (see G.rules.page).
    damned: { label: 'Damned', relics: 4, needy: 1, time: 210, smudged: true, blurb: '4 relics + the doll · 3:30 · smudged ink' },
  };

  class Game {
    constructor({ seed, edition, difficulty }) {
      const rng = makeRng(seed);
      this.seed = seed;
      this.edition = edition;
      this.diff = DIFFICULTY[difficulty] || DIFFICULTY.restless;
      this.rules = G.rules.build(edition);
      this.ctx = G.seance.generate(rng);
      // Needy relics (the doll) sit on the table too, but never count toward the win.
      const ids = rng.sample(G.RELIC_ORDER, this.diff.relics).concat(G.NEEDY_ORDER.slice(0, this.diff.needy || 0));
      this.relics = ids.map((id) => {
        const def = G.relics[id];
        const state = def.generate(makeRng((seed ^ hash(id)) >>> 0), this.ctx, this.rules[id]);
        return { id, def, title: def.title, needy: !!def.needy, state, solved: false };
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
      if (this.elapsed >= this.duration) { this.end('lose', 'wrath'); return; }
      for (const r of this.relics) {
        if (!r.needy || this.result) continue;
        const ev = r.def.tick(r.state, dt);
        if (ev === 'whisper') this.emit('whisper', r);
        else if (ev === 'timeout') this.offend(r);
      }
    }

    offend(r) {
      this.strikes++;
      this.emit('strike', r);
      if (this.strikes >= this.maxStrikes) this.end('lose', 'strikes');
    }

    get cleansable() { return this.relics.filter((r) => !r.needy); }

    attempt(index, input) {
      const r = this.relics[index];
      if (this.result || !r || r.solved) return 'ignored';
      const res = r.def.attempt(r.state, input, this.ctx, this.rules[r.id], this.strikes);
      if (res === 'strike') {
        this.offend(r);
      } else if (res === 'soothed') {
        this.emit('soothe', r);
      } else if (res === 'solved') {
        r.solved = true;
        this.emit('solve', r);
        if (this.cleansable.every((x) => x.solved)) this.end('win', 'cleansed');
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
        solved: this.cleansable.filter((r) => r.solved).length,
        total: this.cleansable.length,
        edition: this.edition,
      });
    }

    status() {
      return {
        wrath: this.wrath,
        remaining: this.remaining,
        strikes: this.strikes,
        maxStrikes: this.maxStrikes,
        relics: this.relics.map((r) => ({ id: r.id, title: r.title, solved: r.solved, needy: r.needy })),
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
