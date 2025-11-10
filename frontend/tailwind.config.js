import defaultTheme from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      boxShadow: {
        page: '0 20px 70px rgba(15,23,42,.25)',
      },
      colors: {
        brand: {
          amber: '#f2e5c2',
          lilac: '#c8a2c8',
        },
      },
    },
  },
  plugins: [],
}
