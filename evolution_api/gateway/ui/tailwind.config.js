/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Mushroom-inspired dark theme
        mushroom: {
          bg: '#1c1c1c',
          'bg-secondary': '#232323',
          card: '#2a2a2a',
          'card-hover': '#333333',
          border: '#3a3a3a',
          text: '#e1e1e1',
          'text-secondary': '#9a9a9a',
          'text-muted': '#6a6a6a',
          accent: '#7c7c7c',
        },
        // Primary colors (soft teal/cyan - matches HA accent)
        primary: {
          DEFAULT: '#48b0c1',
          hover: '#3a9aaa',
          muted: 'rgba(72, 176, 193, 0.15)',
        },
        // Status colors (muted/soft versions)
        success: {
          DEFAULT: '#4caf50',
          muted: 'rgba(76, 175, 80, 0.15)',
          text: '#81c784',
        },
        warning: {
          DEFAULT: '#ff9800',
          muted: 'rgba(255, 152, 0, 0.15)',
          text: '#ffb74d',
        },
        danger: {
          DEFAULT: '#f44336',
          muted: 'rgba(244, 67, 54, 0.15)',
          text: '#e57373',
        },
        info: {
          DEFAULT: '#2196f3',
          muted: 'rgba(33, 150, 243, 0.15)',
          text: '#64b5f6',
        },
        // WhatsApp accent (soft green)
        whatsapp: {
          DEFAULT: '#25D366',
          muted: 'rgba(37, 211, 102, 0.15)',
          dark: '#128C7E',
        },
      },
      borderRadius: {
        'mushroom': '12px',
        'mushroom-lg': '16px',
        'mushroom-xl': '20px',
      },
      boxShadow: {
        'mushroom': '0 2px 8px rgba(0, 0, 0, 0.3)',
        'mushroom-lg': '0 4px 16px rgba(0, 0, 0, 0.4)',
        'mushroom-glow': '0 0 20px rgba(72, 176, 193, 0.2)',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
