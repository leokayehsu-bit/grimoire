// Music Box: plays a melody of figures that grows by one note each round.
// The Medium answers the whole melody, translated through a table that changes with every offense.
(function (G) {
  'use strict';
  const { el, esc, title } = G.util;

  const FIGURES = ['BAT', 'ROSE', 'SKULL', 'HOURGLASS'];
  const GLYPH = { BAT: '🦇', ROSE: '🌹', SKULL: '💀', HOURGLASS: '⏳' };
  const ROW_LABEL = ['No offenses', 'One offense', 'Two offenses'];
  const cell = (f) => `${GLYPH[f]} ${title(f)}`;

  // A translation row: row[i] is what to press when FIGURES[i] plays. At most one figure maps to itself.
  function makeRow(rng) {
    for (;;) {
      const row = rng.shuffle(FIGURES);
      if (row.filter((f, i) => f === FIGURES[i]).length <= 1) return row;
    }
  }

  const relic = {
    id: 'musicbox',
    title: 'Music Box',
    FIGURES,

    buildRules(rng, conds) {
      return {
        cond: rng.pick(conds),
        lullaby: [makeRow(rng), makeRow(rng), makeRow(rng)],
        dirge: [makeRow(rng), makeRow(rng), makeRow(rng)],
      };
    },

    generate(rng) {
      const len = rng.int(3, 5);
      return { seq: Array.from({ length: len }, () => rng.pick(FIGURES)), stage: 1, input: [] };
    },

    // The full answer for the current round, using the current offense count.
    expected(state, ctx, rules, strikes) {
      const table = rules.cond.test(ctx) ? rules.lullaby : rules.dirge;
      const row = table[Math.min(strikes || 0, 2)];
      return state.seq.slice(0, state.stage).map((f) => row[FIGURES.indexOf(f)]);
    },

    inputs() {
      return FIGURES;
    },

    attempt(state, fig, ctx, rules, strikes) {
      const exp = relic.expected(state, ctx, rules, strikes);
      if (fig !== exp[state.input.length]) {
        state.input = [];
        return 'strike';
      }
      state.input.push(fig);
      if (state.input.length < exp.length) return 'ok';
      if (state.stage >= state.seq.length) return 'solved';
      state.stage++;
      state.input = [];
      return 'stage';
    },

    render(root, state, api) {
      let dead = false, timer = null;
      const box = el('div', 'mbox');
      const lid = el('div', 'mbox-lid');
      const btns = FIGURES.map((f, i) => {
        const b = el('button', 'fig');
        b.type = 'button';
        b.innerHTML = `<span class="glyph">${GLYPH[f]}</span><small>${title(f)}</small>`;
        b.addEventListener('click', () => press(i));
        lid.appendChild(b);
        return b;
      });
      const pips = el('div', 'mbox-pips');
      const crank = el('button', 'btn crank', '⟳ Wind the box');
      crank.type = 'button';
      crank.addEventListener('click', () => { if (!api.solved()) { api.audio.ratchet(); play(); } });
      box.append(lid, pips, crank);
      root.appendChild(box);
      root.appendChild(el('p', 'relic-tip', 'Listen to the melody, then touch the figures.'));

      const drawPips = () => {
        pips.innerHTML = state.seq.map((_, k) => `<i class="${k < state.stage - 1 || api.solved() ? 'done' : ''}"></i>`).join('');
      };
      const flash = (i, ms) => {
        btns[i].classList.add('lit');
        setTimeout(() => btns[i].classList.remove('lit'), ms);
      };
      const later = (fn, ms) => { clearTimeout(timer); timer = setTimeout(() => { if (!dead) fn(); }, ms); };

      function play() {
        state.input = [];
        const notes = state.seq.slice(0, state.stage);
        let k = 0;
        const next = () => {
          if (k >= notes.length) { later(play, 7000); return; }
          const fi = FIGURES.indexOf(notes[k++]);
          flash(fi, 460);
          api.audio.note(fi);
          later(next, 720);
        };
        later(next, 450);
      }

      function press(i) {
        if (api.solved()) return;
        clearTimeout(timer);
        flash(i, 180);
        api.audio.note(i);
        const res = api.attempt(FIGURES[i]);
        if (res === 'strike') later(play, 1400);
        else if (res === 'stage') { drawPips(); later(play, 1000); }
        else if (res === 'solved') drawPips();
        else later(play, 7000);
      }

      drawPips();
      later(play, 1200);
      return { destroy: () => { dead = true; clearTimeout(timer); } };
    },

    smudgeables(rules) {
      const out = [];
      for (const name of ['lullaby', 'dirge']) {
        rules[name].forEach((row, r) => row.forEach((f, i) => out.push({
          key: `${name}.${r}.${i}`, where: `the ${title(name)}, ${ROW_LABEL[r]} row, under the ${title(FIGURES[i])}`, value: cell(f),
        })));
      }
      return out;
    },

    manual(rules, smudge) {
      const ink = G.util.inker(smudge);
      const table = (name, rows) => {
        let h = `<h3>The ${title(name)}</h3><table class="grid"><thead><tr><th>When it plays…</th>` +
          FIGURES.map((f) => `<th>${GLYPH[f]} ${title(f)}</th>`).join('') + '</tr></thead><tbody>';
        rows.forEach((row, r) => {
          h += `<tr><td>${ROW_LABEL[r]}</td>` + row.map((f, i) => `<td>${ink(`${name}.${r}.${i}`, cell(f))}</td>`).join('') + '</tr>';
        });
        return h + '</tbody></table>';
      };
      return `<p class="lead">The box plays a melody on four figures: the Bat, the Rose, the Skull and the Hourglass.
        Each time the Medium answers correctly, the melody grows by one note. The Medium must answer the <em>whole</em> melody from its first note,
        translating every note with the tables below.</p>
        <p class="lead">If <strong>${esc(rules.cond.text)}</strong>, use the Lullaby. Otherwise, use the Dirge.
        Read the row for the number of offenses made so far, <em>across the whole séance</em>. After an offense, the box plays the melody again.</p>` +
        table('lullaby', rules.lullaby) + table('dirge', rules.dirge) +
        '<p class="note">The Medium may wind the box to hear the melody again. Winding starts their answer over.</p>';
    },
  };

  G.relics.musicbox = relic;
})(globalThis.GR = globalThis.GR || {});
