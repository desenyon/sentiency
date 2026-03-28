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
        'glow-sm': '0 0 24px rgba(94, 234, 212, 0.12)',
        insetHighlight: 'inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        breathe: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.65' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.35s ease-out both',
        shimmer: 'shimmer 2.5s ease-in-out infinite',
        'scale-in': 'scale-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) both',
        breathe: 'breathe 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
