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
          // Accent colors. `primary` is runtime-themable via CSS custom
          // properties set by ThemeContext (Settings → Appearance); the
          // status colors stay fixed hex values.
          accent: {
            primary: 'rgb(var(--accent) / <alpha-value>)',
            'primary-hover': 'rgb(var(--accent-hover) / <alpha-value>)',
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
          // The one gradient still in use — follows the runtime accent
          'gradient-primary': 'linear-gradient(135deg, rgb(var(--accent)) 0%, rgb(var(--accent-hover)) 100%)',
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
          'shimmer': 'shimmer 2.5s linear infinite',
          'pulse-soft': 'pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        },
        keyframes: {
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
          // Quiet, modern elevation scale (legacy names kept so existing
          // usages restyle in place)
          'glass': '0 1px 2px 0 rgb(15 23 42 / 0.04)',
          'glass-lg': '0 1px 3px 0 rgb(15 23 42 / 0.05), 0 4px 12px -2px rgb(15 23 42 / 0.06)',
          'glass-xl': '0 2px 4px 0 rgb(15 23 42 / 0.05), 0 12px 32px -4px rgb(15 23 42 / 0.12)',
          'inner-glass': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
        },
        borderRadius: {
          'glass': 'var(--radius-control)',   // controls / nav items
          'glass-sm': '6px',                  // small elements
          'glass-lg': 'var(--radius-card)',   // cards
          'glass-xl': '16px',                 // modals
        }
      },
    },
    plugins: [
      // Surface utilities. Solid, bordered surfaces by default; the
      // `[data-surface="glass"]` overrides (set on <html> by ThemeContext)
      // restore translucency + blur for users who choose the Glass style.
      function({ addUtilities }) {
        const newUtilities = {
          // ── Solid (default) — light ──
          '.glass': {
            background: 'rgb(255 255 255)',
            border: '1px solid rgb(226 232 240)',
            boxShadow: '0 1px 2px 0 rgb(15 23 42 / 0.04)',
          },
          '.glass-heavy': {
            background: 'rgb(255 255 255)',
            border: '1px solid rgb(226 232 240)',
            boxShadow: '0 1px 3px 0 rgb(15 23 42 / 0.06)',
          },
          '.glass-card': {
            background: 'rgb(255 255 255)',
            border: '1px solid rgb(226 232 240)',
            borderRadius: 'var(--radius-card)',
            boxShadow: '0 1px 2px 0 rgb(15 23 42 / 0.04)',
          },
          '.glass-button': {
            background: 'rgb(248 250 252)',
            border: '1px solid rgb(226 232 240)',
            transition: 'background-color 0.15s ease, border-color 0.15s ease',
          },
          '.glass-button:hover': {
            background: 'rgb(241 245 249)',
            borderColor: 'rgb(203 213 225)',
          },

          // ── Solid (default) — dark ──
          '.dark .glass': {
            background: 'rgb(15 23 42)',
            border: '1px solid rgb(30 41 59)',
            boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
          },
          '.dark .glass-heavy': {
            background: 'rgb(15 23 42)',
            border: '1px solid rgb(30 41 59)',
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.35)',
          },
          '.dark .glass-card': {
            background: 'rgb(15 23 42)',
            border: '1px solid rgb(30 41 59)',
            borderRadius: 'var(--radius-card)',
            boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
          },
          '.dark .glass-button': {
            background: 'rgb(30 41 59)',
            border: '1px solid rgb(51 65 85)',
            transition: 'background-color 0.15s ease, border-color 0.15s ease',
          },
          '.dark .glass-button:hover': {
            background: 'rgb(51 65 85)',
            borderColor: 'rgb(71 85 105)',
          },

          // ── Glass opt-in — light ──
          '[data-surface="glass"] .glass': {
            background: 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(12px) saturate(160%)',
            border: '1px solid rgba(255, 255, 255, 0.45)',
            boxShadow: '0 4px 16px 0 rgba(31, 38, 135, 0.12)',
          },
          '[data-surface="glass"] .glass-heavy': {
            background: 'rgba(255, 255, 255, 0.75)',
            backdropFilter: 'blur(16px) saturate(160%)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            boxShadow: '0 8px 24px 0 rgba(31, 38, 135, 0.1)',
          },
          '[data-surface="glass"] .glass-card': {
            background: 'rgba(255, 255, 255, 0.55)',
            backdropFilter: 'blur(14px) saturate(160%)',
            border: '1px solid rgba(255, 255, 255, 0.45)',
            borderRadius: 'var(--radius-card)',
            boxShadow: '0 4px 20px 0 rgba(31, 38, 135, 0.12)',
          },
          '[data-surface="glass"] .glass-button': {
            background: 'rgba(255, 255, 255, 0.4)',
            backdropFilter: 'blur(10px) saturate(160%)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            transition: 'background-color 0.15s ease, border-color 0.15s ease',
          },
          '[data-surface="glass"] .glass-button:hover': {
            background: 'rgba(255, 255, 255, 0.6)',
            borderColor: 'rgba(255, 255, 255, 0.55)',
          },

          // ── Glass opt-in — dark ──
          '.dark[data-surface="glass"] .glass': {
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(12px) saturate(160%)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.5)',
          },
          '.dark[data-surface="glass"] .glass-heavy': {
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(16px) saturate(160%)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            boxShadow: '0 8px 24px 0 rgba(0, 0, 0, 0.6)',
          },
          '.dark[data-surface="glass"] .glass-card': {
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(14px) saturate(160%)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            borderRadius: 'var(--radius-card)',
            boxShadow: '0 4px 20px 0 rgba(0, 0, 0, 0.55)',
          },
          '.dark[data-surface="glass"] .glass-button': {
            background: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(10px) saturate(160%)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            transition: 'background-color 0.15s ease, border-color 0.15s ease',
          },
          '.dark[data-surface="glass"] .glass-button:hover': {
            background: 'rgba(30, 41, 59, 0.8)',
            borderColor: 'rgba(148, 163, 184, 0.35)',
          },
        }
        addUtilities(newUtilities)
      }
    ],
  }
