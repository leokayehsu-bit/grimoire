// Locked Diary: three symbols on the cover set a three-dial combination.
(function (G) {
  'use strict';
  const { el, esc, title } = G.util;
  const { react } = G.kit;

  const SYMBOLS = [
    { name: 'STAR', glyph: '✶' }, { name: 'MOON', glyph: '☾' }, { name: 'SUN', glyph: '☀︎' },
    { name: 'CROSS', glyph: '✝︎' }, { name: 'SKULL', glyph: '☠︎' }, { name: 'URN', glyph: '⚱︎' },
    { name: 'FLOWER', glyph: '⚘︎' }, { name: 'SWORDS', glyph: '⚔︎' }, { name: 'ANCHOR', glyph: '⚓︎' },
    { name: 'SCALES', glyph: '⚖︎' },
  ];
  const glyph = (n) => SYMBOLS.find((s) => s.name === n).glyph;
  const WORD = ['once', 'twice', 'three'];

  const relic = {
    id: 'diary',
    title: 'Locked Diary',
    SYMBOLS,

    buildRules(rng, conds) {
      const digits = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const digit = {};
      SYMBOLS.forEach((s, i) => { digit[s.name] = digits[i]; });
      return { digit, cond: rng.pick(conds), shift: rng.int(1, 3) };
    },

    generate(rng) {
      return { symbols: rng.sample(SYMBOLS, 3).map((s) => s.name) };
    },

    expected(state, ctx, rules) {
      const add = rules.cond.test(ctx) ? rules.shift : 0;
      return state.symbols.map((s) => (rules.digit[s] + add) % 10).join('');
    },

    inputs() {
      return Array.from({ length: 1000 }, (_, i) => String(i).padStart(3, '0'));
    },

    attempt(state, code, ctx, rules) {
      return code === relic.expected(state, ctx, rules) ? 'solved' : 'strike';
    },

    render(root, state, api) {
      const book = el('div', 'diary');
      const cover = el('div', 'diary-cover');
      cover.innerHTML = state.symbols.map((s) => `<span class="dsym">${glyph(s)}</span>`).join('');
      const dials = el('div', 'diary-dials');
      const vals = [0, 0, 0];
      const shows = vals.map((_, k) => {
        const d = el('div', 'dial');
        const up = el('button', 'dial-btn', '▲'), dn = el('button', 'dial-btn', '▼'), v = el('span', 'dial-val', '0');
        up.type = dn.type = 'button';
        up.setAttribute('aria-label', `Dial ${k + 1} up`);
        dn.setAttribute('aria-label', `Dial ${k + 1} down`);
        up.addEventListener('click', () => { vals[k] = (vals[k] + 1) % 10; v.textContent = vals[k]; api.audio.scrape(); });
        dn.addEventListener('click', () => { vals[k] = (vals[k] + 9) % 10; v.textContent = vals[k]; api.audio.scrape(); });
        d.append(up, v, dn);
        dials.appendChild(d);
        return v;
      });
      const key = el('button', 'btn small diary-key', '🗝 Turn the key');
      key.type = 'button';
      key.addEventListener('click', () => {
        if (api.solved()) return;
        const res = api.attempt(vals.join(''));
        react(book, res);
        if (res === 'solved') book.classList.add('open');
      });
      book.append(cover, dials, key);
      root.appendChild(book);
      root.appendChild(el('p', 'relic-tip', 'Describe the symbols on the cover. Set the dials, then turn the key.'));
      void shows;
    },

    smudgeables(rules) {
      return SYMBOLS.map((s) => ({ key: s.name, where: `the number for the ${title(s.name)}`, value: String(rules.digit[s.name]) }));
    },

    manual(rules, smudge) {
      const ink = G.util.inker(smudge);
      const half = SYMBOLS.length / 2;
      const rows = SYMBOLS.slice(0, half).map((s, k) => {
        const t = SYMBOLS[k + half];
        return [`<span class="g">${s.glyph}</span> ${title(s.name)}`, ink(s.name, String(rules.digit[s.name])),
          `<span class="g">${t.glyph}</span> ${title(t.name)}`, ink(t.name, String(rules.digit[t.name]))];
      });
      return `<p class="lead">Three symbols are pressed into the diary's leather cover, read from left to right.
        Each symbol gives one number of the lock's combination, in the same order.</p>
        <p class="lead">If <strong>${esc(rules.cond.text)}</strong>, add ${rules.shift} to every number, counting on from 9 back round to 0.
        Then set the three dials and turn the key.</p>
        ${G.kit.table(['Symbol', 'Number', 'Symbol', 'Number'], rows)}
        <p class="note">Every wrong combination is an offense. The diary only opens ${WORD[0]}.</p>`;
    },
  };

  G.relics.diary = relic;
})(globalThis.GR = globalThis.GR || {});
