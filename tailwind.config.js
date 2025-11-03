/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          'blue-dark': '#0B2B6B',  // --brand-blue-dark (AlmaLinks dark blue)
          'blue-light': '#2E7FEF', // --brand-blue-light (AlmaLinks light blue)
          dark: '#0B2B6B',         // --brand-dark (primary/navy)
          mid: '#1E56B3',          // --brand-mid (hover state)  
          light: '#2E7FEF',        // --brand-light (accent/light blue)
        },
        bg: '#FFFFFF',        // --bg
        text: '#1C1C1C',      // --text
        muted: '#6B7280',     // --muted
        border: '#E5E7EB',    // --border
      },
      animation: {
        marquee: 'marquee var(--duration, 30s) linear infinite'
      },
      keyframes: {
        marquee: {
          to: { transform: 'translateX(-50%)' }
        }
      }
    },
  },
  plugins: [],
};