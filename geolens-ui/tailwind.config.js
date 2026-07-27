/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgDark: '#000000',
        bgPanel: '#0a0a0a',
        borderColor: '#333333',
        textMain: '#ffffff',
        textMuted: '#888888',
      },
      fontFamily: {
        heading: ['Space Grotesk', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      boxShadow: {
        'brutal-orange': '6px 6px 0px #FF4500',
        'brutal-green': '6px 6px 0px #00FF00',
        'brutal-border': '6px 6px 0px #333333',
        'brutal-btn-orange': '4px 4px 0px #FF4500',
        'brutal-btn-green': '4px 4px 0px #00FF00',
      },
      backgroundImage: {
        'brutal-grid': 'linear-gradient(#333333 1px, transparent 1px), linear-gradient(90deg, #333333 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid-size': '50px 50px',
      },
    },
  },
  plugins: [],
}
