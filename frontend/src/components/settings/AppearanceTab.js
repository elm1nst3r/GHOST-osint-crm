// File: frontend/src/components/settings/AppearanceTab.js
// Settings → Appearance: theme mode, accent color, density and surface
// style. Everything applies live via ThemeContext; nothing to save.
import React from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const SegmentedControl = ({ options, value, onChange, ariaLabel }) => (
  <div
    role="radiogroup"
    aria-label={ariaLabel}
    className="inline-flex items-center gap-1 p-1 rounded-[var(--radius-control)] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
  >
    {options.map((opt) => {
      const active = value === opt.value;
      const Icon = opt.icon;
      return (
        <button
          key={opt.value}
          role="radio"
          aria-checked={active}
          onClick={() => onChange(opt.value)}
          className={`px-3.5 py-1.5 rounded-md text-sm font-medium flex items-center gap-2
            transition-[background-color,color,box-shadow] duration-150 active:scale-[0.97] ${
            active
              ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm'
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
    <div className="flex-shrink-0">{children}</div>
  </div>
);

const AppearanceTab = () => {
  const {
    themeMode, setThemeMode,
    accent, setAccent,
    density, setDensity,
    surface, setSurface,
    accentPresets,
  } = useTheme();

  return (
    <div className="max-w-2xl">
      <h3 className="text-lg font-semibold mb-1 text-slate-900 dark:text-slate-100">Appearance</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Customize how the app looks. Changes apply immediately.
      </p>

      <Field title="Theme" description="Follow your system setting or pick one explicitly.">
        <SegmentedControl
          ariaLabel="Theme mode"
          value={themeMode}
          onChange={setThemeMode}
          options={[
            { value: 'light',  label: 'Light',  icon: Sun },
            { value: 'dark',   label: 'Dark',   icon: Moon },
            { value: 'system', label: 'System', icon: Monitor },
          ]}
        />
      </Field>

      <Field title="Accent color" description="Used for buttons, links, active navigation and focus rings.">
        <div className="flex items-center gap-2.5" role="radiogroup" aria-label="Accent color">
          {accentPresets.map((preset) => {
            const active = accent === preset.id;
            return (
              <button
                key={preset.id}
                role="radio"
                aria-checked={active}
                title={preset.label}
                onClick={() => setAccent(preset.id)}
                className={`w-8 h-8 rounded-full flex items-center justify-center
                  transition-[box-shadow] duration-150 active:scale-[0.97]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400 ${
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

      <Field title="Density" description="Compact tightens spacing and type for data-heavy work.">
        <SegmentedControl
          ariaLabel="Density"
          value={density}
          onChange={setDensity}
          options={[
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'compact',     label: 'Compact' },
          ]}
        />
      </Field>

      <Field title="Surface style" description="Solid is clean and fast; Glass brings back translucent panels.">
        <SegmentedControl
          ariaLabel="Surface style"
          value={surface}
          onChange={setSurface}
          options={[
            { value: 'solid', label: 'Solid' },
            { value: 'glass', label: 'Glass' },
          ]}
        />
      </Field>

      <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">
        Preferences are stored in this browser.
      </p>
    </div>
  );
};

export default AppearanceTab;
