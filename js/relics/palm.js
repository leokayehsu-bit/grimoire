// Palm Reading: rings on the fingers, a life line, a mark in the palm. Press the finger the book names.
(function (G) {
  'use strict';
  const { el, esc, lc } = G.util;
  const { rule, coveredSet, pickFrom, react } = G.kit;

  const FINGERS = ['THUMB', 'INDEX', 'MIDDLE', 'RING', 'LITTLE'];
  const FNAME = { THUMB: 'thumb', INDEX: 'index finger', MIDDLE: 'middle finger', RING: 'ring finger', LITTLE: 'little finger' };
  const METALS = ['GOLD', 'SILVER'];
  const MARKS = ['STAR', 'CROSS'];
  const has = (h, m) => h.rings.filter((r) => r === m).length;

  // Instruction templates over a hand: { rings: [5 × null|GOLD|SILVER], line: 'BROKEN'|'WHOLE', mark: null|STAR|CROSS }.
  const TEMPLATES = {
    markIs(rng) {
      const m = rng.pick(MARKS), f = rng.int(0, 4);
      return rule(FNAME[FINGERS[f]], (b) => `If the palm bears a ${lc(m)}, press the ${b}.`, (h) => h.mark === m, () => f);
    },
    broken(rng) {
      const f = rng.int(0, 4);
      return rule(FNAME[FINGERS[f]], (b) => `If the life line is broken, press the ${b}.`, (h) => h.line === 'BROKEN', () => f);
    },
    oneMetal(rng) {
      const m = rng.pick(METALS);
      return rule(lc(m), (b) => `If exactly one finger wears ${b}, press that finger.`, (h) => has(h, m) === 1, (h) => h.rings.indexOf(m));
    },
    bare(rng) {
      const f = rng.int(0, 4);
      return rule(FNAME[FINGERS[f]], (b) => `If no finger wears a ring, press the ${b}.`, (h) => h.rings.every((r) => !r), () => f);
    },
    manyMetal(rng) {
      const m = rng.pick(METALS);
      return rule(lc(m), (b) => `If two or more fingers wear ${b}, press the one of them nearest the little finger.`, (h) => has(h, m) >= 2, (h) => h.rings.lastIndexOf(m));
    },
    plainMark(rng) {
      const f = rng.int(0, 4);
      return rule(FNAME[FINGERS[f]], (b) => `If the palm bears no mark at all, press the ${b}.`, (h) => !h.mark, () => f);
    },
  };

  function spiritRule(rng, conds) {
    const cond = rng.pick(conds), m = rng.pick(METALS);
    return rule(lc(m), (b) => `If ${cond.text} and any finger wears ${b}, press the one of them nearest the thumb.`,
      (h, ctx) => cond.test(ctx) && has(h, m) > 0, (h) => h.rings.indexOf(m));
  }

  function randomHand(rng) {
    const rings = FINGERS.map(() => (rng.chance(0.4) ? rng.pick(METALS) : null));
    return { rings, line: rng.chance(0.4) ? 'BROKEN' : 'WHOLE', mark: rng.chance(0.55) ? rng.pick(MARKS) : null };
  }

  const relic = {
    id: 'palm',
    title: 'Palm Reading',

    buildRules(rng, conds) {
      const set = coveredSet(rng, (r) => {
        const rules = r.sample(Object.keys(TEMPLATES), 3).map((k) => TEMPLATES[k](r));
        rules.splice(r.int(0, 3), 0, spiritRule(r, conds));
        return { rules, fallback: r.int(0, 4) };
      }, (p) => [randomHand(p), G.seance.generate(p)], { min: 0.04 });
      return { set };
    },

    generate(rng) { return { hand: randomHand(rng) }; },

    expected(state, ctx, rules) { return pickFrom(rules.set, [state.hand, ctx]); },

    inputs() { return [0, 1, 2, 3, 4]; },

    attempt(state, f, ctx, rules) {
      return f === relic.expected(state, ctx, rules) ? 'solved' : 'strike';
    },

    render(root, state, api) {
      const h = state.hand;
      const hand = el('div', 'hand');
      const fingers = el('div', 'fingers');
      FINGERS.forEach((f, i) => {
        const b = el('button', `finger f-${lc(f)}`);
        b.type = 'button';
        b.setAttribute('aria-label', `Press the ${FNAME[f]}${h.rings[i] ? ` (${lc(h.rings[i])} ring)` : ''}`);
        b.innerHTML = (h.rings[i] ? `<span class="fring ${lc(h.rings[i])}"><b class="cb-label">${h.rings[i] === 'GOLD' ? 'gold' : 'silver'}</b></span>` : '') + `<small>${FNAME[f].replace(' finger', '')}</small>`;
        b.addEventListener('click', () => {
          if (api.solved()) return;
          api.audio.skinTap();
          react(b, api.attempt(i));
        });
        fingers.appendChild(b);
      });
      const palm = el('div', 'palm-base');
      palm.innerHTML = `<svg viewBox="0 0 200 90" aria-hidden="true">
          <path class="lifeline${h.line === 'BROKEN' ? ' broken' : ''}" d="M150 8 Q90 30 70 84"/>
          <path class="heartline" d="M20 22 Q90 6 170 24"/>
        </svg>${h.mark ? `<span class="pmark">${h.mark === 'STAR' ? '✶' : '✚'}</span>` : ''}`;
      hand.append(fingers, palm);
      root.appendChild(hand);
      root.appendChild(el('p', 'relic-tip', 'Describe each ring, the long curved life line, and any mark in the palm.'));
    },

    smudgeables(rules) {
      const s = rules.set;
      return s.rules.map((r, i) => ({ key: `r${i}`, where: `instruction ${i + 1}`, value: r.blot }))
        .concat([{ key: 'else', where: 'the last instruction', value: FNAME[FINGERS[s.fallback]] }]);
    },

    manual(rules, smudge) {
      const ink = G.util.inker(smudge);
      const s = rules.set;
      return `<p class="lead">A pale hand lies palm up. Have the Medium describe which fingers wear rings (gold or silver),
        whether the curved <b>life line</b> is whole or broken, and any mark — a star or a cross — in the palm.</p>
        <p class="lead">Obey the <em>first</em> instruction that holds true, and press exactly one finger.</p>
        <ol class="rules">${s.rules.map((r, i) => `<li>${r.say(ink(`r${i}`, r.blot))}</li>`).join('')}
        <li>Otherwise, press the ${ink('else', FNAME[FINGERS[s.fallback]])}.</li></ol>
        <p class="note">Fingers in order from the thumb: thumb, index, middle, ring, little.</p>`;
    },
  };

  G.relics.palm = relic;
  void esc;
})(globalThis.GR = globalThis.GR || {});
