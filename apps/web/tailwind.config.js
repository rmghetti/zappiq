/** @type {import('tailwindcss').Config} */
const path = require('path');

module.exports = {
  content: [
    path.join(__dirname, './app/**/*.{js,ts,jsx,tsx}'),
    path.join(__dirname, './components/**/*.{js,ts,jsx,tsx}'),
    path.join(__dirname, './lib/**/*.{js,ts,jsx,tsx}'),
    path.join(__dirname, '../../packages/ui/src/**/*.{js,ts,jsx,tsx}'),
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1B6B3A',
          50: '#E8F5EE',
          100: '#D1EBDD',
          200: '#A3D7BB',
          300: '#75C399',
          400: '#47AF77',
          500: '#1B6B3A',
          600: '#175C32',
          700: '#134D2A',
          800: '#0F3E22',
          900: '#0B2F19',
        },
        secondary: {
          DEFAULT: '#25D366',
          50: '#E6FAF0',
          100: '#CCF5E1',
          200: '#99EBC3',
          300: '#66E1A5',
          400: '#33D787',
          500: '#25D366',
          600: '#1EB855',
          700: '#189D47',
          800: '#128239',
          900: '#0C672B',
        },
        accent: {
          DEFAULT: '#075E54',
          500: '#075E54',
        },
        surface: '#FFFFFF',
        background: '#F8FAF9',
        'text-primary': '#1A1A2E',
        'text-secondary': '#4A4A4A',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
