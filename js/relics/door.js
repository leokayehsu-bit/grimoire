// Creeping Door: a needy relic. Every so often something knocks and the door creaks open; keep it out.
(function (G) {
  'use strict';
  const { title } = G.util;
  const { needy } = G.kit;

  const KNOCKS = [1, 2, 3, 4];
  const LIGHTS = ['DARK', 'WARM', 'COLD'];
  const LIGHT_TEXT = { DARK: 'No light', WARM: 'Warm light', COLD: 'Cold light' };
  const LIGHT_CSS = { DARK: 'transparent', WARM: '#ffb85a', COLD: '#8fd8ff' };
  const ACTIONS = ['BOLT', 'BAR', 'SALT', 'NAME', 'HOLD', 'KEY'];
  const ACTION_TEXT = { BOLT: 'Slide the bolt', BAR: 'Wedge a chair', SALT: 'Salt the threshold', NAME: "Speak the spirit's name", HOLD: 'Hold it shut', KEY: 'Turn the key' };
  const TIMES = ['', 'Once', 'Twice', 'Three times', 'Four times'];

  const relic = {
    id: 'door',
    title: 'Creeping Door',
    needy: true,
    WINDOW: needy.WINDOW, QUIET: needy.QUIET, ACTIONS,

    buildRules(rng) {
      const table = {};
      for (const k of KNOCKS) {
        table[k] = {};
        const picks = rng.sample(ACTIONS, 3);
        LIGHTS.forEach((l, i) => { table[k][l] = picks[i]; });
      }
      return { table };
    },

    generate(rng) {
      return needy.generate(rng, (r) => ({ knocks: r.pick(KNOCKS), light: r.pick(LIGHTS) }));
    },

    tick: needy.tick,

    expected(state, ctx, rules) {
      if (state.phase !== 'whisper') return null;
      const c = needy.current(state);
      return rules.table[c.knocks][c.light];
    },

    inputs() { return ACTIONS; },

    attempt(state, a, ctx, rules) {
      return needy.attempt(state, a === relic.expected(state, ctx, rules));
    },

    render(root, state, api) {
      const fig = `<div class="door-frame"><div class="door-leaf"><span class="knob"></span></div><span class="door-light"></span></div><span class="cb-label cb-awake"></span>`;
      let knockTimer = null;
      const knockLoop = (c) => {
        clearTimeout(knockTimer);
        if (state.phase !== 'whisper' || api.solved()) return;
        api.audio.knock(c.knocks);
        const leaf = root.querySelector('.door-leaf');
        leaf.classList.remove('knocking');
        void leaf.offsetWidth;
        leaf.classList.add('knocking');
        leaf.style.setProperty('--knocks', c.knocks);
        knockTimer = setTimeout(() => knockLoop(c), 4500);
      };
      const panel = needy.panel(root, state, api, {
        figure: fig,
        awakeClass: (c) => {
          root.querySelector('.door-light').style.setProperty('--light', LIGHT_CSS[c.light]);
          root.querySelector('.cb-awake').textContent = LIGHT_TEXT[c.light];
          return 'creak';
        },
        prompt: () => 'Something is knocking…',
        idle: 'The door is shut. For now.',
        actions: ACTIONS.map((id) => ({ id, label: ACTION_TEXT[id] })),
        tip: 'When it knocks, count the knocks and look at the light under the door.',
        onCall: (c) => { api.audio.creak(); knockLoop(c); },
      });
      return { update: panel.update, destroy: () => clearTimeout(knockTimer) };
    },

    smudgeables(rules) {
      const out = [];
      for (const k of KNOCKS) for (const l of LIGHTS) out.push({ key: `${k}.${l}`, where: `${TIMES[k].toLowerCase()}, ${LIGHT_TEXT[l].toLowerCase()}`, value: ACTION_TEXT[rules.table[k][l]] });
      return out;
    },

    manual(rules, smudge) {
      const ink = G.util.inker(smudge);
      const rows = KNOCKS.map((k) => [TIMES[k]].concat(LIGHTS.map((l) => ink(`${k}.${l}`, ACTION_TEXT[rules.table[k][l]]))));
      return `<p class="lead">The door cannot be cleansed — only kept shut. Now and then something knocks and the door begins to creak open.
        From the first knock the Medium has <strong>${needy.WINDOW} seconds</strong> to keep it out.</p>
        <p class="lead">Ask how many times it knocks in a row, and what light shows in the gap beneath the door.
        The wrong defence, or none in time, is an offense.</p>
        ${G.kit.table(['Knocks'].concat(LIGHTS.map((l) => LIGHT_TEXT[l])), rows)}
        <p class="note">The door never counts toward cleansing the table. The knocks repeat while it waits.</p>`;
    },
  };

  G.relics.door = relic;
})(globalThis.GR = globalThis.GR || {});
