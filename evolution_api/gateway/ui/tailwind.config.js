/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Home Assistant colors
        'ha-primary': '#03a9f4',
        'ha-secondary': '#0288d1',
        'ha-background': '#f5f5f5',
        'ha-card': '#ffffff',
        'ha-text': '#212121',
        'ha-text-secondary': '#757575',
        // WhatsApp colors
        'wa-green': '#25D366',
        'wa-dark': '#128C7E',
        'wa-light': '#dcf8c6',
      },
    },
  },
  plugins: [],
}
