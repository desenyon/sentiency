/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}', './src/**/*.html'],
  theme: {
    extend: {
      colors: {
        matte: {
          950: '#050506',
          900: '#0a0a0c',
          850: '#0f0f12',
          800: '#141418',
          700: '#1c1c22',
          600: '#26262e',
          500: '#3a3a44',
          400: '#5c5c6a',
          300: '#8a8a98',
          200: '#b4b4c0',
          100: '#e4e4ea',
        },
        accent: {
          DEFAULT: '#5eead4',
          muted: '#2dd4bf',
          dim: '#134e4a',
        },
        danger: '#f87171',
        warn: '#fbbf24',
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        panel: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
        glow: '0 0 40px rgba(94, 234, 212, 0.08)',
      },
    },
  },
  plugins: [],
};
