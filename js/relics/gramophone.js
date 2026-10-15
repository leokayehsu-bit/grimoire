// Gramophone: the record's title picks the groove, its colour picks the speed. Set both, then drop the needle.
(function (G) {
  'use strict';
  const { el, esc, title } = G.util;
  const { react } = G.kit;

  const TITLES = [
    'THE DROWNED WALTZ', 'A NOCTURNE FOR NO ONE', "MOTHER'S LULLABY", 'THE LAST DANCE', 'WALTZ OF THE HOLLOW',
    'MOONLIGHT ON THE MOOR', "THE WIDOW'S LAMENT", 'CHILDREN OF THE CELLAR', 'A SONG FOR THE BURIED',
    "THE CLOCKMAKER'S DAUGHTER", 'GOODNIGHT, SWEET GHOST', 'THE SILENT CHOIR', 'RAIN ON THE ATTIC', 'THE PALE BALLROOM',
  ];
  const COLORS = ['BLACK', 'RED', 'BLUE'];
  const DISC = { BLACK: '#141118', RED: '#7a1a1e', BLUE: '#1d3566' };
  const SPEEDS = [33, 45, 78];
  const GROOVES = [1, 2, 3, 4, 5];

  const relic = {
    id: 'gramophone',
    title: 'Gramophone',

    buildRules(rng, conds) {
      const titles = rng.sample(TITLES, 10).sort();
      const groove = {};
      for (const t of titles) groove[t] = rng.pick(GROOVES);
      const speed = {};
      for (const c of COLORS) {
        const [a, b] = rng.sample(SPEEDS, 2);
        speed[c] = { yes: a, no: b };
      }
      return { titles, groove, speed, cond: rng.pick(conds) };
    },

    generate(rng, ctx, rules) {
      return { title: rng.pick(rules.titles), color: rng.pick(COLORS) };
    },

    expected(state, ctx, rules) {
      const s = rules.speed[state.color][rules.cond.test(ctx) ? 'yes' : 'no'];
      return `${s}|${rules.groove[state.title]}`;
    },

    inputs() {
      return SPEEDS.flatMap((s) => GROOVES.map((g) => `${s}|${g}`));
    },

    attempt(state, v, ctx, rules) {
      return v === relic.expected(state, ctx, rules) ? 'solved' : 'strike';
    },

    render(root, state, api) {
      const wrap = el('div', 'gramo');
      const disc = el('div', 'disc');
      disc.style.setProperty('--disc', DISC[state.color]);
      disc.innerHTML = `<span class="label">${esc(title(state.title))}</span>`;
      const controls = el('div', 'gramo-controls');
      let speed = null, groove = null;
      const group = (name, values, fmt, set) => {
        const g = el('div', 'seg');
        g.appendChild(el('span', 'label', name));
        const btns = values.map((v) => {
          const b = el('button', 'seg-btn', fmt(v));
          b.type = 'button';
          b.addEventListener('click', () => { set(v); btns.forEach((x) => x.classList.toggle('on', x === b)); api.audio.mechClick(); });
          g.appendChild(b);
          return b;
        });
        return g;
      };
      controls.append(
        group('Speed', SPEEDS, (s) => `${s} rpm`, (v) => { speed = v; }),
        group('Groove', GROOVES, String, (v) => { groove = v; }),
      );
      const drop = el('button', 'btn small', '♪ Lower the needle');
      drop.type = 'button';
      drop.addEventListener('click', () => {
        if (api.solved() || speed == null || groove == null) return;
        const res = api.attempt(`${speed}|${groove}`);
        react(wrap, res);
        if (res === 'solved') { disc.classList.add('spin'); api.audio.phonograph(); } else if (res === 'strike') api.audio.needleScratch();
      });
      wrap.append(disc, el('span', 'cb-label', `${title(state.color)} record`), controls, drop);
      root.appendChild(wrap);
      root.appendChild(el('p', 'relic-tip', 'Read the label and name the record’s colour. Choose a speed and a groove first.'));
    },

    smudgeables(rules) {
      const out = rules.titles.map((t) => ({ key: `g.${t}`, where: `the groove for “${title(t)}”`, value: String(rules.groove[t]) }));
      for (const c of COLORS) {
        out.push({ key: `s.${c}.yes`, where: `the first speed for a ${title(c)} record`, value: `${rules.speed[c].yes} rpm` });
        out.push({ key: `s.${c}.no`, where: `the second speed for a ${title(c)} record`, value: `${rules.speed[c].no} rpm` });
      }
      return out;
    },

    manual(rules, smudge) {
      const ink = G.util.inker(smudge);
      const grooves = rules.titles.map((t) => [esc(title(t)), ink(`g.${t}`, String(rules.groove[t]))]);
      const speeds = COLORS.map((c) => [`<span class="swatch" style="background:${DISC[c]}"></span> ${title(c)}`,
        ink(`s.${c}.yes`, `${rules.speed[c].yes} rpm`), ink(`s.${c}.no`, `${rules.speed[c].no} rpm`)]);
      return `<p class="lead">A record waits on the gramophone. Its <b>title</b> sets the groove; its <b>colour</b> sets the speed.
        The Medium chooses both, then lowers the needle.</p>
        <h3>Speed</h3>
        <p>If <strong>${esc(rules.cond.text)}</strong>, use the first column. Otherwise, use the second.</p>
        ${G.kit.table(['Record', 'First', 'Second'], speeds)}
        <h3>Groove</h3>
        ${G.kit.table(['Title', 'Groove'], grooves)}
        <p class="note">Grooves are counted from the outside edge of the record inwards.</p>`;
    },
  };

  G.relics.gramophone = relic;
})(globalThis.GR = globalThis.GR || {});
