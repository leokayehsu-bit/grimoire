// A grimoire "edition" fixes every rule in the book. Same edition number = same book on every device.
(function (G) {
  'use strict';

  G.RELIC_ORDER = ['candles', 'ouija', 'musicbox', 'tarot'];

  // Rules are never mutated, so each edition is built once and shared.
  const cache = new Map();

  G.rules = {
    build(edition) {
      if (!cache.has(edition)) cache.set(edition, G.rules.make(edition));
      return cache.get(edition);
    },

    make(edition) {
      const conds = G.seance.conditions();
      const out = { edition };
      for (const id of G.RELIC_ORDER) {
        // Each relic gets its own stream, so adding a relic never reshuffles the others' rules.
        const rng = G.util.makeRng(G.util.hash(`grimoire/${edition}/${id}`));
        out[id] = G.relics[id].buildRules(rng, conds);
      }
      return out;
    },
  };
})(globalThis.GR = globalThis.GR || {});
