/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ─── WC 2026 Font Families ───────────────────────────────────────────────
      // Matches the official FWC 2026 typeface hierarchy as closely as possible
      // using free Google Fonts.
      fontFamily: {
        // Body / UI text — official FIFA secondary typeface
        sans:    ['"Noto Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Section headings, nav, card titles — closest match to FWC 2026 condensed
        heading: ['"Barlow Condensed"', 'ui-sans-serif', 'sans-serif'],
        // Ultra-large display / logo numbers only (all-caps ultra-condensed)
        display: ['"Bebas Neue"', '"Barlow Condensed"', 'sans-serif'],
      },

      // ─── WC 2026 Color Palette ───────────────────────────────────────────────
      colors: {
        // Navy-tinted grays (all existing bg-gray-* → WC navy tones)
        gray: {
          50:  '#f0f2fa',
          100: '#dde2f4',
          200: '#bac3e8',
          300: '#94a0d8',
          400: '#7080c8',
          500: '#4d5ea8',
          600: '#2d3f75',
          700: '#1e2d5a',
          800: '#131e3d',
          900: '#0b1530',
          950: '#060d1c',
        },

        // Primary — WC Hermes Blue
        primary: {
          50:  '#eef0fb',
          100: '#d5daf5',
          200: '#aab4eb',
          300: '#7a8ddf',
          400: '#5068d4',
          500: '#3449ca',
          600: '#2A398D',
          700: '#1f2a68',
          800: '#141c47',
          900: '#0a1028',
          950: '#05081a',
        },

        // WC Torch Red
        red: {
          50:  '#fff1f1',
          100: '#ffd9da',
          200: '#ffb3b5',
          300: '#ff7a7d',
          400: '#f84d51',
          500: '#E61D25',
          600: '#c4181f',
          700: '#a3141a',
          800: '#871418',
          900: '#701315',
          950: '#3d0508',
        },

        // WC Average Green
        green: {
          50:  '#f0fbf0',
          100: '#d9f5d8',
          200: '#b3ebb2',
          300: '#7ada7c',
          400: '#4ec94e',
          500: '#3CAC3B',
          600: '#2d8c2d',
          700: '#256e26',
          800: '#1f5720',
          900: '#1a481a',
          950: '#0a280b',
        },

        // Gold — trophy / exact scores
        gold: {
          300: '#fcd06b',
          400: '#f9bc3a',
          500: '#F5A623',
          600: '#d4881a',
          700: '#b06c12',
        },
      },

      // ─── Animations ──────────────────────────────────────────────────────────
      keyframes: {
        'live-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.35' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
      },
      animation: {
        'live-pulse': 'live-pulse 1.4s ease-in-out infinite',
        'fade-up':    'fade-up 0.3s ease-out',
        'shimmer':    'shimmer 2.5s linear infinite',
      },
    },
  },
  plugins: [],
  // Enable rtl: variant — activated automatically when <html dir="rtl"> is set
  future: { hoverOnlyWhenSupported: true },
}
