// Crystal Ball: mist swirls through three colours, then clears. The first and last colour name a rune;
// touch that rune among the six carved around the base.
(function (G) {
  'use strict';
  const { el, title } = G.util;
  const { react, loop } = G.kit;

  const COLORS = ['RED', 'GREEN', 'BLUE', 'VIOLET', 'GOLD'];
  const MIST = { RED: '#d0483f', GREEN: '#4fae6a', BLUE: '#4a7fd6', VIOLET: '#9a5fd0', GOLD: '#e0b84a' };
  // Rune shapes as SVG strokes on a 20×30 box (drawn identically on the ball and in the book).
  const RUNES = {
    FEHU: 'M6 2 V28 M6 8 L15 3 M6 15 L15 10',
    URUZ: 'M5 28 V2 L15 9 V28',
    THURS: 'M6 2 V28 M6 9 L14 15 L6 21',
    ANSUZ: 'M6 2 V28 M6 6 L14 11 M6 13 L14 18',
    RAIDO: 'M6 28 V2 L14 8 L6 14 L14 28',
    KAUNA: 'M14 4 L6 15 L14 26',
    GEBO: 'M4 4 L16 26 M16 4 L4 26',
    WUNJO: 'M6 28 V2 L14 8 L6 14',
    HAGAL: 'M5 2 V28 M15 2 V28 M5 11 L15 19',
    NAUDIZ: 'M10 2 V28 M5 11 L15 19',
  };
  const NAMES = Object.keys(RUNES);
  const rune = (n, cls = 'rune') => `<svg class="${cls}" viewBox="0 0 20 30" aria-hidden="true"><path d="${RUNES[n]}"/></svg>`;

  const relic = {
    id: 'crystal',
    title: 'Crystal Ball',

    buildRules(rng) {
      const grid = {};
      for (const a of COLORS) {
        grid[a] = {};
        for (const b of COLORS) grid[a][b] = rng.pick(NAMES);
      }
      return { grid };
    },

    generate(rng, ctx, rules) {
      const seq = [rng.pick(COLORS)];
      while (seq.length < 3) {
        const c = rng.pick(COLORS);
        if (c !== seq[seq.length - 1]) seq.push(c);
      }
      const answer = rules.grid[seq[0]][seq[2]];
      const ring = rng.shuffle([answer, ...rng.sample(NAMES.filter((n) => n !== answer), 5)]);
      return { seq, ring };
    },

    expected(state, ctx, rules) {
      return state.ring.indexOf(rules.grid[state.seq[0]][state.seq[2]]);
    },

    inputs() { return [0, 1, 2, 3, 4, 5]; },

    attempt(state, i, ctx, rules) {
      return i === relic.expected(state, ctx, rules) ? 'solved' : 'strike';
    },

    render(root, state, api) {
      const wrap = el('div', 'crystal');
      const ball = el('div', 'ball');
      ball.innerHTML = '<span class="mist"></span>';
      const mist = ball.firstChild;
      const base = el('div', 'ball-base');
      state.ring.forEach((n, i) => {
        const b = el('button', 'rune-btn');
        b.type = 'button';
        b.setAttribute('aria-label', 'Rune ' + (i + 1));
        b.innerHTML = rune(n);
        b.addEventListener('click', () => {
          if (api.solved()) return;
          react(b, api.attempt(i));
        });
        base.appendChild(b);
      });
      wrap.append(ball, base);
      root.appendChild(wrap);
      root.appendChild(el('p', 'relic-tip', 'Watch the mist from when it clears. Describe the runes on the base.'));

      let k = 0;
      const step = (later) => {
        if (k < state.seq.length) {
          mist.style.setProperty('--mist', MIST[state.seq[k++]]);
          ball.classList.add('swirl');
          later(step, 1300);
        } else {
          k = 0;
          ball.classList.remove('swirl');
          later(step, 1800);
        }
      };
      const l = loop(step, 600);
      return { destroy: l.stop };
    },

    smudgeables(rules) {
      const out = [];
      for (const a of COLORS) for (const b of COLORS) out.push({ key: `${a}.${b}`, where: `first ${title(a)}, last ${title(b)}`, value: title(rules.grid[a][b]) });
      return out;
    },

    manual(rules, smudge) {
      const ink = G.util.inker(smudge);
      const rows = COLORS.map((a) => [`<span class="swatch" style="background:${MIST[a]}"></span> ${title(a)}`]
        .concat(COLORS.map((b) => `<span class="rune-cell">${rune(rules.grid[a][b], 'rune small')} ${ink(`${a}.${b}`, title(rules.grid[a][b]))}</span>`)));
      return `<p class="lead">The mist inside the ball turns three colours one after another, then clears and starts again.
        Have the Medium watch from a clearing: the <b>first</b> colour picks the row and the <b>last</b> colour picks the column.
        The middle colour means nothing.</p>
        <p class="lead">Six runes are carved around the ball's base. Describe the shape of the rune named in the table to the Medium, and have them touch it.</p>
        ${G.kit.table(['First ↓ · Last →'].concat(COLORS.map(title)), rows)}
        <h3>The runes</h3><div class="rune-legend">${NAMES.map((n) => `<span>${rune(n)}<small>${title(n)}</small></span>`).join('')}</div>`;
    },
  };

  G.relics.crystal = relic;
})(globalThis.GR = globalThis.GR || {});
