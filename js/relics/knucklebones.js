// Knucklebones: three carved bones cast like dice. Keep exactly the one the book names.
(function (G) {
  'use strict';
  const { el } = G.util;
  const { rule, coveredSet, pickFrom, react } = G.kit;

  const POS = ['left', 'middle', 'right'];
  const NUM = ['', 'one', 'two', 'three', 'four', 'five', 'six'];
  const sum = (d) => d[0] + d[1] + d[2];

  const TEMPLATES = {
    allOdd(rng) {
      const k = rng.int(0, 2);
      return rule(POS[k], (b) => `If every bone shows an odd number, keep the ${b} bone.`, (d) => d.every((x) => x % 2 === 1), () => k);
    },
    allEven(rng) {
      const k = rng.int(0, 2);
      return rule(POS[k], (b) => `If every bone shows an even number, keep the ${b} bone.`, (d) => d.every((x) => x % 2 === 0), () => k);
    },
    pair() {
      return rule('different', (b) => `If exactly two bones match, keep the ${b} one.`,
        (d) => new Set(d).size === 2, (d) => d.findIndex((x) => d.filter((y) => y === x).length === 1));
    },
    highTotal(rng) {
      const n = rng.int(11, 14), k = rng.int(0, 2);
      return rule(POS[k], (b) => `If the bones add up to more than ${n}, keep the ${b} bone.`, (d) => sum(d) > n, () => k);
    },
    lowTotal(rng) {
      const n = rng.int(6, 9), k = rng.int(0, 2);
      return rule(POS[k], (b) => `If the bones add up to less than ${n}, keep the ${b} bone.`, (d) => sum(d) < n, () => k);
    },
    shows(rng) {
      const v = rng.int(1, 6);
      return rule(NUM[v], (b) => `If any bone shows ${b}, keep the leftmost bone showing it.`, (d) => d.includes(v), (d) => d.indexOf(v));
    },
  };

  function spiritRule(rng, conds) {
    const cond = rng.pick(conds);
    const hi = rng.chance(0.5);
    return rule(hi ? 'highest' : 'lowest', (b) => `If ${cond.text}, keep the bone with the ${b} number (if several tie, the leftmost of them).`,
      (d, ctx) => cond.test(ctx), (d) => d.indexOf(hi ? Math.max(...d) : Math.min(...d)));
  }

  const cast = (rng) => [rng.int(1, 6), rng.int(1, 6), rng.int(1, 6)];

  const relic = {
    id: 'knucklebones',
    title: 'Knucklebones',

    buildRules(rng, conds) {
      const set = coveredSet(rng, (r) => {
        const rules = r.sample(Object.keys(TEMPLATES), 3).map((k) => TEMPLATES[k](r));
        rules.splice(r.int(1, 3), 0, spiritRule(r, conds));
        return { rules, fallback: r.int(0, 2) };
      }, (p) => [cast(p), G.seance.generate(p)], { min: 0.04 });
      return { set };
    },

    generate(rng) { return { dice: cast(rng) }; },

    expected(state, ctx, rules) { return pickFrom(rules.set, [state.dice, ctx]); },

    inputs() { return [0, 1, 2]; },

    attempt(state, i, ctx, rules) {
      return i === relic.expected(state, ctx, rules) ? 'solved' : 'strike';
    },

    render(root, state, api) {
      const row = el('div', 'kbones');
      state.dice.forEach((v, i) => {
        const b = el('button', `kbone v${v}`);
        b.type = 'button';
        b.setAttribute('aria-label', `Keep the ${POS[i]} bone (${v})`);
        b.innerHTML = '<i></i>'.repeat(v);
        b.addEventListener('click', () => {
          if (api.solved()) return;
          api.audio.boneClatter();
          const res = api.attempt(i);
          react(b, res);
          if (res === 'solved') row.classList.add('kept-' + i);
        });
        row.appendChild(b);
      });
      root.appendChild(row);
      root.appendChild(el('p', 'relic-tip', 'Count the pips on each bone, left to right. Touch the bone to keep.'));
    },

    smudgeables(rules) {
      const s = rules.set;
      return s.rules.map((r, i) => ({ key: `r${i}`, where: `instruction ${i + 1}`, value: r.blot }))
        .concat([{ key: 'else', where: 'the last instruction', value: POS[s.fallback] }]);
    },

    manual(rules, smudge) {
      const ink = G.util.inker(smudge);
      const s = rules.set;
      return `<p class="lead">Three bones lie in a row, each carved with one to six pips. Have the Medium count them from left to right.
        Obey the <em>first</em> instruction that holds true, and keep exactly one bone.</p>
        <ol class="rules">${s.rules.map((r, i) => `<li>${r.say(ink(`r${i}`, r.blot))}</li>`).join('')}
        <li>Otherwise, keep the ${ink('else', POS[s.fallback])} bone.</li></ol>`;
    },
  };

  G.relics.knucklebones = relic;
})(globalThis.GR = globalThis.GR || {});
