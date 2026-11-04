// Bidirectional text helpers (issue #99).
//
// Case data mixes scripts: a Persian alias in an English UI, "Ali R." in a
// Persian one. Joined into one string, the punctuation between values drifts
// to the wrong side ("Ali R., علی‌رضا" shows as ".,Ali R"). In JSX, wrap a value
// in <bdi> instead; these are for values that end up inside a plain string,
// such as a translated sentence.

const FSI = '⁨'; // first strong isolate: direction taken from the value
const PDI = '⁩'; // pop directional isolate

// Isolate one value so it keeps its own direction and doesn't reorder the text
// around it. Invisible; empty values stay empty.
export const isolate = (value) => {
  const s = value == null ? '' : String(value);
  return s ? `${FSI}${s}${PDI}` : s;
};

export const isolateList = (values, separator = ', ') =>
  (values || []).map(isolate).join(separator);
