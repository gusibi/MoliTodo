/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        primary: '#3b82f6',
        'primary-dark': '#2563eb',
        surface: { DEFAULT: '#ffffff', dark: '#111827' },
        text: { DEFAULT: '#1f2937', dark: '#f3f4f6' },
        muted: { DEFAULT: '#6b7280', dark: '#9ca3af' },
        border: { DEFAULT: '#e5e7eb', dark: '#374151' },
        bg: { DEFAULT: '#f9fafb', dark: '#030712' },
      },
    },
  },
  plugins: [],
};
