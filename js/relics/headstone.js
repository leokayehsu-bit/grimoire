// Weathered Headstone: an epitaph from the book with one word changed. Chisel away the wrong word.
(function (G) {
  'use strict';
  const { el, esc } = G.util;
  const { react } = G.kit;

  // Four words each. Any two share at most one word in the same position, so one changed word never
  // makes an epitaph look like a different one.
  const EPITAPHS = [
    'GONE BUT NOT FORGOTTEN', 'ASLEEP IN THE LORD', 'REST NOW WEARY TRAVELLER', 'HER LIGHT STILL BURNS',
    'THE SEA KEPT HIM', 'WAIT FOR ME HERE', 'TAKEN TOO SOON BELOVED', 'WE SHALL MEET AGAIN',
    'SHE WALKS THESE HALLS', 'DO NOT DIG HERE', 'ONE BELL TOLLS ONCE', 'HE NEVER CAME HOME',
    'FORGIVE WHAT WE BURIED', 'SLEEP SOFTLY LITTLE ONE',
  ].map((e) => e.split(' '));
  const WRONG = ['MOTHER', 'CANDLE', 'RAVEN', 'SILVER', 'WINTER', 'ASHES', 'LANTERN', 'GARDEN', 'WIDOW', 'SEVEN', 'STONE', 'HOLLOW'];
  const POS = ['first', 'second', 'third', 'fourth'];

  const relic = {
    id: 'headstone',
    title: 'Weathered Headstone',
    EPITAPHS,

    buildRules(rng, conds) {
      const picks = rng.sample(EPITAPHS.map((_, i) => i), 8).sort((a, b) => a - b);
      return { epitaphs: picks.map((i) => EPITAPHS[i].slice()), cond: rng.pick(conds) };
    },

    generate(rng, ctx, rules) {
      const e = rng.int(0, rules.epitaphs.length - 1), pos = rng.int(0, 3);
      const words = rules.epitaphs[e].slice();
      words[pos] = rng.pick(WRONG.filter((w) => w !== words[pos]));
      return { words, epitaph: e, pos };
    },

    expected(state, ctx, rules) {
      return rules.cond.test(ctx) ? (state.pos + 1) % 4 : state.pos;
    },

    inputs() { return [0, 1, 2, 3]; },

    attempt(state, i, ctx, rules) {
      return i === relic.expected(state, ctx, rules) ? 'solved' : 'strike';
    },

    render(root, state, api) {
      const stone = el('div', 'headstone');
      stone.appendChild(el('span', 'hs-cross', '✝︎'));
      state.words.forEach((w, i) => {
        const b = el('button', 'hs-word', w);
        b.type = 'button';
        b.addEventListener('click', () => {
          if (api.solved()) return;
          api.audio.scrape();
          const res = api.attempt(i);
          react(b, res);
          if (res === 'solved') b.classList.add('chiselled');
        });
        stone.appendChild(b);
      });
      root.appendChild(stone);
      root.appendChild(el('p', 'relic-tip', 'Read the epitaph aloud. Touch a word to chisel it away.'));
    },

    smudgeables(rules) {
      const out = [];
      rules.epitaphs.forEach((words, e) => words.forEach((w, j) => out.push({ key: `${e}.${j}`, where: `the ${POS[j]} word of epitaph ${e + 1}`, value: w })));
      return out;
    },

    manual(rules, smudge) {
      const ink = G.util.inker(smudge);
      const list = rules.epitaphs.map((words, e) => `<li class="epitaph">${words.map((w, j) => ink(`${e}.${j}`, w)).join(' ')}</li>`).join('');
      return `<p class="lead">The headstone bears a four-word epitaph — one of those below, but with exactly one word changed.
        Have the Medium read it, find the true epitaph, and work out which word is wrong.</p>
        <p class="lead">Chisel away the wrong word. But if <strong>${esc(rules.cond.text)}</strong>, the stone lies:
        chisel the word <em>after</em> the wrong one instead (after the fourth word comes the first).</p>
        <ol class="epitaphs">${list}</ol>`;
    },
  };

  G.relics.headstone = relic;
})(globalThis.GR = globalThis.GR || {});
