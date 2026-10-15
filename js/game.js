// The séance itself: wrath (the timer), offenses (strikes) and the relics on the table.
// DOM-free so tests/check.js can run thousands of séances in Node.
(function (G) {
  'use strict';
  const { makeRng, hash } = G.util;

  class Game {
    // { seed, edition, difficulty, level } or { ..., free: { count, needy, upTo } } for a free séance.
    constructor({ seed, edition, difficulty, level, free }) {
      const rng = makeRng(seed);
      this.seed = seed;
      this.edition = edition;
      this.difficulty = difficulty;
      this.level = free ? G.levels.freeLevel(free.count, free.needy, free.upTo, free.curses) : G.levels.get(level) || G.levels.get(1);
      this.curses = G.levels.cursesFor(this.level, difficulty, seed);
      this.rules = G.rules.build(edition);
      this.ctx = G.seance.generate(rng);
      this.plan = G.levels.plan(this.level, difficulty, rng);
      // Needy relics sit on the table too (last), but never count toward the win.
      this.relics = this.plan.relics.concat(this.plan.needy).map((id) => {
        const def = G.relics[id];
        const state = def.generate(makeRng((seed ^ hash(id)) >>> 0), this.ctx, this.rules[id]);
        return { id, def, title: def.title, needy: !!def.needy, state, solved: false };
      });
      this.duration = this.plan.time;
      this.elapsed = 0;
      this.realTime = 0;
      this.strikes = 0;
      this.maxStrikes = this.plan.offenses;
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
        level: this.level.free ? 0 : this.level.n,
        levelName: this.level.name,
        difficulty: this.difficulty,
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

  G.Game = Game;
})(globalThis.GR = globalThis.GR || {});
