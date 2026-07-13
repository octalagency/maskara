import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef9ff',
          100: '#d9f1ff',
          200: '#bce7ff',
          300: '#8ed8ff',
          400: '#59c0ff',
          500: '#33a1ff',
          600: '#1a82f5',
          700: '#136be1',
          800: '#1656b6',
          900: '#184a8f',
          950: '#132e57',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['Syne', 'Plus Jakarta Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
