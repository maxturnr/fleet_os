import type { Config } from 'tailwindcss';

// Palette mirrors the Pitch DMS "fleet" tokens (src/app/globals.css in the DMS)
// so Pitch Money looks like the same product family.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['"DM Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'] },
      colors: {
        fleet: {
          bg: 'rgb(var(--f-bg) / <alpha-value>)',
          surface: 'rgb(var(--f-surface) / <alpha-value>)',
          input: 'rgb(var(--f-input) / <alpha-value>)',
          sidebar: 'rgb(var(--f-sidebar) / <alpha-value>)',
          inverse: 'rgb(var(--f-inverse) / <alpha-value>)',
          text: 'rgb(var(--f-text) / <alpha-value>)',
          'text-secondary': 'rgb(var(--f-text-secondary) / <alpha-value>)',
          muted: 'rgb(var(--f-muted) / <alpha-value>)',
          label: 'rgb(var(--f-label) / <alpha-value>)',
          faint: 'rgb(var(--f-faint) / <alpha-value>)',
          placeholder: 'rgb(var(--f-placeholder) / <alpha-value>)',
          border: 'var(--f-border)',
          'border-input': 'var(--f-border-input)',
          'border-strong': 'var(--f-border-strong)',
          blue: 'rgb(var(--f-blue) / <alpha-value>)',
          'blue-dim': 'var(--f-blue-dim)',
          green: 'rgb(var(--f-green) / <alpha-value>)',
          'green-dim': 'var(--f-green-dim)',
          red: 'rgb(var(--f-red) / <alpha-value>)',
          'red-dim': 'var(--f-red-dim)',
          purple: 'rgb(var(--f-purple) / <alpha-value>)',
          'purple-dim': 'var(--f-purple-dim)',
          amber: 'rgb(var(--f-amber) / <alpha-value>)',
          'amber-dim': 'var(--f-amber-dim)',
        },
      },
      borderRadius: { fleet: '8px', 'fleet-lg': '10px', 'fleet-xl': '12px', 'fleet-2xl': '16px' },
      boxShadow: {
        'fleet-card': '0 1px 0 rgba(20, 19, 15, 0.05), 0 1px 3px rgba(0, 0, 0, 0.025)',
        'fleet-dropdown': '0 8px 24px rgba(24, 28, 39, 0.08)',
      },
    },
  },
  plugins: [],
};
export default config;
