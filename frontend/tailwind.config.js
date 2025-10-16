// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./src/**/*.{js,jsx,ts,tsx}", // Scan all JS/JSX/TS/TSX files in the src directory
      "./public/index.html",      // Scan your main HTML file
    ],
    darkMode: 'class', // Enable class-based dark mode
    theme: {
      extend: {
        fontFamily: {
          sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Inter', 'sans-serif'],
        },
        colors: {
          // Professional glass color palette with enhanced contrast
          glass: {
            50: 'rgba(255, 255, 255, 0.98)',
            100: 'rgba(255, 255, 255, 0.95)',
            200: 'rgba(255, 255, 255, 0.85)',
            300: 'rgba(255, 255, 255, 0.75)',
            400: 'rgba(255, 255, 255, 0.65)',
            500: 'rgba(255, 255, 255, 0.55)',
            600: 'rgba(255, 255, 255, 0.45)',
            700: 'rgba(255, 255, 255, 0.35)',
            800: 'rgba(255, 255, 255, 0.25)',
            900: 'rgba(255, 255, 255, 0.15)',
          },
          dark: {
            glass: 'rgba(15, 23, 42, 0.65)',
            'glass-heavy': 'rgba(15, 23, 42, 0.85)',
          },
          // Professional accent colors with better contrast
          accent: {
            primary: '#0066CC',      // Deeper blue for better contrast
            secondary: '#0891B2',    // Cyan-600 for professional look
            tertiary: '#7C3AED',     // Violet-600
            success: '#059669',      // Emerald-600
            warning: '#D97706',      // Amber-600
            danger: '#DC2626',       // Red-600
          },
          // Business colorway additions
          business: {
            navy: '#1e3a8a',         // Navy blue
            slate: '#475569',        // Professional slate
            steel: '#64748b',        // Steel gray
            charcoal: '#334155',     // Charcoal
          }
        },
        backgroundImage: {
          // Professional glass gradients with better contrast
          'gradient-glass': 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%)',
          'gradient-glass-dark': 'linear-gradient(135deg, rgba(15, 23, 42, 0.4) 0%, rgba(15, 23, 42, 0.2) 100%)',
          'gradient-primary': 'linear-gradient(135deg, #0066CC 0%, #0891B2 100%)',
          'gradient-secondary': 'linear-gradient(135deg, #0891B2 0%, #7C3AED 100%)',
          'gradient-success': 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
          'gradient-warning': 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
          'gradient-danger': 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
          'gradient-business': 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
          'gradient-ocean': 'linear-gradient(135deg, #0c4a6e 0%, #0891B2 100%)',
          'gradient-professional': 'linear-gradient(135deg, #334155 0%, #64748b 100%)',
        },
        backdropBlur: {
          xs: '2px',
          sm: '4px',
          md: '8px',
          lg: '12px',
          xl: '16px',
          '2xl': '24px',
          '3xl': '40px',
        },
        animation: {
          'glow': 'glow 2s ease-in-out infinite alternate',
          'shimmer': 'shimmer 2.5s linear infinite',
          'pulse-soft': 'pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        },
        keyframes: {
          glow: {
            '0%': { boxShadow: '0 0 20px rgba(0, 122, 255, 0.3)' },
            '100%': { boxShadow: '0 0 40px rgba(0, 122, 255, 0.6)' },
          },
          shimmer: {
            '0%': { transform: 'translateX(-100%)' },
            '100%': { transform: 'translateX(100%)' },
          },
          'pulse-soft': {
            '0%, 100%': { opacity: '1' },
            '50%': { opacity: '0.8' },
          },
        },
        boxShadow: {
          'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
          'glass-lg': '0 15px 35px 0 rgba(31, 38, 135, 0.2)',
          'glass-xl': '0 25px 50px -12px rgba(31, 38, 135, 0.25)',
          'inner-glass': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
          'glow-sm': '0 0 10px rgba(0, 122, 255, 0.3)',
          'glow-md': '0 0 20px rgba(0, 122, 255, 0.4)',
          'glow-lg': '0 0 30px rgba(0, 122, 255, 0.5)',
        },
        borderRadius: {
          'glass': '8px',        // Reduced from 16px - more professional
          'glass-sm': '6px',     // Small elements
          'glass-lg': '12px',    // Reduced from 24px - cards
          'glass-xl': '16px',    // Reduced from 32px - modals
        }
      },
    },
    plugins: [
      // Custom plugin for glass morphism utilities
      function({ addUtilities }) {
        const newUtilities = {
          // Light mode glass effects
          '.glass': {
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(12px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            boxShadow: '0 4px 16px 0 rgba(31, 38, 135, 0.2)',
          },
          '.glass-heavy': {
            background: 'rgba(255, 255, 255, 0.25)',
            backdropFilter: 'blur(16px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 8px 24px 0 rgba(31, 38, 135, 0.15)',
          },
          '.glass-card': {
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%)',
            backdropFilter: 'blur(14px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: '8px',
            boxShadow: '0 4px 20px 0 rgba(31, 38, 135, 0.18)',
          },
          '.glass-button': {
            background: 'rgba(255, 255, 255, 0.18)',
            backdropFilter: 'blur(10px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            transition: 'all 0.2s ease',
          },
          '.glass-button:hover': {
            background: 'rgba(255, 255, 255, 0.28)',
            borderColor: 'rgba(255, 255, 255, 0.35)',
            boxShadow: '0 2px 12px rgba(0, 102, 204, 0.25)',
          },

          // Dark mode glass effects - more opaque for better contrast
          '.dark .glass': {
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(12px) saturate(180%)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.5)',
          },
          '.dark .glass-heavy': {
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(16px) saturate(180%)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            boxShadow: '0 8px 24px 0 rgba(0, 0, 0, 0.6)',
          },
          '.dark .glass-card': {
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.7) 0%, rgba(15, 23, 42, 0.5) 100%)',
            backdropFilter: 'blur(14px) saturate(180%)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            borderRadius: '8px',
            boxShadow: '0 4px 20px 0 rgba(0, 0, 0, 0.6)',
          },
          '.dark .glass-button': {
            background: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(10px) saturate(180%)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            transition: 'all 0.2s ease',
          },
          '.dark .glass-button:hover': {
            background: 'rgba(30, 41, 59, 0.8)',
            borderColor: 'rgba(148, 163, 184, 0.35)',
            boxShadow: '0 2px 12px rgba(8, 145, 178, 0.3)',
          },
        }
        addUtilities(newUtilities)
      }
    ],
  }
  