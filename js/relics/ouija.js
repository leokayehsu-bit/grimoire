// Spirit Board: the planchette spells a word on its own. Answer it on the board.
(function (G) {
  'use strict';
  const { el, esc } = G.util;

  // Look-alike and sound-alike words force the Medium to spell, not just say, the word.
  const PAIRS = [
    ['MOURN', 'MORN'], ['KNIGHT', 'NIGHT'], ['WHOLE', 'HOLE'], ['HOLLOW', 'HALLOW'],
    ['BELOW', 'BELLOW'], ['WIDOW', 'WINDOW'], ['CELLAR', 'SELLER'], ['RAVEN', 'RAVINE'],
    ['MOTHER', 'SMOTHER'], ['WEEP', 'SLEEP'], ['BONES', 'STONES'], ['CANDLE', 'HANDLE'],
  ];
  const SINGLES = [
    'GRAVE', 'COFFIN', 'ASHES', 'HUNGER', 'DOOR', 'BURIED', 'COLD', 'LANTERN',
    'SEVEN', 'THIRTEEN', 'WATER', 'CHAPEL', 'FOREVER', 'LISTEN', 'BEHIND', 'RETURN',
  ];
  const WORDS = ['YES', 'NO', 'GOODBYE'];
  const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  const ANSWERS = WORDS.concat(DIGITS);
  const label = (a) => (a.length > 1 ? G.util.title(a) : a);

  function pickAnswer(rng) {
    return rng.chance(0.4) ? rng.pick(WORDS) : rng.pick(DIGITS);
  }

  const relic = {
    id: 'ouija',
    title: 'Spirit Board',
    ANSWERS,

    buildRules(rng, conds) {
      const words = [...rng.sample(PAIRS, 4).flat(), ...rng.sample(SINGLES, 6)].sort();
      const table = {};
      for (const w of words) {
        const dusk = pickAnswer(rng);
        let dawn = pickAnswer(rng);
        while (dawn === dusk) dawn = pickAnswer(rng);
        table[w] = { dusk, dawn };
      }
      return { words, table, cond: rng.pick(conds) };
    },

    generate(rng, ctx, rules) {
      return { word: rng.pick(rules.words), answered: null };
    },

    expected(state, ctx, rules) {
      const row = rules.table[state.word];
      return rules.cond.test(ctx) ? row.dusk : row.dawn;
    },

    inputs() {
      return ANSWERS;
    },

    attempt(state, ans, ctx, rules) {
      if (ans !== relic.expected(state, ctx, rules)) return 'strike';
      state.answered = ans;
      return 'solved';
    },

    render(root, state, api) {
      let dead = false, timer = null;
      const board = el('div', 'ouija');
      const answerBtn = (a, cls) => {
        const b = el('button', 'o-ans ' + (cls || ''), label(a));
        b.type = 'button';
        b.dataset.ans = a;
        b.addEventListener('click', () => {
          if (api.solved()) return;
          const res = api.attempt(a);
          b.classList.remove('wrong', 'right');
          void b.offsetWidth;
          b.classList.add(res === 'solved' ? 'right' : 'wrong');
          if (res === 'solved') stop(true);
        });
        return b;
      };

      const top = el('div', 'o-top');
      const rest = el('span', 'o-rest', '☾');
      top.append(answerBtn('YES', 'o-yes'), rest, answerBtn('NO', 'o-no'));
      board.appendChild(top);

      const letters = {};
      for (const row of ['ABCDEFGHIJKLM', 'NOPQRSTUVWXYZ']) {
        const r = el('div', 'o-row');
        for (const ch of row) {
          const s = el('span', 'o-ch', ch);
          letters[ch] = s;
          r.appendChild(s);
        }
        board.appendChild(r);
      }
      const digits = el('div', 'o-row o-digits');
      for (const d of DIGITS) digits.appendChild(answerBtn(d, 'o-digit'));
      board.appendChild(digits);
      const bottom = el('div', 'o-bottom');
      bottom.appendChild(answerBtn('GOODBYE', 'o-bye'));
      board.appendChild(bottom);

      const planchette = el('div', 'planchette');
      planchette.innerHTML = '<span class="lens"></span>';
      board.appendChild(planchette);
      root.appendChild(board);
      root.appendChild(el('p', 'relic-tip', 'Watch the planchette. Answer by touching Yes, No, Goodbye or a number.'));

      const moveTo = (target) => {
        const br = board.getBoundingClientRect(), tr = target.getBoundingClientRect();
        if (!br.width) return;
        planchette.style.left = (tr.left - br.left + tr.width / 2) + 'px';
        planchette.style.top = (tr.top - br.top + tr.height / 2) + 'px';
      };
      let lit = null;
      const unlight = () => { if (lit) lit.classList.remove('lit'); lit = null; };

      let i = 0;
      const step = () => {
        if (dead) return;
        unlight();
        if (i < state.word.length) {
          const target = letters[state.word[i++]];
          planchette.classList.remove('lift');
          moveTo(target);
          timer = setTimeout(() => {
            if (dead) return;
            lit = target;
            target.classList.add('lit');
            api.audio.scrape();
            // Hold on the letter, then lift so a doubled letter is visibly touched twice.
            timer = setTimeout(() => {
              if (dead) return;
              unlight();
              planchette.classList.add('lift');
              timer = setTimeout(step, 320);
            }, 900);
          }, 620);
        } else {
          i = 0;
          planchette.classList.remove('lift');
          moveTo(rest);
          timer = setTimeout(step, 2600);
        }
      };

      function stop(solved) {
        dead = true;
        clearTimeout(timer);
        unlight();
        if (solved) {
          planchette.classList.remove('lift');
          moveTo(rest);
        }
      }

      requestAnimationFrame(() => { moveTo(rest); timer = setTimeout(step, 900); });
      return { destroy: () => stop(false) };
    },

    smudgeables(rules) {
      return rules.words.flatMap((w) => ['dusk', 'dawn'].map((col) => ({
        key: `${w}.${col}`, where: `the ${col === 'dusk' ? 'Dusk' : 'Dawn'} answer for ${w}`, value: label(rules.table[w][col]),
      })));
    },

    manual(rules, smudge) {
      const ink = G.util.inker(smudge);
      let html = `<p class="lead">The planchette moves on its own. It spells one word letter by letter, rests beneath the moon, then spells it again.
        It lifts briefly between letters, so a doubled letter is touched twice.</p>
        <p class="lead">If <strong>${esc(rules.cond.text)}</strong>, answer from the <b>Dusk</b> column. Otherwise, answer from the <b>Dawn</b> column.
        The Medium answers by touching that word or number on the board.</p>
        <table class="grid"><thead><tr><th>The word</th><th>Dusk</th><th>Dawn</th></tr></thead><tbody>`;
      for (const w of rules.words) {
        const r = rules.table[w];
        html += `<tr><td class="word">${w}</td><td>${ink(`${w}.dusk`, label(r.dusk))}</td><td>${ink(`${w}.dawn`, label(r.dawn))}</td></tr>`;
      }
      html += '</tbody></table><p class="note">Some words look alike. Have the Medium spell every letter.</p>';
      return html;
    },
  };

  G.relics.ouija = relic;
})(globalThis.GR = globalThis.GR || {});
