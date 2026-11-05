// File: frontend/src/components/scratchpad/ScratchpadSettingsView.jsx
// The scratchpad's own settings, shown inside the panel (gear icon).

import { useTranslation } from 'react-i18next';
import { RotateCcw, Keyboard } from 'lucide-react';
import { SCRATCHPAD_THEMES } from './scratchpadTheme';

const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

// The corner setting is stored as an LTR name but means a reading-order corner:
// the default, bottom-right, is the corner away from the navigation and above
// the system-health widget, and in a right-to-left UI both of those mirror. So
// the scratchpad and this picker place and name every corner by where it
// lands on screen (issue #99).
export const screenCorner = (corner, dir) =>
  dir === 'rtl' ? corner.replace(/left|right/, (side) => (side === 'left' ? 'right' : 'left')) : corner;
const FONT_SIZES = ['sm', 'md', 'lg'];

export const Toggle = ({ checked, onChange, label, description }) => (
  <label className="flex items-start gap-3 cursor-pointer">
    <span className="flex-1 min-w-0">
      <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">{label}</span>
      {description && <span className="block text-xs text-slate-500 dark:text-slate-400">{description}</span>}
    </span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0.5 rtl:-translate-x-0.5'}`} />
    </button>
  </label>
);

const SectionLabel = ({ children }) => (
  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">{children}</p>
);

const ScratchpadSettingsView = ({ settings, onChange, onResetGeometry, isMobile }) => {
  const { t, i18n } = useTranslation();
  const dir = i18n.dir(i18n.resolvedLanguage);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Toggle
          checked={settings.showTodos}
          onChange={(v) => onChange({ showTodos: v })}
          label={t('scratchpad.settings.showTodos')}
          description={t('scratchpad.settings.showTodosHelp')}
        />
        <Toggle
          checked={settings.selectionButton}
          onChange={(v) => onChange({ selectionButton: v })}
          label={t('scratchpad.settings.selectionButton')}
          description={t('scratchpad.settings.selectionButtonHelp')}
        />
      </div>

      {!isMobile && (
        <div>
          <SectionLabel>{t('scratchpad.settings.position')}</SectionLabel>
          <div className="flex items-center gap-3">
            {/* A tiny "screen" with the four corners to pick from */}
            <div className="relative w-24 h-16 rounded-md border border-slate-300 dark:border-slate-600 bg-black/3 dark:bg-white/5">
              {CORNERS.map((corner) => {
                const active = settings.corner === corner;
                const onScreen = screenCorner(corner, dir);
                const pos = `${onScreen.startsWith('top') ? 'top-1' : 'bottom-1'} ${onScreen.endsWith('left') ? 'left-1' : 'right-1'}`;
                return (
                  <button
                    key={corner}
                    type="button"
                    onClick={() => onChange({ corner })}
                    className={`absolute ${pos} w-7 h-5 rounded-xs border transition-colors ${active ? 'bg-accent-primary border-accent-primary' : 'border-slate-400 dark:border-slate-500 hover:bg-accent-primary/30'}`}
                    title={t(`scratchpad.settings.corners.${onScreen}`)}
                    aria-label={t(`scratchpad.settings.corners.${onScreen}`)}
                    aria-pressed={active}
                  />
                );
              })}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex-1">
              {t('scratchpad.settings.positionHelp')}
              <button type="button" onClick={onResetGeometry} className="mt-1.5 flex items-center gap-1 text-accent-primary hover:underline">
                <RotateCcw className="w-3 h-3" /> {t('scratchpad.settings.resetGeometry')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <SectionLabel>{t('scratchpad.settings.color')}</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {Object.entries(SCRATCHPAD_THEMES).map(([name, theme]) => {
            const active = settings.color === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => onChange({ color: name })}
                className={`w-7 h-7 rounded-full ${theme.swatch} ring-offset-2 ring-offset-white dark:ring-offset-slate-900 transition-shadow ${active ? 'ring-2 ring-slate-900 dark:ring-white' : 'hover:ring-2 hover:ring-slate-400'}`}
                title={t(`scratchpad.settings.colors.${name}`)}
                aria-label={t(`scratchpad.settings.colors.${name}`)}
                aria-pressed={active}
              />
            );
          })}
        </div>
      </div>

      {!isMobile && (
        <div>
          <SectionLabel>{t('scratchpad.settings.opacity', { value: settings.opacity })}</SectionLabel>
          <input
            type="range"
            min={50}
            max={100}
            step={5}
            value={settings.opacity}
            onChange={(e) => onChange({ opacity: Number(e.target.value) })}
            className="w-full accent-[rgb(var(--accent))]"
            aria-label={t('scratchpad.settings.opacity', { value: settings.opacity })}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('scratchpad.settings.opacityHelp')}</p>
        </div>
      )}

      <div>
        <SectionLabel>{t('scratchpad.settings.fontSize')}</SectionLabel>
        <div className="inline-flex rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden">
          {FONT_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => onChange({ fontSize: size })}
              className={`px-3 py-1 text-xs font-medium ${settings.fontSize === size ? 'bg-accent-primary text-white' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}
              aria-pressed={settings.fontSize === size}
            >
              {t(`scratchpad.settings.fontSizes.${size}`)}
            </button>
          ))}
        </div>
      </div>

      {!isMobile && (
        <div>
          <SectionLabel>
            <span className="inline-flex items-center gap-1"><Keyboard className="w-3 h-3" /> {t('scratchpad.settings.shortcuts')}</span>
          </SectionLabel>
          <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <li><kbd className="scratchpad-kbd">Alt</kbd>+<kbd className="scratchpad-kbd">Shift</kbd>+<kbd className="scratchpad-kbd">S</kbd> {t('scratchpad.settings.shortcutToggle')}</li>
            <li><kbd className="scratchpad-kbd">Alt</kbd>+<kbd className="scratchpad-kbd">Shift</kbd>+<kbd className="scratchpad-kbd">A</kbd> {t('scratchpad.settings.shortcutCapture')}</li>
            <li><kbd className="scratchpad-kbd">Ctrl</kbd>+<kbd className="scratchpad-kbd">Enter</kbd> {t('scratchpad.settings.shortcutAdd')}</li>
          </ul>
        </div>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400 border-t border-black/5 dark:border-white/10 pt-3">
        {t('scratchpad.settings.privacyNote')}
      </p>
    </div>
  );
};

export default ScratchpadSettingsView;
