/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand palette — charcoal base, stone grey, calm blue accent.
        ink: {
          950: '#080A0E',
          900: '#0D1015',
          850: '#11151B',
          800: '#161B22',
          700: '#1E242D',
          600: '#2A323D',
        },
        stone2: {
          50: '#F5F7FA',
          100: '#E8ECF2',
          200: '#D3DAE4',
          300: '#B3BECD',
          400: '#8A97AB',
          500: '#6B7889',
          600: '#525D6D',
          700: '#3C4551',
        },
        calm: {
          50: '#EEF4FF',
          100: '#DCE7FF',
          200: '#BCD0FF',
          300: '#93B0FF',
          400: '#6B90FF',
          500: '#4C7DFF',
          600: '#3563E6',
          700: '#2A4FC0',
        },
      },
      fontFamily: {
        sans: ['Cairo', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,.35)',
        card: '0 1px 0 rgba(255,255,255,.04) inset, 0 10px 30px rgba(0,0,0,.25)',
      },
      keyframes: {
        floatUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        blink: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '.25' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateY(6px) scale(.99)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        floatUp: 'floatUp .35s ease both',
        shimmer: 'shimmer 1.6s infinite',
        blink: 'blink 1.1s infinite',
        slideIn: 'slideIn .22s ease both',
      },
    },
  },
  plugins: [],
};
