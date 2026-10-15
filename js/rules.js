// A grimoire "edition" fixes every rule in the book. Same edition number = same book on every device.
(function (G) {
  'use strict';
  const { makeRng, hash, esc } = G.util;

  // Enough marks for every page. Margin notes and smudges are matched by mark.
  const MARKS = ['☿', '♄', '♃', '♀', '♂', '☊', '☋', '♁', '♅', '♆', '♇', '☉', 'Ψ', 'Ω', 'Δ', 'Σ', 'Φ', 'Θ', 'λ', 'ξ', 'ж', 'ѯ'];

  // The smudged copy of one particular book (the pages a level shows): one value per page has run, and a
  // pencilled note on another page restores it. Notes follow a shuffled cycle, so every page hosts exactly one
  // note and none hosts its own. A one-page book keeps its note in the Preface.
  function smudges(R, pages) {
    const rng = makeRng(hash(`grimoire/${R.edition}/smudge/${pages.join(',')}`));
    const ids = rng.shuffle(pages);
    const marks = rng.shuffle(MARKS);
    const out = {};
    ids.forEach((id, k) => {
      const c = rng.pick(G.relics[id].smudgeables(R[id]));
      const noteOn = ids.length === 1 ? 'preface' : ids[(k + 1) % ids.length];
      out[id] = { key: c.key, where: c.where, value: c.value, mark: marks[k], noteOn };
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
      for (const id of Object.keys(G.relics)) {
        // Each relic gets its own stream, so adding a relic never reshuffles the others' rules.
        const rng = makeRng(hash(`grimoire/${edition}/${id}`));
        out[id] = G.relics[id].buildRules(rng, conds);
      }
      out.smudgeCache = new Map();
      return out;
    },

    // Smudges for a given set of pages (cached per edition and page set).
    smudges(R, pages) {
      const key = pages.join(',');
      if (!R.smudgeCache.has(key)) R.smudgeCache.set(key, smudges(R, pages));
      return R.smudgeCache.get(key);
    },

    // Margin notes that live in the Preface (only for a one-page book).
    prefaceNotes(sm) {
      if (!sm) return '';
      return Object.keys(sm).filter((id) => sm[id].noteOn === 'preface').map((id) => note(id, sm[id])).join('');
    },

    // One relic page as HTML. `sm` (from smudges()) blots one value and adds another page's margin note; null = clean.
    page(R, id, sm) {
      let html = G.relics[id].manual(R[id], sm ? sm[id] : null);
      if (sm) {
        for (const other of Object.keys(sm)) if (sm[other].noteOn === id) html += note(other, sm[other]);
      }
      return html;
    },
  };
})(globalThis.GR = globalThis.GR || {});
