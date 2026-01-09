/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          50: '#fef2f4',
          100: '#fce7eb',
          200: '#f9d0d9',
          300: '#f4a9b8',
          400: '#ec7994',
          500: '#8e8ea0',
          600: '#565869',
          700: '#3d2a35',
          800: '#2d1f28',
          900: '#1a1118',
          950: '#0f0a0d',
        },
        romantic: {
          50: '#fff1f3',
          100: '#ffe4e8',
          200: '#fecdd6',
          300: '#fda4b8',
          400: '#fb7193',
          500: '#f43f6b',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
          950: '#4c0519',
        },
        coral: {
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
        },
        blush: {
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
        },
      },
      fontFamily: {
        'romantic': ['"Playfair Display"', 'serif'],
        'poetic': ['"Cormorant Garamond"', 'serif'],
      },
    },
  },
  plugins: [],
}
