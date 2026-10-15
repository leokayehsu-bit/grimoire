// Apothecary Shelf: six labelled jars. Add two ingredients, in order: the first from the moon's list,
// the second found by stepping along the shelf.
(function (G) {
  'use strict';
  const { el, esc, title } = G.util;
  const { react } = G.kit;

  const HERBS = ['WORMWOOD', 'NIGHTSHADE', 'MANDRAKE', 'RUE', 'YARROW', 'HEMLOCK', 'VERVAIN', 'MUGWORT', 'ANGELICA', 'SAGE'];
  const LIQUIDS = ['AMBER', 'GREEN', 'RED', 'BLUE', 'BLACK'];
  const LIQUID_CSS = { AMBER: '#d08a2a', GREEN: '#3f8a4a', RED: '#9a2230', BLUE: '#2f5f9e', BLACK: '#1a161f' };
  const MOONS = ['NEW', 'WAXING', 'FULL', 'WANING'];

  // The two jars to add, as shelf positions.
  function recipe(state, ctx, rules) {
    const shelf = state.jars.map((j) => j.herb);
    const list = rules.lists[ctx.moon];
    const hit = list.find((h) => shelf.includes(h));
    const first = hit ? shelf.indexOf(hit) : 0;
    const dir = rules.cond.test(ctx) ? rules.dir : -rules.dir;
    const steps = state.jars[first].liquid === rules.skipLiquid ? 2 : 1;
    return [first, (first + dir * steps + 60) % 6];
  }

  const relic = {
    id: 'apothecary',
    title: 'Apothecary Shelf',

    buildRules(rng, conds) {
      const lists = {};
      for (const m of MOONS) lists[m] = rng.sample(HERBS, 4);
      return { lists, cond: rng.pick(conds), dir: rng.pick([1, -1]), skipLiquid: rng.pick(LIQUIDS) };
    },

    generate(rng) {
      return { jars: rng.sample(HERBS, 6).map((herb) => ({ herb, liquid: rng.pick(LIQUIDS) })), added: [] };
    },

    expected(state, ctx, rules) { return recipe(state, ctx, rules)[state.added.length]; },

    inputs(state) { return [0, 1, 2, 3, 4, 5].filter((i) => !state.added.includes(i)); },

    attempt(state, i, ctx, rules) {
      if (i !== relic.expected(state, ctx, rules)) {
        state.added = [];
        return 'strike';
      }
      state.added.push(i);
      return state.added.length === 2 ? 'solved' : 'ok';
    },

    render(root, state, api) {
      const shelf = el('div', 'shelf');
      const btns = state.jars.map((j, i) => {
        const b = el('button', 'jar');
        b.type = 'button';
        b.style.setProperty('--liquid', LIQUID_CSS[j.liquid]);
        b.innerHTML = `<span class="jar-lid"></span><span class="jar-body"><span class="jar-fill"></span><span class="jar-label">${title(j.herb)}</span></span>`;
        b.addEventListener('click', () => {
          if (api.solved() || state.added.includes(i)) return;
          const res = api.attempt(i);
          react(b, res);
          draw();
        });
        shelf.appendChild(b);
        return b;
      });
      const draw = () => btns.forEach((b, i) => b.classList.toggle('added', state.added.includes(i)));
      root.appendChild(shelf);
      root.appendChild(el('p', 'relic-tip', 'Read each label and liquid colour, left to right. Touch jars to add them — order matters.'));
    },

    smudgeables(rules) {
      const out = [];
      for (const m of MOONS) rules.lists[m].forEach((h, k) => out.push({ key: `${m}.${k}`, where: `herb ${k + 1} for a ${title(m)} moon`, value: title(h) }));
      out.push({ key: 'skip', where: 'the liquid that makes you skip a jar', value: title(rules.skipLiquid).toLowerCase() });
      return out;
    },

    manual(rules, smudge) {
      const ink = G.util.inker(smudge);
      const rows = MOONS.map((m) => [`${G.seance.moonSVG(m, 22)} ${title(m)}`].concat(rules.lists[m].map((h, k) => ink(`${m}.${k}`, title(h)))));
      const way = rules.dir === 1 ? 'right' : 'left', other = rules.dir === 1 ? 'left' : 'right';
      return `<p class="lead">Six labelled jars stand on the shelf. Add exactly two of them, one after the other.
        A wrong jar is an offense and spoils the mixture — start again from the first.</p>
        <h3>The first ingredient</h3>
        <p>Find the moon's phase below and read its herbs from left to right. Add the first of them that is on the shelf.
        If none of them are, add the leftmost jar.</p>
        ${G.kit.table(['Moon', '1st', '2nd', '3rd', '4th'], rows)}
        <h3>The second ingredient</h3>
        <p>If <strong>${esc(rules.cond.text)}</strong>, step to the <b>${way}</b> along the shelf from the first jar; otherwise step to the ${other}.
        Add the next jar that way — or skip one more jar if the first jar's liquid is ${ink('skip', title(rules.skipLiquid).toLowerCase())}.
        Past the end of the shelf, carry on from the other end.</p>`;
    },
  };

  G.relics.apothecary = relic;
})(globalThis.GR = globalThis.GR || {});
