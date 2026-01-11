/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'accent-primary': '#ef4444', // Red-500
        'accent-success': '#22c55e', // Green-500
        'accent-warn': '#eab308',    // Yellow-500
        'bg-dark': '#111111',
        'bg-panel': '#1a1a1a',
        'border-color': '#333333',
        'text-main': '#ffffff',
        'text-muted': '#9ca3af',
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
