/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        panel: '#16191d',
        'panel-2': '#1d2227',
        machined: '#272d33',
        'machined-hi': '#323941',
        hairline: '#3a424a',
        ink: '#eceff2',
        'ink-2': '#aab3bb',
        'ink-3': '#727c85',
        accent: '#47c7bd',
        'accent-dim': '#2c6f6a',
        warn: '#e6a23c',
        danger: '#e5594e',
        ok: '#62b97c',
      },
      fontFamily: {
        display: ['"Saira Condensed"', 'system-ui', 'sans-serif'],
        sans: ['Saira', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
