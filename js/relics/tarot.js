// Tarot Spread: three cards, some reversed. Work out which one to burn.
(function (G) {
  'use strict';
  const { el, esc, title } = G.util;

  const CARDS = [
    { name: 'THE LANTERN', glyph: '🏮' }, { name: 'THE DROWNED MAN', glyph: '🌊' },
    { name: 'THE CROW', glyph: '🪶' }, { name: 'THE WIDOW', glyph: '🕸️' },
    { name: 'THE HOLLOW TREE', glyph: '🌳' }, { name: 'THE BELL', glyph: '🔔' },
    { name: 'THE TWINS', glyph: '👥' }, { name: 'THE WOLF', glyph: '🐺' },
    { name: 'THE MIRROR', glyph: '🪞' }, { name: 'THE GRAVEDIGGER', glyph: '⚰️' },
    { name: 'THE SPINDLE', glyph: '🧵' }, { name: 'THE JESTER', glyph: '🃏' },
  ];
  const POS = ['left', 'middle', 'right'];

  const MODIFIERS = [
    { text: 'the number of bone charms hanging above the table', val: (c) => c.bones },
    { text: 'the last digit of the year the spirit died', val: (c) => c.deathYear % 10 },
    { text: "the number of vowels in the spirit's name", val: (c) => G.seance.vowels(c.name) },
    { text: 'the number of sigils carved into the table', val: (c) => c.sigils.length },
  ];

  function total(state, ctx, rules) {
    let t = 0;
    for (const c of state.cards) t += rules.values[c.name] * (c.reversed ? -1 : 1);
    return t + rules.mod.val(ctx);
  }

  const relic = {
    id: 'tarot',
    title: 'Tarot Spread',
    CARDS,

    buildRules(rng) {
      const values = {};
      for (const c of CARDS) values[c.name] = rng.int(1, 9);
      return { values, mod: rng.pick(MODIFIERS), order: rng.shuffle([0, 1, 2]) };
    },

    generate(rng) {
      return {
        cards: rng.sample(CARDS, 3).map((c) => ({ name: c.name, reversed: rng.chance(0.4) })),
        burned: -1,
      };
    },

    expected(state, ctx, rules) {
      const t = total(state, ctx, rules);
      return rules.order[((t % 3) + 3) % 3];
    },

    inputs() {
      return [0, 1, 2];
    },

    attempt(state, i, ctx, rules) {
      if (i !== relic.expected(state, ctx, rules)) return 'strike';
      state.burned = i;
      return 'solved';
    },

    render(root, state, api) {
      const row = el('div', 'tarot-row');
      state.cards.forEach((card, i) => {
        const def = CARDS.find((c) => c.name === card.name);
        const b = el('button', 'tarot-card' + (card.reversed ? ' reversed' : ''));
        b.type = 'button';
        b.innerHTML = `<span class="inner"><span class="art">${def.glyph}</span><span class="name">${title(card.name)}</span></span>`;
        b.addEventListener('click', () => {
          if (api.solved()) return;
          const res = api.attempt(i);
          b.classList.remove('wrong');
          void b.offsetWidth;
          b.classList.add(res === 'solved' ? 'burn' : 'wrong');
        });
        row.appendChild(b);
      });
      root.appendChild(row);
      root.appendChild(el('p', 'relic-tip', 'Touch a card to burn it.'));
    },

    manual(rules) {
      const result = [0, 1, 2].map((r) => `<li>${r} — burn the <b>${POS[rules.order[r]]}</b> card</li>`).join('');
      const half = Math.ceil(CARDS.length / 2);
      const rowsHtml = CARDS.slice(0, half).map((c, k) => {
        const d = CARDS[k + half];
        return `<tr><td>${c.glyph} ${title(c.name)}</td><td class="num">${rules.values[c.name]}</td>` +
          (d ? `<td>${d.glyph} ${title(d.name)}</td><td class="num">${rules.values[d.name]}</td>` : '<td></td><td></td>') + '</tr>';
      }).join('');
      return `<p class="lead">Three cards lie face up. A card that appears upside down is <em>reversed</em>. Burn exactly one.</p>
        <ol class="rules">
          <li>Find each card's value below. Add the values of upright cards and <em>subtract</em> the values of reversed cards.</li>
          <li>Add ${esc(rules.mod.text)}.</li>
          <li>Divide by 3 and keep the remainder. If the total is below zero, add 3 until it is 0, 1 or 2.</li>
          <li>Then by the remainder:<ul class="plain">${result}</ul></li>
        </ol>
        <table class="grid"><thead><tr><th>Card</th><th>Value</th><th>Card</th><th>Value</th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
    },
  };

  G.relics.tarot = relic;
})(globalThis.GR = globalThis.GR || {});
