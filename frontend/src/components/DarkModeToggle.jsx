// File: frontend/src/components/DarkModeToggle.jsx
import { useTranslation } from 'react-i18next';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const DarkModeToggle = () => {
  const { t } = useTranslation();
  const { darkMode, toggleDarkMode, theme } = useTheme();
  // Dracula and Matrix have no light version.
  const fixed = Boolean(theme.darkOnly);

  return (
    <button
      onClick={toggleDarkMode}
      disabled={fixed}
      aria-label={fixed ? t('darkModeToggle.darkOnly', { name: theme.name }) : (darkMode ? t('darkModeToggle.switchToLight') : t('darkModeToggle.switchToDark'))}
      className="rounded-(--radius-control) border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 transition-[background-color,border-color] duration-150 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
      title={fixed ? t('darkModeToggle.darkOnly', { name: theme.name }) : (darkMode ? t('darkModeToggle.switchToLight') : t('darkModeToggle.switchToDark'))}
    >
      <div className="relative w-5 h-5">
        {darkMode ? (
          <Sun className="w-5 h-5 text-amber-400" />
        ) : (
          <Moon className="w-5 h-5 text-slate-600" />
        )}
      </div>
    </button>
  );
};

export default DarkModeToggle;
