// Small colour helpers for the theme engine: hex parsing, mixing in OKLab
// (perceptually even, so "20% towards the background" looks like 20%), and
// WCAG contrast. Everything works on #rrggbb strings.

const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));

export function parseHex(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}

export function toHex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join('')}`;
}

// "r g b" with 0-255 values, the form the --accent variables use.
export const toTriplet = (hex) => parseHex(hex).map((v) => Math.round(v * 255)).join(' ');

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function toOklab(hex) {
  const [r, g, b] = parseHex(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, a, bb]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * bb) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * bb) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * bb) ** 3;
  return toHex([
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => fromLinear(clamp(c))));
}

// `amount` of `a` mixed into `b`: mix(a, b, 1) = a, mix(a, b, 0) = b.
export function mix(a, b, amount) {
  const A = toOklab(a); const B = toOklab(b);
  return fromOklab(A.map((v, i) => v * amount + B[i] * (1 - amount)));
}

export function luminance(hex) {
  const [r, g, b] = parseHex(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Moves `color` towards `towards` in small steps until it reaches `ratio`
// against `against` (or gets all the way there).
export function ensureContrast(color, against, ratio, towards) {
  let c = color;
  for (let step = 0; step <= 40 && contrast(c, against) < ratio; step++) c = mix(towards, color, step / 40);
  return c;
}
