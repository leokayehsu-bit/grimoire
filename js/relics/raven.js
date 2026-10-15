// The Raven: holds a trinket, caws 1–4 times, head tilted one way. Give it the offering the book names.
(function (G) {
  'use strict';
  const { el, title } = G.util;
  const { react, loop } = G.kit;

  const TRINKETS = { RING: '💍', KEY: '🗝️', BUTTON: '🔘', COIN: '🪙', TOOTH: '🦷' };
  const TRINKET_NAMES = Object.keys(TRINKETS);
  const OFFERINGS = ['SEED', 'SILVER', 'BREAD', 'WATER', 'FEATHER'];
  const OFFER_TEXT = { SEED: 'Scatter seed', SILVER: 'Offer silver', BREAD: 'Break bread', WATER: 'Pour water', FEATHER: 'Lay a feather' };
  const CAWS = [1, 2, 3, 4];

  const relic = {
    id: 'raven',
    title: 'The Raven',

    buildRules(rng) {
      const table = {};
      for (const t of TRINKET_NAMES) {
        table[t] = {};
        for (const c of CAWS) table[t][c] = rng.pick(OFFERINGS);
      }
      return { table, side: rng.pick(['left', 'right']) };
    },

    generate(rng) {
      return { trinket: rng.pick(TRINKET_NAMES), caws: rng.pick(CAWS), tilt: rng.pick(['left', 'right']) };
    },

    expected(state, ctx, rules) {
      const c = state.tilt === rules.side ? (state.caws % 4) + 1 : state.caws;
      return rules.table[state.trinket][c];
    },

    inputs() { return OFFERINGS; },

    attempt(state, o, ctx, rules) {
      return o === relic.expected(state, ctx, rules) ? 'solved' : 'strike';
    },

    render(root, state, api) {
      const scene = el('div', 'raven-scene');
      scene.innerHTML = `<div class="raven tilt-${state.tilt}">
          <svg viewBox="0 0 120 110" aria-hidden="true">
            <path class="r-body" d="M30 70 Q40 40 70 42 Q96 46 100 80 L112 104 L84 92 Q60 98 40 90 Z"/>
            <g class="r-head"><circle class="r-body" cx="46" cy="38" r="17"/>
              <path class="r-beak" d="M30 36 L8 42 L31 45 Z"/><circle class="r-eye" cx="42" cy="34" r="3.2"/></g>
            <path class="r-leg" d="M58 92 L56 104 M72 93 L74 104"/>
          </svg>
          <span class="trinket">${TRINKETS[state.trinket]}</span>
        </div><div class="caw" aria-live="polite"></div>`;
      const caw = scene.querySelector('.caw');
      const acts = el('div', 'raven-acts');
      for (const o of OFFERINGS) {
        const b = el('button', 'btn small', OFFER_TEXT[o]);
        b.type = 'button';
        b.addEventListener('click', () => {
          if (api.solved()) return;
          react(scene, api.attempt(o));
        });
        acts.appendChild(b);
      }
      root.append(scene, acts);
      root.appendChild(el('p', 'relic-tip', 'Count its caws, name its trinket, and say which way its head tilts.'));

      let k = 0;
      const call = (later) => {
        if (api.solved()) { caw.textContent = ''; return; }
        if (k < state.caws) {
          k++;
          caw.textContent = 'CAW!';
          caw.classList.remove('pop');
          void caw.offsetWidth;
          caw.classList.add('pop');
          api.audio.caw();
          later(() => { caw.textContent = ''; later(call, 350); }, 550);
        } else {
          k = 0;
          later(call, 5500);
        }
      };
      const l = loop(call, 1000);
      return { destroy: l.stop };
    },

    smudgeables(rules) {
      const out = [];
      for (const t of TRINKET_NAMES) for (const c of CAWS) out.push({ key: `${t}.${c}`, where: `${title(t)}, ${c} caw${c > 1 ? 's' : ''}`, value: OFFER_TEXT[rules.table[t][c]] });
      return out;
    },

    manual(rules, smudge) {
      const ink = G.util.inker(smudge);
      const rows = TRINKET_NAMES.map((t) => [`${TRINKETS[t]} ${title(t)}`].concat(CAWS.map((c) => ink(`${t}.${c}`, OFFER_TEXT[rules.table[t][c]]))));
      return `<p class="lead">The raven holds a trinket and caws a few times, then falls silent and caws again.
        Have the Medium count the caws in one round and name the trinket.</p>
        <p class="lead">If its head is tilted to the <b>${rules.side}</b> (as the Medium sees it), count one caw more than it gave — after four comes one.</p>
        ${G.kit.table(['Trinket', '1 caw', '2 caws', '3 caws', '4 caws'], rows)}`;
    },
  };

  G.relics.raven = relic;
})(globalThis.GR = globalThis.GR || {});
