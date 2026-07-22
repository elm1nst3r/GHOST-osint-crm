// File: frontend/src/components/DarkModeToggle.js
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const DarkModeToggle = () => {
  const { t } = useTranslation();
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <button
      onClick={toggleDarkMode}
      className="rounded-[var(--radius-control)] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 transition-[background-color,border-color] duration-150 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.97]"
      title={darkMode ? t('darkModeToggle.switchToLight') : t('darkModeToggle.switchToDark')}
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
