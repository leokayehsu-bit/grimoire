// Haunted Dollhouse: a 3×3 grid of windows, some lit. Match the pattern in the book and knock on the right window.
(function (G) {
  'use strict';
  const { el, esc } = G.util;
  const { react } = G.kit;

  const NAMES = ['top left', 'top middle', 'top right', 'middle left', 'centre', 'middle right', 'bottom left', 'bottom middle', 'bottom right'];
  const bits = (mask) => NAMES.map((_, i) => !!(mask & (1 << i)));
  const popcount = (m) => bits(m).filter(Boolean).length;

  const relic = {
    id: 'dollhouse',
    title: 'Haunted Dollhouse',
    NAMES,

    buildRules(rng, conds) {
      const patterns = [];
      while (patterns.length < 8) {
        const m = rng.int(1, 511);
        const c = popcount(m);
        if (c >= 3 && c <= 5 && !patterns.includes(m)) patterns.push(m);
      }
      return { patterns, knock: patterns.map(() => rng.int(0, 8)), cond: rng.pick(conds) };
    },

    generate(rng, ctx, rules) {
      return { pattern: rng.int(0, rules.patterns.length - 1) };
    },

    expected(state, ctx, rules) {
      const k = rules.knock[state.pattern];
      return rules.cond.test(ctx) ? 8 - k : k;
    },

    inputs() { return NAMES.map((_, i) => i); },

    attempt(state, i, ctx, rules) {
      return i === relic.expected(state, ctx, rules) ? 'solved' : 'strike';
    },

    render(root, state, api) {
      const lit = bits(api.rules.patterns[state.pattern]);
      const house = el('div', 'dhouse');
      house.innerHTML = '<div class="dh-roof"><span class="dh-chimney"></span></div>';
      const grid = el('div', 'dh-grid');
      NAMES.forEach((name, i) => {
        const b = el('button', 'dh-win' + (lit[i] ? ' lit' : ''));
        b.type = 'button';
        b.setAttribute('aria-label', `Knock on the ${name} window (${lit[i] ? 'lit' : 'dark'})`);
        b.innerHTML = '<i></i><i></i>';
        b.addEventListener('click', () => {
          if (api.solved()) return;
          api.audio.knock(1);
          react(b, api.attempt(i));
        });
        grid.appendChild(b);
      });
      house.appendChild(grid);
      root.appendChild(house);
      root.appendChild(el('p', 'relic-tip', 'Describe which windows are lit. Touch a window to knock on it.'));
    },

    smudgeables(rules) {
      return rules.patterns.map((_, k) => ({ key: `p${k}`, where: `house ${k + 1}`, value: NAMES[rules.knock[k]] }));
    },

    manual(rules, smudge) {
      const ink = G.util.inker(smudge);
      const houses = rules.patterns.map((m, k) => {
        const cells = bits(m).map((on) => `<i class="${on ? 'on' : ''}"></i>`).join('');
        return `<figure class="mini-house"><span class="mh-no">${k + 1}</span><div class="mh-grid">${cells}</div>
          <figcaption>Knock: ${ink(`p${k}`, NAMES[rules.knock[k]])}</figcaption></figure>`;
      }).join('');
      return `<p class="lead">The dollhouse has nine windows in three rows. Have the Medium say exactly which windows are lit,
        then find the house below with the same lit windows — no more, no fewer.</p>
        <p class="lead">Knock on the window named under that house. But if <strong>${esc(rules.cond.text)}</strong>,
        knock on the window directly opposite it through the centre instead (the centre stays the centre).</p>
        <div class="mini-houses">${houses}</div>
        <p class="note">Left and right are as the Medium faces the house.</p>`;
    },
  };

  G.relics.dollhouse = relic;
})(globalThis.GR = globalThis.GR || {});
