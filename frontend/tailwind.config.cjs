/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0b0f1a',
          soft: '#0e1422',
          card: '#111827'
        },
        ink: {
          DEFAULT: '#e5e7eb',
          dim: '#9ca3af',
          link: '#7dd3fc'
        },
        brand: {
          DEFAULT: '#22d3ee',
          glow: '#67e8f9'
        }
      },
      boxShadow: {
        glow: '0 0 40px rgba(34, 211, 238, 0.15)',
        card: '0 10px 30px rgba(0,0,0,.35)'
      }
    }
  },
  plugins: []
}
