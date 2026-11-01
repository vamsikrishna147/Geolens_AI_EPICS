/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'mc-bg': 'var(--color-mc-bg)',
        'mc-panel': 'var(--color-mc-panel)',
        'mc-border': 'var(--color-mc-border)',
        'mc-primary': 'var(--color-mc-primary)',
        'mc-secondary': 'var(--color-mc-secondary)',
        'mc-success': 'var(--color-mc-success)',
        'mc-warning': 'var(--color-mc-warning)',
        'mc-danger': 'var(--color-mc-danger)',
        'mc-text': 'var(--color-mc-text)',
        'mc-muted': 'var(--color-mc-muted)',
      },
      fontFamily: {
        heading: ['Syne', 'DM Sans', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        report: ['Lora', 'serif'],
      },
    },
  },
  plugins: [],
}
