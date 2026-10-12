/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/**/*.{html,js}"
  ],
  theme: {
    extend: {
      colors: {
        'brand-primary': '#0a0f1d',
        'brand-secondary': 'rgba(18, 24, 38, 0.75)',
        'brand-tertiary': 'rgba(30, 41, 59, 0.6)',
        'mint': '#a7f3d0',
        'cyan-neon': '#38bdf8',
        'pink-neon': '#f472b6'
      }
    },
  },
  plugins: [],
}
