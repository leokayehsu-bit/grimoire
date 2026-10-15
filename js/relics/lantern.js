// Guttering Lantern: a needy relic. Every so often its flame turns a strange colour; tend it within the window.
(function (G) {
  'use strict';
  const { title } = G.util;
  const { needy } = G.kit;

  const FLAMES = ['GREEN', 'BLUE', 'RED', 'WHITE'];
  const FLAME_CSS = { GREEN: '#5fe08a', BLUE: '#6aa8ff', RED: '#ff5a4a', WHITE: '#f4f1ff' };
  const SHUTTERS = ['open', 'closed'];
  const ACTIONS = ['TRIM', 'SHIELD', 'OIL', 'KEY', 'TAP'];
  const ACTION_TEXT = { TRIM: 'Trim the wick', SHIELD: 'Cup the flame', OIL: 'Pour in oil', KEY: 'Wind the key', TAP: 'Tap the glass' };

  const relic = {
    id: 'lantern',
    title: 'Guttering Lantern',
    needy: true,
    WINDOW: needy.WINDOW, QUIET: needy.QUIET, ACTIONS,

    buildRules(rng) {
      const table = {};
      for (const f of FLAMES) {
        const [open, closed] = rng.sample(ACTIONS, 2);
        table[f] = { open, closed };
      }
      return { table };
    },

    generate(rng) {
      return needy.generate(rng, (r, k, prev) => {
        let flame;
        do flame = r.pick(FLAMES); while (prev && flame === prev.flame && r.chance(0.7));
        return { flame, shutters: r.pick(SHUTTERS) };
      });
    },

    tick: needy.tick,

    expected(state, ctx, rules) {
      if (state.phase !== 'whisper') return null;
      const c = needy.current(state);
      return rules.table[c.flame][c.shutters];
    },

    inputs() { return ACTIONS; },

    attempt(state, a, ctx, rules) {
      return needy.attempt(state, a === relic.expected(state, ctx, rules));
    },

    render(root, state, api) {
      const fig = `<svg class="lantern" viewBox="0 0 80 120" aria-hidden="true">
          <path class="l-ring" d="M32 14 Q40 2 48 14"/>
          <rect class="l-cap" x="22" y="14" width="36" height="10" rx="3"/>
          <rect class="l-glass" x="24" y="24" width="32" height="62" rx="4"/>
          <ellipse class="l-flame" cx="40" cy="58" rx="7" ry="13"/>
          <g class="l-shutters"><rect x="24" y="24" width="10" height="62"/><rect x="46" y="24" width="10" height="62"/>
            <path d="M24 34 H34 M24 44 H34 M24 54 H34 M24 64 H34 M24 74 H34 M46 34 H56 M46 44 H56 M46 54 H56 M46 64 H56 M46 74 H56"/></g>
          <rect class="l-cap" x="20" y="86" width="40" height="10" rx="3"/>
        </svg><span class="cb-label cb-awake"></span>`;
      const svgStyle = (c) => {
        root.querySelector('.lantern').style.setProperty('--flame', FLAME_CSS[c.flame]);
        root.querySelector('.cb-awake').textContent = `${title(c.flame)} flame`;
        return `shutters-${c.shutters}`;
      };
      return needy.panel(root, state, api, {
        figure: fig,
        awakeClass: svgStyle,
        prompt: () => 'The flame gutters and changes colour!',
        idle: 'The lantern burns low and steady.',
        actions: ACTIONS.map((id) => ({ id, label: ACTION_TEXT[id] })),
        tip: 'When the flame changes colour, name the colour and say whether the shutters are open.',
        onCall: () => api.audio.flame(),
      });
    },

    smudgeables(rules) {
      const out = [];
      for (const f of FLAMES) for (const s of SHUTTERS) out.push({ key: `${f}.${s}`, where: `a ${title(f)} flame with shutters ${s}`, value: ACTION_TEXT[rules.table[f][s]] });
      return out;
    },

    manual(rules, smudge) {
      const ink = G.util.inker(smudge);
      const rows = FLAMES.map((f) => [`<span class="swatch" style="background:${FLAME_CSS[f]}"></span> ${title(f)}`,
        ink(`${f}.open`, ACTION_TEXT[rules.table[f].open]), ink(`${f}.closed`, ACTION_TEXT[rules.table[f].closed])]);
      return `<p class="lead">The lantern cannot be cleansed — only tended. It burns low for a while, then its flame gutters and turns a strange colour.
        From that moment the Medium has <strong>${needy.WINDOW} seconds</strong> to tend it.</p>
        <p class="lead">Ask for the flame's colour and whether the lantern's slatted <b>shutters</b> are open or closed.
        The wrong care, or none in time, is an offense.</p>
        ${G.kit.table(['Flame', 'Shutters open', 'Shutters closed'], rows)}
        <p class="note">The lantern never counts toward cleansing the table.</p>`;
    },
  };

  G.relics.lantern = relic;
})(globalThis.GR = globalThis.GR || {});
