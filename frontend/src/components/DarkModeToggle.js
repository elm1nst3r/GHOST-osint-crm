// File: frontend/src/components/DarkModeToggle.js
import React from 'react';
import { Sun, Moon } from 'lucide-react';

const DarkModeToggle = ({ darkMode, setDarkMode }) => {
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <button
      onClick={toggleDarkMode}
      className="glass-button rounded-glass p-2 transition-all duration-300 hover:shadow-glow-sm group"
      title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      <div className="relative w-5 h-5">
        {darkMode ? (
          <Sun className="w-5 h-5 text-yellow-400 group-hover:animate-pulse" />
        ) : (
          <Moon className="w-5 h-5 text-gray-600 group-hover:animate-pulse" />
        )}
      </div>
    </button>
  );
};

export default DarkModeToggle;