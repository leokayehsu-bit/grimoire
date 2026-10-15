// A grimoire "edition" fixes every rule in the book. Same edition number = same book on every device.
(function (G) {
  'use strict';
  const { makeRng, hash, esc } = G.util;

  G.RELIC_ORDER = ['candles', 'ouija', 'musicbox', 'tarot'];
  // Needy relics are never cleansed and never drawn into RELIC_ORDER's sample; the difficulty adds them.
  G.NEEDY_ORDER = ['doll'];
  G.BOOK_ORDER = G.RELIC_ORDER.concat(G.NEEDY_ORDER);

  const MARKS = ['☿', '♄', '♃', '♀', '♂', '☊'];

  // The smudged copy: one value per relic page has run, and a pencilled note on another page restores it.
  // Notes follow a shuffled cycle of pages, so every page hosts exactly one note and none hosts its own.
  function smudges(edition, R) {
    const rng = makeRng(hash(`grimoire/${edition}/smudge`));
    const ids = rng.shuffle(G.BOOK_ORDER);
    const marks = rng.shuffle(MARKS);
    const out = {};
    ids.forEach((id, k) => {
      const c = rng.pick(G.relics[id].smudgeables(R[id]));
      out[id] = { key: c.key, where: c.where, value: c.value, mark: marks[k], noteOn: ids[(k + 1) % ids.length] };
    });
    return out;
  }

  function note(id, s) {
    return `<aside class="margin" data-mark="${s.mark}"><span class="glyph">${s.mark}</span>
      <span>Pencilled in the margin: on the <b>${G.relics[id].title}</b> page, where the ink has run
      (${esc(s.where)}), it reads <b class="restored">${s.value}</b>.</span></aside>`;
  }

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
      for (const id of G.BOOK_ORDER) {
        // Each relic gets its own stream, so adding a relic never reshuffles the others' rules.
        const rng = makeRng(hash(`grimoire/${edition}/${id}`));
        out[id] = G.relics[id].buildRules(rng, conds);
      }
      out.smudges = smudges(edition, out);
      return out;
    },

    // One relic page of the grimoire as HTML. `smudged` blots one value and adds another page's margin note.
    page(R, id, smudged) {
      let html = G.relics[id].manual(R[id], smudged ? R.smudges[id] : null);
      if (smudged) {
        for (const other of G.BOOK_ORDER) if (R.smudges[other].noteOn === id) html += note(other, R.smudges[other]);
      }
      return html;
    },
  };
})(globalThis.GR = globalThis.GR || {});
