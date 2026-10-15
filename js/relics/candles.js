// Ritual Candles: a row of 3–6 coloured candles. Snuff exactly the right one.
(function (G) {
  'use strict';
  const { ORD, lc, el } = G.util;

  const COLORS = ['WHITE', 'BLACK', 'RED', 'VIOLET', 'GREEN'];
  const WAX = { WHITE: '#ece4d2', BLACK: '#25212b', RED: '#a3262a', VIOLET: '#7446a8', GREEN: '#3f7a46' };
  const COUNT_WORD = { 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six' };
  const count = (cs, c) => cs.filter((x) => x === c).length;

  // Each template makes one instruction: printed text + the test and pick the game uses.
  const TEMPLATES = {
    noneOf(rng, n) {
      const c = rng.pick(COLORS), k = rng.int(0, n - 1);
      return { text: `If there are no ${lc(c)} candles, snuff the ${ORD[k]} candle.`, test: (cs) => count(cs, c) === 0, pick: () => k };
    },
    exactlyOne(rng) {
      const c = rng.pick(COLORS);
      return { text: `If exactly one candle is ${lc(c)}, snuff it.`, test: (cs) => count(cs, c) === 1, pick: (cs) => cs.indexOf(c) };
    },
    lastIs(rng, n) {
      const c = rng.pick(COLORS), k = rng.int(0, n - 2);
      return { text: `If the last candle is ${lc(c)}, snuff the ${ORD[k]} candle.`, test: (cs) => cs[cs.length - 1] === c, pick: () => k };
    },
    firstIs(rng, n) {
      const c = rng.pick(COLORS), k = rng.int(1, n - 1);
      return { text: `If the first candle is ${lc(c)}, snuff the ${ORD[k]} candle.`, test: (cs) => cs[0] === c, pick: () => k };
    },
    manyOf(rng) {
      const c = rng.pick(COLORS);
      return { text: `If more than one candle is ${lc(c)}, snuff the last ${lc(c)} one.`, test: (cs) => count(cs, c) > 1, pick: (cs) => cs.lastIndexOf(c) };
    },
    moreThan(rng) {
      const [a, b] = rng.sample(COLORS, 2);
      return {
        text: `If there are more ${lc(a)} candles than ${lc(b)} candles, snuff the first ${lc(a)} one.`,
        test: (cs) => count(cs, a) > count(cs, b), pick: (cs) => cs.indexOf(a),
      };
    },
  };

  function spiritRule(rng, conds) {
    const cond = rng.pick(conds), c = rng.pick(COLORS), which = rng.pick(['first', 'last']);
    return {
      text: `If ${cond.text} and at least one candle is ${lc(c)}, snuff the ${which} ${lc(c)} one.`,
      test: (cs, ctx) => cond.test(ctx) && count(cs, c) > 0,
      pick: (cs) => (which === 'first' ? cs.indexOf(c) : cs.lastIndexOf(c)),
    };
  }

  function randomCandles(rng, n) {
    return Array.from({ length: n }, () => rng.pick(COLORS));
  }

  function evaluate(set, cs, ctx) {
    for (let i = 0; i < set.rules.length; i++) {
      if (set.rules[i].test(cs, ctx)) return { rule: i, pick: set.rules[i].pick(cs, ctx) };
    }
    return { rule: set.rules.length, pick: set.fallback };
  }

  function makeSet(rng, n, conds) {
    const rules = rng.sample(Object.keys(TEMPLATES), 2).map((name) => TEMPLATES[name](rng, n));
    rules.splice(rng.int(0, 2), 0, spiritRule(rng, conds));
    return { rules, fallback: rng.int(0, n - 1) };
  }

  const relic = {
    id: 'candles',
    title: 'Ritual Candles',
    COLORS, WAX,

    // Reject rule sets where an instruction almost never fires (it would be dead text in the book).
    buildRules(rng, conds) {
      const probe = G.util.makeRng(0xC0FFEE);
      const byCount = {};
      for (let n = 3; n <= 6; n++) {
        const tests = Array.from({ length: 500 }, () => ({ ctx: G.seance.generate(probe), cs: randomCandles(probe, n) }));
        let best = null;
        for (let tries = 0; tries < 30; tries++) {
          const set = makeSet(rng, n, conds);
          const hits = new Array(set.rules.length + 1).fill(0);
          for (const t of tests) hits[evaluate(set, t.cs, t.ctx).rule]++;
          const score = Math.min(...hits) / tests.length;
          if (!best || score > best.score) best = { set, score };
          if (score >= 0.05) break;
        }
        byCount[n] = best.set;
      }
      return { byCount };
    },

    generate(rng) {
      return { colors: randomCandles(rng, rng.int(3, 6)), snuffed: -1 };
    },

    expected(state, ctx, rules) {
      return evaluate(rules.byCount[state.colors.length], state.colors, ctx).pick;
    },

    inputs(state) {
      return state.colors.map((_, i) => i);
    },

    attempt(state, i, ctx, rules) {
      if (i !== relic.expected(state, ctx, rules)) return 'strike';
      state.snuffed = i;
      return 'solved';
    },

    render(root, state, api) {
      const row = el('div', 'candle-row');
      state.colors.forEach((c, i) => {
        const b = el('button', 'candle');
        b.type = 'button';
        b.style.setProperty('--wax', WAX[c]);
        b.setAttribute('aria-label', `Snuff the ${ORD[i]} candle (${lc(c)})`);
        b.innerHTML = '<span class="flame"></span><span class="wax"></span>';
        b.addEventListener('click', () => {
          if (api.solved()) return;
          const res = api.attempt(i);
          if (res === 'solved') b.classList.add('out');
          else if (res === 'strike') {
            b.classList.remove('flare');
            void b.offsetWidth;
            b.classList.add('flare');
          }
        });
        row.appendChild(b);
      });
      root.appendChild(row);
      root.appendChild(el('p', 'relic-tip', 'Touch a flame to snuff it.'));
    },

    manual(rules) {
      let html = `<p class="lead">The candles stand in a row. Count them from left to right, then read only the passage for that many candles.
        Obey the <em>first</em> instruction that holds true, and snuff exactly one flame.</p>`;
      for (let n = 3; n <= 6; n++) {
        const set = rules.byCount[n];
        html += `<h3>${COUNT_WORD[n]} candles</h3><ol class="rules">`;
        for (const r of set.rules) html += `<li>${r.text}</li>`;
        html += `<li>Otherwise, snuff the ${ORD[set.fallback]} candle.</li></ol>`;
      }
      html += '<p class="note">Wax comes in five colours: white, black, red, violet and green.</p>';
      return html;
    },
  };

  G.relics.candles = relic;
})(globalThis.GR = globalThis.GR || {});
