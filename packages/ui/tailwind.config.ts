import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../apps/web/app/**/*.{ts,tsx}',
    '../../apps/web/components/**/*.{ts,tsx}',
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
          50: '#E6F2F0',
          100: '#CDE5E1',
          200: '#9BCBC3',
          300: '#69B1A5',
          400: '#379787',
          500: '#075E54',
          600: '#065248',
          700: '#05463C',
          800: '#043A30',
          900: '#032E24',
        },
        surface: '#FFFFFF',
        background: '#F8FAF9',
        'text-primary': '#1A1A2E',
        'text-secondary': '#4A4A4A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
