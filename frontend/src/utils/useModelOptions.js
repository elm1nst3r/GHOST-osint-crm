// File: frontend/src/utils/useModelOptions.js
//
// Reads a model_type's options from Settings → Data Model, falling back to the
// static list in constants.js when the fetch fails or the type has no rows.
//
// Person categories and statuses used to render straight from those constants,
// so options an admin added under Settings → Data Model never appeared in the
// person form or any filter — the "Data Model changes do nothing" report in
// issue #67. Every dropdown backed by a model_type should go through here.

import { useEffect, useState } from 'react';
import { modelOptionsAPI } from './api';

// Fallback entries carry presentation metadata the database doesn't (notably
// `color` on statuses, which drives the badge styling). Keep it when the value
// matches, or loading from the database would silently grey out every badge.
export const mergeOptionMeta = (dbOptions, fallback = []) =>
  dbOptions.map((opt) => {
    const known = fallback.find((f) => f.value === opt.value);
    return known ? { ...known, ...opt } : opt;
  });

export const useModelOptions = (modelType, fallback = []) => {
  const [options, setOptions] = useState(fallback);

  useEffect(() => {
    let cancelled = false;
    modelOptionsAPI
      .getAll()
      .then((all) => {
        if (cancelled || !Array.isArray(all)) return;
        const picked = all
          .filter((o) => o.model_type === modelType && o.is_active)
          .sort((a, b) => a.display_order - b.display_order)
          .map((o) => ({ value: o.option_value, label: o.option_label }));
        // An empty result means the type has no rows, not that the user wants
        // an empty dropdown — keep the fallback so the form stays usable.
        if (picked.length) setOptions(mergeOptionMeta(picked, fallback));
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelType]);

  return options;
};
