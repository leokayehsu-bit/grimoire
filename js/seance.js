// The séance table: the details around the relics that the grimoire's rules refer to.
// Only the Medium can see these, so Scholars have to ask for them.
(function (G) {
  'use strict';

  const NAMES = [
    'AGATHA', 'AMBROSE', 'BARNABY', 'CORDELIA', 'CLEMENTINE', 'DMITRI', 'EZEKIEL', 'FLORENCE',
    'GIDEON', 'HORTENSE', 'IGNATIUS', 'JOSEPHINE', 'LUCIUS', 'MATILDA', 'MORDECAI', 'NATHANIEL',
    'OPHELIA', 'PERCIVAL', 'ROSALIND', 'SILAS', 'THEODORA', 'ULRIC', 'VIOLETTA', 'WINIFRED',
  ];
  const MOONS = ['NEW', 'WAXING', 'FULL', 'WANING'];
  const SIGILS = ['EYE', 'KEY', 'SERPENT', 'CROWN', 'MOTH'];
  const SIGIL_GLYPH = { EYE: '👁', KEY: '🗝', SERPENT: '🐍', CROWN: '👑', MOTH: '🦋' };

  function vowels(name) {
    let n = 0;
    for (const ch of name) if ('AEIOU'.includes(ch)) n++;
    return n;
  }

  function generate(rng) {
    const carved = rng.sample(SIGILS, rng.int(1, 3));
    return {
      name: rng.pick(NAMES),
      deathYear: rng.int(1702, 1899),
      moon: rng.pick(MOONS),
      bones: rng.int(1, 5),
      sigils: SIGILS.filter((s) => carved.includes(s)),
    };
  }

  // Conditions the rules may ask about. Each has the sentence printed in the grimoire
  // and the test the game runs, so the book and the game can never disagree.
  function conditions() {
    const pool = [
      { key: 'oddYear', text: 'the spirit died in an odd-numbered year', test: (c) => c.deathYear % 2 === 1 },
      { key: 'evenYear', text: 'the spirit died in an even-numbered year', test: (c) => c.deathYear % 2 === 0 },
      { key: 'vowels3', text: "the spirit's name has three or more vowels", test: (c) => vowels(c.name) >= 3 },
      { key: 'shortName', text: "the spirit's name has six letters or fewer", test: (c) => c.name.length <= 6 },
      { key: 'nameAM', text: "the spirit's name begins with a letter from A to M", test: (c) => c.name[0] <= 'M' },
      { key: 'fullMoon', text: 'the moon is full', test: (c) => c.moon === 'FULL' },
      { key: 'darkMoon', text: 'the moon is new or waning', test: (c) => c.moon === 'NEW' || c.moon === 'WANING' },
      { key: 'bones3', text: 'three or more bone charms hang above the table', test: (c) => c.bones >= 3 },
      { key: 'bonesOdd', text: 'an odd number of bone charms hang above the table', test: (c) => c.bones % 2 === 1 },
      { key: 'sigils2', text: 'two or more sigils are carved into the table', test: (c) => c.sigils.length >= 2 },
    ];
    for (const s of SIGILS) {
      pool.push({ key: 'sigil' + s, text: `the ${G.util.title(s)} sigil is carved into the table`, test: (c) => c.sigils.includes(s) });
    }
    return pool;
  }

  let moonId = 0;
  function moonSVG(phase, size = 64) {
    const lit = '#efe6c4', dark = '#17131f';
    let body;
    if (phase === 'FULL') {
      body = `<circle cx="32" cy="32" r="26" fill="${lit}"/>`;
    } else if (phase === 'NEW') {
      body = `<circle cx="32" cy="32" r="26" fill="${dark}" stroke="#5a5170" stroke-width="1.5"/>`;
    } else {
      // Waxing: lit on the right. Waning: lit on the left.
      const id = 'moonclip' + (++moonId);
      const dx = phase === 'WAXING' ? -15 : 15;
      body = `<clipPath id="${id}"><circle cx="32" cy="32" r="26"/></clipPath>` +
        `<circle cx="32" cy="32" r="26" fill="${lit}"/>` +
        `<circle cx="${32 + dx}" cy="32" r="27" fill="${dark}" clip-path="url(#${id})"/>`;
    }
    return `<svg class="moon" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;
  }

  G.seance = { NAMES, MOONS, SIGILS, SIGIL_GLYPH, vowels, generate, conditions, moonSVG };
})(globalThis.GR = globalThis.GR || {});
