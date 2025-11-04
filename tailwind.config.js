/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Outfit', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        'outfit': ['Outfit', 'sans-serif'],
        'brygada': ['Brygada 1918', 'serif'],
        'secondary': ['Brygada 1918', 'serif'], // Alias for secondary font
      },
      colors: {
        brand: {
          // Official Alma Brand Colors
          blue: '#009FE2',         // Alma Blue (C-98 M-12 Y-0 K-0) - Primary actions, links
          dark: '#201A5B',         // Alma Dark (C-100 M-100 Y-20 K-35) - Headers, active states
          gold: '#FCAF17',         // Alma Gold (C-0 M-35 Y-100 K-0) - Accents, highlights
          light: '#DCE8F6',        // Alma Light (C-12 M-4 Y-0 K-0) - Backgrounds, subtle elements

          // Hover states (optimized for contrast)
          'blue-hover': '#007AB8',   // Darker Alma Blue for better hover visibility
          'dark-hover': '#16123D',   // Darker Alma Dark for hover
          'gold-hover': '#D89F13',   // Darker Alma Gold for hover

          // Legacy aliases for backward compatibility
          'blue-dark': '#201A5B',  // Maps to Alma Dark
          'blue-light': '#009FE2', // Maps to Alma Blue
          mid: '#007AB8',          // Hover state for Alma Blue
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