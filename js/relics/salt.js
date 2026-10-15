// Salt Circle: 2–4 gaps around a circle of salt, a skull at one point. Seal every gap in the book's order.
(function (G) {
  'use strict';
  const { el, esc } = G.util;
  const { react } = G.kit;

  const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']; // clockwise
  const POINT_NAME = { N: 'North', NE: 'North-east', E: 'East', SE: 'South-east', S: 'South', SW: 'South-west', W: 'West', NW: 'North-west' };
  const STARTS = {
    CW_SKULL: 'the first gap clockwise from the skull',
    CCW_SKULL: 'the first gap anticlockwise from the skull',
    NORTH: 'the gap at North, or else the first gap clockwise from North',
    SOUTH: 'the gap at South, or else the first gap clockwise from South',
  };
  const COUNT_WORD = { 2: 'Two', 3: 'Three', 4: 'Four' };

  function walk(from, dir, pred) {
    for (let k = 0; k < 8; k++) {
      const p = (from + dir * k + 80) % 8;
      if (pred(p)) return p;
    }
    return -1;
  }

  // The full sealing order for a circle.
  function order(state, ctx, rules) {
    const g = rules.byGaps[state.gaps.length];
    const isGap = (p) => state.gaps.includes(p);
    let first;
    if (g.start === 'CW_SKULL') first = walk(state.skull + 1, 1, isGap);
    else if (g.start === 'CCW_SKULL') first = walk(state.skull - 1, -1, isGap);
    else first = walk(g.start === 'NORTH' ? 0 : 4, 1, isGap);
    const dir = (rules.cond.test(ctx) ? g.dirIf : -g.dirIf);
    const out = [first];
    let p = first;
    while (out.length < state.gaps.length) {
      p = walk(p + dir, dir, isGap);
      out.push(p);
    }
    return out;
  }

  const relic = {
    id: 'salt',
    title: 'Salt Circle',
    POINTS,

    buildRules(rng, conds) {
      const byGaps = {};
      for (const n of [2, 3, 4]) byGaps[n] = { start: rng.pick(Object.keys(STARTS)), dirIf: rng.pick([1, -1]) };
      return { byGaps, cond: rng.pick(conds) };
    },

    generate(rng) {
      const n = rng.int(2, 4);
      const picks = rng.sample([0, 1, 2, 3, 4, 5, 6, 7], n + 1);
      return { skull: picks[0], gaps: picks.slice(1).sort((a, b) => a - b), sealed: [] };
    },

    expected(state, ctx, rules) { return order(state, ctx, rules)[state.sealed.length]; },

    // Only open gaps can be sealed.
    inputs(state) { return state.gaps.filter((p) => !state.sealed.includes(p)); },

    attempt(state, p, ctx, rules) {
      if (p !== relic.expected(state, ctx, rules)) {
        state.sealed = [];
        return 'strike';
      }
      state.sealed.push(p);
      return state.sealed.length === state.gaps.length ? 'solved' : 'ok';
    },

    render(root, state, api) {
      const wrap = el('div', 'salt');
      const R = 42;
      const at = (p, r) => {
        const a = (p / 8) * Math.PI * 2 - Math.PI / 2;
        return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
      };
      let arcs = '';
      for (let p = 0; p < 8; p++) {
        // Each point owns the arc around it; a gap leaves its arc empty.
        if (state.gaps.includes(p)) continue;
        const [x1, y1] = at(p - 0.5, R), [x2, y2] = at(p + 0.5, R);
        arcs += `<path class="salt-arc" d="M${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}"/>`;
      }
      const labels = POINTS.map((n, p) => { const [x, y] = at(p, 57); return `<text x="${x.toFixed(1)}" y="${(y + 2).toFixed(1)}">${n}</text>`; }).join('');
      wrap.innerHTML = `<svg viewBox="-14 -14 128 128" aria-hidden="true">${arcs}<g class="salt-labels">${labels}</g></svg>`;
      const [sx, sy] = at(state.skull, R - 12);
      const skull = el('span', 'skull-mark', '💀');
      skull.style.left = ((sx + 14) * 100 / 128) + '%';
      skull.style.top = ((sy + 14) * 100 / 128) + '%';
      wrap.appendChild(skull);
      const btns = {};
      for (const p of state.gaps) {
        const [x, y] = at(p, R);
        const b = el('button', 'gap');
        b.type = 'button';
        b.style.left = ((x + 14) * 100 / 128) + '%';
        b.style.top = ((y + 14) * 100 / 128) + '%';
        b.setAttribute('aria-label', `Seal the gap at ${POINT_NAME[POINTS[p]]}`);
        b.addEventListener('click', () => {
          if (api.solved() || state.sealed.includes(p)) return;
          const res = api.attempt(p);
          react(b, res);
          draw();
        });
        wrap.appendChild(b);
        btns[p] = b;
      }
      const draw = () => { for (const p of state.gaps) btns[p].classList.toggle('sealed', state.sealed.includes(p)); };
      root.appendChild(wrap);
      root.appendChild(el('p', 'relic-tip', 'Say where the gaps and the skull are. Touch a gap to seal it — a wrong seal breaks them all.'));
    },

    smudgeables(rules) {
      const out = [];
      for (const n of [2, 3, 4]) {
        out.push({ key: `${n}.start`, where: `where to start with ${n} gaps`, value: STARTS[rules.byGaps[n].start] });
        out.push({ key: `${n}.dir`, where: `which way to go with ${n} gaps`, value: rules.byGaps[n].dirIf === 1 ? 'clockwise' : 'anticlockwise' });
      }
      return out;
    },

    manual(rules, smudge) {
      const ink = G.util.inker(smudge);
      const rows = [2, 3, 4].map((n) => {
        const g = rules.byGaps[n];
        return `<h3>${COUNT_WORD[n]} gaps</h3><p>Start with ${ink(`${n}.start`, STARTS[g.start])}. Then, if <strong>${esc(rules.cond.text)}</strong>,
          seal the rest going ${ink(`${n}.dir`, g.dirIf === 1 ? 'clockwise' : 'anticlockwise')}; otherwise go the other way.</p>`;
      }).join('');
      return `<p class="lead">A circle of salt has been broken in a few places. The eight points of the compass are marked around it,
        and a skull sits on the circle. Have the Medium say how many gaps there are, where they are, and where the skull is.</p>
        <p class="lead">Seal every gap, one at a time, in the order below. Each gap is sealed by touching it.
        A wrong seal is an offense and breaks every seal made so far.</p>${rows}
        <p class="note">Clockwise runs North, North-east, East… as seen from above.</p>`;
    },
  };

  G.relics.salt = relic;
})(globalThis.GR = globalThis.GR || {});
