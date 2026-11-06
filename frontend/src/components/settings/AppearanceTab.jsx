// File: frontend/src/components/settings/AppearanceTab.jsx
// Settings → Appearance: colour theme, theme mode, accent color, density and
// surface style. Everything applies live via ThemeContext; nothing to save.
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { authAPI } from '../../utils/authAPI';

const SegmentedControl = ({ options, value, onChange, ariaLabel, disabled = false }) => (
  <div
    role="radiogroup"
    aria-label={ariaLabel}
    aria-disabled={disabled || undefined}
    className={`${disabled ? 'opacity-50 pointer-events-none ' : ''}inline-flex items-center gap-1 p-1 rounded-(--radius-control) bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700`}
  >
    {options.map((opt) => {
      const active = value === opt.value;
      const Icon = opt.icon;
      return (
        <button
          key={opt.value}
          role="radio"
          aria-checked={active}
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={`px-3.5 py-1.5 rounded-md text-sm font-medium flex items-center gap-2
            transition-[background-color,color,box-shadow] duration-150 active:scale-[0.97] ${
            active
              ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          {Icon && <Icon className="w-4 h-4" />}
          {opt.label}
        </button>
      );
    })}
  </div>
);

const Field = ({ title, description, children }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-5 border-b border-slate-200 dark:border-slate-700 last:border-b-0">
    <div className="max-w-sm">
      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
      {description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

// A small window in the theme's colours: background, panel, accent, text.
const ThemeCard = ({ theme, active, onSelect, t }) => {
  const [bg, panel, accent, text] = theme.swatch;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={`text-start rounded-(--radius-card) border p-2 transition-shadow duration-150 active:scale-[0.98]
        focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-primary/50 ${
        active ? 'border-accent-primary ring-2 ring-accent-primary/40' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      <div className="h-14 rounded-md overflow-hidden flex border border-black/5" style={{ backgroundColor: bg }} aria-hidden="true">
        <div className="w-1/4 h-full" style={{ backgroundColor: panel }} />
        <div className="flex-1 p-1.5 space-y-1.5">
          <div className="h-1.5 w-3/4 rounded-full" style={{ backgroundColor: text, opacity: 0.85 }} />
          <div className="h-1.5 w-1/2 rounded-full" style={{ backgroundColor: text, opacity: 0.45 }} />
          <div className="h-3 w-8 rounded-sm" style={{ backgroundColor: accent }} />
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-1">
        <span className={`text-sm font-medium text-slate-900 dark:text-slate-100 ${theme.font ? 'font-mono' : ''}`}>{theme.name}</span>
        {active && <Check className="w-4 h-4 text-accent-ink shrink-0" />}
      </div>
      <span className="block text-xs text-slate-500 dark:text-slate-400">
        {theme.darkOnly ? t('appearanceTab.darkOnly') : theme.id === 'ghost' ? t('appearanceTab.ghostTheme') : t('appearanceTab.lightAndDark')}
      </span>
    </button>
  );
};

const AppearanceTab = () => {
  const { t } = useTranslation();
  const {
    theme, themeChoice, setTheme, themes, darkFlavour, setDarkFlavour, instanceDefaultTheme,
    themeMode, setThemeMode,
    accent, setAccent,
    density, setDensity,
    surface, setSurface,
    accentPresets,
  } = useTheme();

  return (
    <div className="max-w-2xl">
      <h3 className="text-lg font-semibold mb-1 text-slate-900 dark:text-slate-100">{t('appearanceTab.title')}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        {t('appearanceTab.subtitle')}
      </p>

      <div className="py-5 border-b border-slate-200 dark:border-slate-700">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('appearanceTab.colourThemeTitle')}</h4>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 mb-3">
          {t('appearanceTab.colourThemeDescription')}
          {!themeChoice && instanceDefaultTheme && <> {t('appearanceTab.usingDefault', { name: theme.name })}</>}
        </p>
        <div role="radiogroup" aria-label={t('appearanceTab.colourThemeTitle')} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {themes.map((th) => (
            <ThemeCard key={th.id} theme={th} t={t} active={theme.id === th.id} onSelect={() => setTheme(th.id)} />
          ))}
        </div>
        {theme.darkNames && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-600 dark:text-slate-300">{t('appearanceTab.darkFlavour')}</span>
            <SegmentedControl
              ariaLabel={t('appearanceTab.darkFlavour')}
              value={darkFlavour}
              onChange={setDarkFlavour}
              options={Object.entries(theme.darkNames).map(([value, label]) => ({ value, label }))}
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">{t('appearanceTab.lightIs', { name: theme.lightName })}</span>
          </div>
        )}
        {theme.credit && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
            {t('appearanceTab.paletteBy')} <a href={theme.url} target="_blank" rel="noopener noreferrer" className="text-accent-ink hover:underline">{theme.credit}</a>
          </p>
        )}
        {theme.description && theme.id !== 'ghost' && <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 font-mono">{theme.description}</p>}
      </div>

      <Field
        title={t('appearanceTab.themeFieldTitle')}
        description={theme.darkOnly ? t('appearanceTab.darkOnlyHint', { name: theme.name }) : t('appearanceTab.themeFieldDescription')}
      >
        <SegmentedControl
          ariaLabel={t('appearanceTab.themeModeAriaLabel')}
          disabled={Boolean(theme.darkOnly)}
          value={theme.darkOnly ? 'dark' : themeMode}
          onChange={(mode) => {
            setThemeMode(mode);
            // Theme mode (unlike accent/density/surface) is a per-user
            // server-side override (issue #91) — it follows the account to
            // another device, taking precedence over the admin's default.
            authAPI.updateProfile({ theme_mode: mode }).catch((err) => console.error('Error saving theme preference:', err));
          }}
          options={[
            { value: 'light',  label: t('appearanceTab.light'),  icon: Sun },
            { value: 'dark',   label: t('appearanceTab.dark'),   icon: Moon },
            { value: 'system', label: t('appearanceTab.system'), icon: Monitor },
          ]}
        />
      </Field>

      <Field title={t('appearanceTab.accentFieldTitle')} description={t('appearanceTab.accentFieldDescription')}>
        <div className="flex items-center gap-2.5" role="radiogroup" aria-label={t('appearanceTab.accentColorAriaLabel')}>
          {theme.id !== 'ghost' && (
            <button
              role="radio"
              aria-checked={accent === 'auto'}
              title={t('appearanceTab.themeAccent', { name: theme.name })}
              onClick={() => setAccent('auto')}
              className={`h-8 px-2.5 rounded-full text-xs font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200
                focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-primary/50 ${accent === 'auto' ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500 dark:ring-offset-slate-900' : ''}`}
            >
              <span className="inline-block w-3 h-3 rounded-full align-[-2px] me-1.5" style={{ backgroundColor: theme.swatch[2] }} />
              {t('appearanceTab.themeAccentShort')}
            </button>
          )}
          {accentPresets.map((preset) => {
            const active = accent === preset.id;
            return (
              <button
                key={preset.id}
                role="radio"
                aria-checked={active}
                title={t(`appearanceTab.accentNames.${preset.id}`)}
                onClick={() => setAccent(preset.id)}
                className={`w-8 h-8 rounded-full flex items-center justify-center
                  transition-shadow duration-150 active:scale-[0.97]
                  focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400 ${
                  active
                    ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500 dark:ring-offset-slate-900'
                    : ''
                }`}
                style={{ backgroundColor: preset.hex }}
              >
                {active && <Check className="w-4 h-4 text-white" />}
              </button>
            );
          })}
        </div>
      </Field>

      <Field title={t('appearanceTab.densityFieldTitle')} description={t('appearanceTab.densityFieldDescription')}>
        <SegmentedControl
          ariaLabel={t('appearanceTab.densityAriaLabel')}
          value={density}
          onChange={setDensity}
          options={[
            { value: 'comfortable', label: t('appearanceTab.comfortable') },
            { value: 'compact',     label: t('appearanceTab.compact') },
          ]}
        />
      </Field>

      <Field title={t('appearanceTab.surfaceFieldTitle')} description={t('appearanceTab.surfaceFieldDescription')}>
        <SegmentedControl
          ariaLabel={t('appearanceTab.surfaceAriaLabel')}
          value={surface}
          onChange={setSurface}
          options={[
            { value: 'solid', label: t('appearanceTab.solid') },
            { value: 'glass', label: t('appearanceTab.glass') },
          ]}
        />
      </Field>

      <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">
        {t('appearanceTab.preferencesStoredNote')}
      </p>
    </div>
  );
};

export default AppearanceTab;
