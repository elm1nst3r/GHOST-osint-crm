// Desktop width (Tailwind's md, 48rem): the narrow sidebar and the graph
// workspace's side panels exist only there; phones keep drawers and sheets.
import { useSyncExternalStore } from 'react';

const WIDE = '(min-width: 48rem)';
const subscribe = (onChange) => {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
};
const isWide = () => window.matchMedia(WIDE).matches;

export const useWide = () => useSyncExternalStore(subscribe, isWide, () => true);
