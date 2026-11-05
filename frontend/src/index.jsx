import { StrictMode, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './i18n';
import App from './App';

// After an update, a tab that was open on the old version asks for the old
// version's files (sections, dialogs and translations load on demand), which
// the server no longer has. Vite reports that as `vite:preloadError`: reload
// once to pick up the new version. At most once a minute, so a real network
// problem doesn't turn into a reload loop.
window.addEventListener('vite:preloadError', (event) => {
  const KEY = 'ghost-reloaded-for-update';
  let last = 0;
  try { last = Number(sessionStorage.getItem(KEY)) || 0; } catch { /* storage unavailable */ }
  if (Date.now() - last < 60_000) return; // already tried: let the error show
  event.preventDefault();
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* storage unavailable */ }
  window.location.reload();
});

// Suspense: in a language other than English the screen waits for that
// language's catalog (a few kB, loaded on demand) instead of flashing English.
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <StrictMode>
    <Suspense fallback={null}>
      <App />
    </Suspense>
  </StrictMode>
);
