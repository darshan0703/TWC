/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FCFBF8',
          100: '#F8F5EE', // Main kiosk background
          200: '#F0EAE1',
          300: '#E6DDD1',
        },
        ivory: {
          DEFAULT: '#FFFFFF', // Card surfaces
          warm: '#FDFBF7',
        },
        navy: {
          DEFAULT: '#1C2A39', // Primary text & primary CTA buttons
          charcoal: '#243342',
          dark: '#131E2A',
          light: '#31465A',
          muted: '#4D6175',
        },
        beige: {
          DEFAULT: '#EAE3D9', // Selected states
          muted: '#D8CFC4',   // Dividers & subtle borders
          light: '#F3EFE9',
          dark: '#C5BBAE',
        },
        taupe: {
          warm: '#7A6F64',
          light: '#9E948A',
          dark: '#5C5248',
        },
        twc: {
          navy: '#1C2A39',
          terracotta: '#C36B46',
          sand: '#ECE5DB',
          green: '#2B7A4B',
        }
      },
      fontFamily: {
        sans: ['"Lato"', '"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      boxShadow: {
        'kiosk': '0 6px 24px rgba(28, 42, 57, 0.06)',
        'kiosk-lg': '0 12px 36px rgba(28, 42, 57, 0.09)',
        'touch': '0 2px 0 rgba(0,0,0,0.04)',
      }
    },
  },
  plugins: [],
}
