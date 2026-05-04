/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#f8fafc',
        surface: '#ffffff',
        primary: '#3b82f6',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444'
      }
    },
  },
  plugins: [],
}
