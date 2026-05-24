// prng.js — tiny seeded LCG (Linear Congruential Generator)
// Deterministic from a 32-bit seed. No Math.random() anywhere in this file.
// Dual export: Node require() and browser window.

(function (exports) {
  function Prng(seed) {
    let s = seed >>> 0;  // force 32-bit unsigned

    // LCG constants from Numerical Recipes
    function next() {
      s = ((s * 1664525) + 1013904223) >>> 0;
      return s;
    }

    // Float in [0, 1)
    function random() {
      return next() / 0x100000000;
    }

    // Integer in [min, max] inclusive
    function range(min, max) {
      return min + Math.floor(random() * (max - min + 1));
    }

    // Pick a random element from an array
    function pick(arr) {
      return arr[range(0, arr.length - 1)];
    }

    return { next, random, range, pick };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Prng };
  } else {
    exports.Prng = Prng;
  }
}(typeof window !== 'undefined' ? window : {}));
