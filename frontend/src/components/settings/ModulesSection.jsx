// File: frontend/src/components/settings/ModulesSection.jsx
//
// Switch whole sections off for everyone (admin). A switched-off module leaves
// the menu, its address opens the dashboard, and its tabs and map layers go.
// Its data stays and the API keeps working, so this is about a shorter menu,
// not about access. Everything is on by default.
import { useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutGrid, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useModules } from '../../contexts/ModulesContext';
import { modulesAPI } from '../../utils/api';
import { NAV_GROUPS, SWITCHABLE_MODULES } from '../../utils/modules';

const ModulesSection = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { disabled, setDisabled } = useModules();
  const [status, setStatus] = useState(null); // 'saved' | 'error'
  const [saving, startSave] = useTransition();

  if (currentUser?.role !== 'admin') return null;

  const toggle = (id, on) => {
    const previous = disabled;
    const next = on ? disabled.filter((d) => d !== id) : [...disabled, id];
    setDisabled(next);
    setStatus(null);
    startSave(async () => {
      try {
        const res = await modulesAPI.update(next);
        setDisabled(res.disabled);
        setStatus('saved');
      } catch {
        setDisabled(previous); // don't let the switches lie
        setStatus('error');
      }
    });
  };

  const groups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((id) => SWITCHABLE_MODULES.includes(id)) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="pt-6 mt-6 border-t">
      <h3 className="text-lg font-semibold mb-1 flex items-center">
        <LayoutGrid className="w-5 h-5 me-2" />
        {t('settings.modules.title')}
      </h3>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-4 max-w-2xl">{t('settings.modules.description')}</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
        {groups.map((g) => (
          <fieldset key={g.heading}>
            <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t(`app.navGroup.${g.heading}`)}</legend>
            <div className="space-y-2">
              {g.items.map((id) => (
                <label key={id} className="flex items-center gap-2 text-sm text-gray-800 dark:text-slate-200 cursor-pointer">
                  <input type="checkbox" checked={!disabled.includes(id)} onChange={(e) => toggle(id, e.target.checked)} disabled={saving} />
                  {t(`app.nav.${id}`)}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <p className="text-xs text-gray-500 dark:text-slate-400 mt-3 max-w-2xl">{t('settings.modules.alwaysOn')}</p>
      {status === 'saved' && (
        <p className="text-xs text-green-700 dark:text-green-400 mt-2 flex items-center gap-1"><Check className="w-3.5 h-3.5" />{t('settings.modules.saved')}</p>
      )}
      {status === 'error' && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{t('settings.modules.saveFailed')}</p>}
    </div>
  );
};

export default ModulesSection;
