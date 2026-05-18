import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#1D9E75',
        },
        risk: {
          high: '#E24B4A',
          medium: '#EF9F27',
          low: '#639922',
          info: '#378ADD',
        },
        shell: {
          bgLight: '#f9fafb',
          bgDark: '#111111',
        },
        border: {
          light: '#e5e7eb',
          dark: '#2a2a2a',
        },
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      spacing: {
        sidebar: '220px',
        topbar: '52px',
      },
      borderRadius: {
        card: '12px',
      },
      borderWidth: {
        hairline: '0.5px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
} satisfies Config;
