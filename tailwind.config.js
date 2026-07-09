/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#14171A',
          soft: '#1C2126',
          line: '#2A2F35',
        },
        parchment: {
          DEFAULT: '#F6F3EC',
          dim: '#DEDACD',
        },
        brass: {
          DEFAULT: '#C9A24B',
          bright: '#E0BE6E',
          dim: '#8A6F35',
        },
        signal: {
          go: '#3FA772',
          hold: '#D9A441',
          stop: '#B24C3A',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        widest2: '0.22em',
      },
      boxShadow: {
        stamp: '0 0 0 1px rgba(201,162,75,0.35), 0 8px 24px -8px rgba(0,0,0,0.6)',
      },
      backgroundImage: {
        grain: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
}
