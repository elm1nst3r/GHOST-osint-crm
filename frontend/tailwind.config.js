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
          sans: ['Inter', 'sans-serif'], // Ensure Inter is your default sans-serif font
        },
        // You can extend the theme with custom colors, spacing, etc. here
        // For example:
        // colors: {
        //   'brand-blue': '#007ace',
        // },
      },
    },
    plugins: [
      // require('@tailwindcss/forms'), // Uncomment if you want to use the official forms plugin
    ],
  }
  