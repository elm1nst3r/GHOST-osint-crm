// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./src/**/*.{js,jsx,ts,tsx}", // Scan all JS/JSX/TS/TSX files in the src directory
      "./public/index.html",      // Scan your main HTML file
    ],
    theme: {
      extend: {
        fontFamily: {
          sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Inter', 'sans-serif'],
        },
        colors: {
          // Liquid glass color palette
          glass: {
            50: 'rgba(255, 255, 255, 0.95)',
            100: 'rgba(255, 255, 255, 0.9)',
            200: 'rgba(255, 255, 255, 0.8)',
            300: 'rgba(255, 255, 255, 0.7)',
            400: 'rgba(255, 255, 255, 0.6)',
            500: 'rgba(255, 255, 255, 0.5)',
            600: 'rgba(255, 255, 255, 0.4)',
            700: 'rgba(255, 255, 255, 0.3)',
            800: 'rgba(255, 255, 255, 0.2)',
            900: 'rgba(255, 255, 255, 0.1)',
          },
          dark: {
            glass: 'rgba(0, 0, 0, 0.1)',
            'glass-heavy': 'rgba(0, 0, 0, 0.2)',
          },
          accent: {
            primary: '#007AFF',
            secondary: '#5AC8FA', 
            tertiary: '#AF52DE',
            success: '#34C759',
            warning: '#FF9500',
            danger: '#FF3B30',
          }
        },
        backgroundImage: {
          // Liquid glass gradients
          'gradient-glass': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
          'gradient-glass-dark': 'linear-gradient(135deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0.05) 100%)',
          'gradient-primary': 'linear-gradient(135deg, #007AFF 0%, #5AC8FA 100%)',
          'gradient-secondary': 'linear-gradient(135deg, #5AC8FA 0%, #AF52DE 100%)',
          'gradient-success': 'linear-gradient(135deg, #34C759 0%, #30D158 100%)',
          'gradient-warning': 'linear-gradient(135deg, #FF9500 0%, #FFCC02 100%)',
          'gradient-danger': 'linear-gradient(135deg, #FF3B30 0%, #FF6961 100%)',
          'gradient-cosmic': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          'gradient-ocean': 'linear-gradient(135deg, #2196F3 0%, #21CBF3 100%)',
          'gradient-sunset': 'linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)',
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
          'float': 'float 6s ease-in-out infinite',
          'glow': 'glow 2s ease-in-out infinite alternate',
          'shimmer': 'shimmer 2.5s linear infinite',
          'pulse-soft': 'pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        },
        keyframes: {
          float: {
            '0%, 100%': { transform: 'translateY(0px)' },
            '50%': { transform: 'translateY(-10px)' },
          },
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
          'glass': '16px',
          'glass-lg': '24px',
          'glass-xl': '32px',
        }
      },
    },
    plugins: [
      // Custom plugin for glass morphism utilities
      function({ addUtilities }) {
        const newUtilities = {
          '.glass': {
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
          },
          '.glass-dark': {
            background: 'rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
          },
          '.glass-heavy': {
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 15px 35px 0 rgba(31, 38, 135, 0.2)',
          },
          '.glass-card': {
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
          },
          '.glass-button': {
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            transition: 'all 0.3s ease',
          },
          '.glass-button:hover': {
            background: 'rgba(255, 255, 255, 0.25)',
            boxShadow: '0 0 20px rgba(0, 122, 255, 0.3)',
          },
        }
        addUtilities(newUtilities)
      }
    ],
  }
  