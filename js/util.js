// Shared helpers: seeded randomness, text helpers, tiny DOM builder.
// Everything that generates a séance or a grimoire must use makeRng(), never Math.random(),
// so a seed always rebuilds the exact same table and an edition the exact same book.
(function (G) {
  'use strict';

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRng(seed) {
    const next = mulberry32(seed);
    const rng = {
      next,
      int: (a, b) => a + Math.floor(next() * (b - a + 1)),
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      chance: (p) => next() < p,
      shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(next() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      },
      sample: (arr, n) => rng.shuffle(arr).slice(0, n),
    };
    return rng;
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
  const NUMWORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
  const lc = (s) => s.toLowerCase();
  const title = (s) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  G.util = { makeRng, hash, ORD, NUMWORD, lc, title, el, esc };
  G.relics = G.relics || {};
})(globalThis.GR = globalThis.GR || {});
