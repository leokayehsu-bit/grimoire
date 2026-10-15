// Pendulum: a crystal swings over a four-quadrant board. Its crystal and its swing name a symbol to stop it over.
(function (G) {
  'use strict';
  const { el, esc, title } = G.util;
  const { react } = G.kit;

  const CRYSTALS = ['CLEAR', 'ROSE', 'AMBER', 'JADE'];
  const CRYSTAL_CSS = { CLEAR: '#dfe8ef', ROSE: '#e79aae', AMBER: '#e0a040', JADE: '#4fa77a' };
  const SWINGS = ['UPDOWN', 'SIDEWAYS', 'CLOCKWISE', 'ANTICLOCKWISE'];
  const SWING_TEXT = { UPDOWN: 'Up and down', SIDEWAYS: 'Side to side', CLOCKWISE: 'Circles, clockwise', ANTICLOCKWISE: 'Circles, anticlockwise' };
  const SYMBOLS = { SUN: '☀\uFE0E', MOON: '☾', STAR: '✶', TOWER: '♜' };
  const SYM = Object.keys(SYMBOLS);

  const relic = {
    id: 'pendulum',
    title: 'Pendulum',

    buildRules(rng, conds) {
      const table = {};
      for (const c of CRYSTALS) {
        table[c] = {};
        for (const s of SWINGS) table[c][s] = rng.pick(SYM);
      }
      return { table, cond: rng.pick(conds) };
    },

    generate(rng) {
      return { crystal: rng.pick(CRYSTALS), swing: rng.pick(SWINGS), layout: rng.shuffle(SYM) };
    },

    // Quadrants: 0 top left, 1 top right, 2 bottom left, 3 bottom right. Diagonal opposite = 3 − i.
    expected(state, ctx, rules) {
      const i = state.layout.indexOf(rules.table[state.crystal][state.swing]);
      return rules.cond.test(ctx) ? 3 - i : i;
    },

    inputs() { return [0, 1, 2, 3]; },

    attempt(state, i, ctx, rules) {
      return i === relic.expected(state, ctx, rules) ? 'solved' : 'strike';
    },

    render(root, state, api) {
      const board = el('div', 'pboard');
      state.layout.forEach((s, i) => {
        const b = el('button', 'pq');
        b.type = 'button';
        b.setAttribute('aria-label', `Stop over the ${title(s)}`);
        b.innerHTML = `<span>${SYMBOLS[s]}</span>`;
        b.addEventListener('click', () => {
          if (api.solved()) return;
          const res = api.attempt(i);
          react(b, res);
          if (res === 'solved') board.classList.add('still');
        });
        board.appendChild(b);
      });
      const bob = el('div', `pbob swing-${state.swing.toLowerCase()}`);
      bob.innerHTML = '<i></i>';
      bob.style.setProperty('--crystal', CRYSTAL_CSS[state.crystal]);
      board.appendChild(bob);
      root.appendChild(board);
      root.appendChild(el('p', 'relic-tip', 'Name the crystal’s colour and how it swings. Touch a quadrant to stop it there.'));
    },

    smudgeables(rules) {
      const out = [];
      for (const c of CRYSTALS) for (const s of SWINGS) out.push({ key: `${c}.${s}`, where: `${title(c)} crystal, ${SWING_TEXT[s].toLowerCase()}`, value: `${SYMBOLS[rules.table[c][s]]} ${title(rules.table[c][s])}` });
      return out;
    },

    manual(rules, smudge) {
      const ink = G.util.inker(smudge);
      const rows = CRYSTALS.map((c) => [`<span class="swatch" style="background:${CRYSTAL_CSS[c]}"></span> ${title(c)}`]
        .concat(SWINGS.map((s) => ink(`${c}.${s}`, `${SYMBOLS[rules.table[c][s]]} ${title(rules.table[c][s])}`))));
      return `<p class="lead">A crystal pendulum swings over a board split into four quadrants, each with a symbol:
        the Sun ${SYMBOLS.SUN}, the Moon ${SYMBOLS.MOON}, the Star ${SYMBOLS.STAR} and the Tower ${SYMBOLS.TOWER}.
        Have the Medium name the crystal and how it swings, as seen from above.</p>
        <p class="lead">The table names a symbol. If <strong>${esc(rules.cond.text)}</strong>,
        stop the pendulum over the quadrant diagonally <em>opposite</em> that symbol instead.</p>
        ${G.kit.table(['Crystal'].concat(SWINGS.map((s) => SWING_TEXT[s])), rows)}`;
    },
  };

  G.relics.pendulum = relic;
})(globalThis.GR = globalThis.GR || {});
