// Spirit Bell: tolls 2–6 times on its own. Look up its ribbon and the toll count, and ring it back.
(function (G) {
  'use strict';
  const { el, esc, title } = G.util;
  const { react, loop } = G.kit;

  const RIBBONS = ['WHITE', 'BLACK', 'RED', 'BLUE', 'GOLD'];
  const RIBBON_CSS = { WHITE: '#ece4d2', BLACK: '#222', RED: '#a3262a', BLUE: '#2f5fa8', GOLD: '#c9a13a' };
  const TOLLS = [2, 3, 4, 5, 6];
  const TIMES = ['', 'once', 'twice', 'three times', 'four times', 'five times'];

  const relic = {
    id: 'bell',
    title: 'Spirit Bell',

    buildRules(rng, conds) {
      const table = {};
      for (const r of RIBBONS) {
        table[r] = {};
        for (const t of TOLLS) table[r][t] = rng.int(1, 5);
      }
      return { table, cond: rng.pick(conds) };
    },

    generate(rng) {
      return { ribbon: rng.pick(RIBBONS), tolls: rng.pick(TOLLS) };
    },

    expected(state, ctx, rules) {
      const n = rules.table[state.ribbon][state.tolls];
      return rules.cond.test(ctx) ? Math.max(1, n - 1) : n;
    },

    inputs() { return [1, 2, 3, 4, 5]; },

    attempt(state, n, ctx, rules) {
      return n === relic.expected(state, ctx, rules) ? 'solved' : 'strike';
    },

    render(root, state, api) {
      const wrap = el('div', 'bell-wrap');
      const bell = el('div', 'bell');
      bell.innerHTML = `<span class="bell-body">🔔</span><span class="bell-ribbon" style="--rib:${RIBBON_CSS[state.ribbon]}"></span>`;
      const listen = el('button', 'btn small', 'Listen again');
      listen.type = 'button';
      const acts = el('div', 'bell-acts');
      for (let n = 1; n <= 5; n++) {
        const b = el('button', 'btn small', `Ring ${TIMES[n]}`);
        b.type = 'button';
        b.addEventListener('click', () => {
          if (api.solved()) return;
          for (let k = 0; k < n; k++) setTimeout(() => api.audio.bell(0.6), k * 260);
          react(wrap, api.attempt(n));
        });
        acts.appendChild(b);
      }
      wrap.append(bell, listen, acts);
      root.appendChild(wrap);
      root.appendChild(el('p', 'relic-tip', 'Count the tolls and note the ribbon. Then ring it back.'));

      // Toll the count, pause, repeat — each toll swings the bell.
      let k = 0;
      const toll = (later) => {
        if (api.solved()) return;
        if (k < state.tolls) {
          k++;
          bell.classList.remove('swing');
          void bell.offsetWidth;
          bell.classList.add('swing');
          api.audio.bell(1);
          later(toll, 900);
        } else {
          k = 0;
          later(toll, 6000);
        }
      };
      const l = loop(toll, 1200);
      listen.addEventListener('click', () => { k = 0; l.later(() => toll(l.later), 300); });
      return { destroy: l.stop };
    },

    smudgeables(rules) {
      const out = [];
      for (const r of RIBBONS) for (const t of TOLLS) out.push({ key: `${r}.${t}`, where: `${title(r)} ribbon, ${t} tolls`, value: String(rules.table[r][t]) });
      return out;
    },

    manual(rules, smudge) {
      const ink = G.util.inker(smudge);
      const rows = RIBBONS.map((r) => [`<span class="swatch" style="background:${RIBBON_CSS[r]}"></span> ${title(r)}`]
        .concat(TOLLS.map((t) => ink(`${r}.${t}`, String(rules.table[r][t])))));
      return `<p class="lead">The bell tolls on its own, pauses, and tolls again. Have the Medium count the tolls in one round
        and name the colour of its ribbon. The table says how many times to ring it back.</p>
        <p class="lead">If <strong>${esc(rules.cond.text)}</strong>, ring one time fewer — but always at least once.</p>
        ${G.kit.table(['Ribbon'].concat(TOLLS.map((t) => `${t} tolls`)), rows)}`;
    },
  };

  G.relics.bell = relic;
})(globalThis.GR = globalThis.GR || {});
