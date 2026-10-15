// Haunted Mirror: a word written backwards in the fog. Touch the right part of the reflection.
(function (G) {
  'use strict';
  const { el, esc } = G.util;
  const { react } = G.kit;

  const WORDS = ['BEHIND', 'LEAVE', 'MINE', 'HELP', 'AWAKE', 'NEVER', 'ALONE', 'RUN', 'SORRY', 'STAY', 'WHO', 'LIAR', 'OPEN', 'DROWN', 'BURN', 'LOOK'];
  const POINTS = ['FOREHEAD', 'LEFT EYE', 'RIGHT EYE', 'MOUTH'];
  const OPPOSITE = { FOREHEAD: 'MOUTH', MOUTH: 'FOREHEAD', 'LEFT EYE': 'RIGHT EYE', 'RIGHT EYE': 'LEFT EYE' };
  const label = (p) => p.charAt(0) + p.slice(1).toLowerCase();

  const relic = {
    id: 'mirror',
    title: 'Haunted Mirror',

    buildRules(rng, conds) {
      const words = rng.sample(WORDS, 10).sort();
      const table = {};
      for (const w of words) {
        const [lamp, moon] = rng.sample(POINTS, 2);
        table[w] = { lamp, moon };
      }
      return { words, table, cond: rng.pick(conds) };
    },

    generate(rng, ctx, rules) {
      return { word: rng.pick(rules.words), cracked: rng.chance(0.5) };
    },

    expected(state, ctx, rules) {
      const row = rules.table[state.word];
      const p = rules.cond.test(ctx) ? row.lamp : row.moon;
      return state.cracked ? OPPOSITE[p] : p;
    },

    inputs() { return POINTS; },

    attempt(state, p, ctx, rules) {
      return p === relic.expected(state, ctx, rules) ? 'solved' : 'strike';
    },

    render(root, state, api) {
      const frame = el('div', 'mirror' + (state.cracked ? ' cracked' : ''));
      frame.innerHTML = `<div class="glass">
          <span class="fog">${esc(state.word)}</span>
          <svg class="face" viewBox="0 0 100 120" aria-hidden="true">
            <ellipse cx="50" cy="62" rx="30" ry="38" class="f-head"/>
            <ellipse cx="38" cy="58" rx="6" ry="4" class="f-eye"/><ellipse cx="62" cy="58" rx="6" ry="4" class="f-eye"/>
            <path d="M40 82 Q50 86 60 82" class="f-mouth"/>
          </svg>
          ${state.cracked ? '<svg class="crack" viewBox="0 0 100 140" aria-hidden="true"><path d="M70 0 L62 30 L74 46 L58 70 L66 92 L52 140 M62 30 L48 36 M58 70 L80 78"/></svg>' : ''}
        </div>`;
      const acts = el('div', 'mirror-acts');
      for (const p of POINTS) {
        const b = el('button', 'btn small', 'Touch the ' + label(p).toLowerCase());
        b.type = 'button';
        b.addEventListener('click', () => {
          if (api.solved()) return;
          react(frame, api.attempt(p));
        });
        acts.appendChild(b);
      }
      root.append(frame, acts);
      root.appendChild(el('p', 'relic-tip', 'Read the fogged word letter by letter. Is the glass cracked?'));
    },

    smudgeables(rules) {
      const out = [];
      for (const w of rules.words) {
        out.push({ key: `${w}.lamp`, where: `the Lamplight touch for ${w}`, value: label(rules.table[w].lamp) });
        out.push({ key: `${w}.moon`, where: `the Moonlight touch for ${w}`, value: label(rules.table[w].moon) });
      }
      return out;
    },

    manual(rules, smudge) {
      const ink = G.util.inker(smudge);
      const rows = rules.words.map((w) => [w, ink(`${w}.lamp`, label(rules.table[w].lamp)), ink(`${w}.moon`, label(rules.table[w].moon))]);
      return `<p class="lead">A word is written in the mirror's fog — <em>backwards</em>, as if from the other side of the glass.
        Have the Medium spell it out, then find it below.</p>
        <p class="lead">If <strong>${esc(rules.cond.text)}</strong>, read the Lamplight column. Otherwise, read the Moonlight column.</p>
        <p class="lead">If the glass is <b>cracked</b>, touch the opposite part instead: forehead and mouth swap, left eye and right eye swap.</p>
        ${G.kit.table(['The word', 'Lamplight', 'Moonlight'], rows)}
        <p class="note">Left and right are as the Medium sees the reflection.</p>`;
    },
  };

  G.relics.mirror = relic;
})(globalThis.GR = globalThis.GR || {});
