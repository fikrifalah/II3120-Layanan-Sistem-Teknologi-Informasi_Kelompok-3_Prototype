/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6354C7',
          hover: '#493BA5',
          subtle: '#EEEBFA',
        },
        accent: {
          DEFAULT: '#F5A04A',
          subtle: '#FFF1E2',
        },
        page: '#F8F9FC',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#202135',
          muted: '#686B80',
        },
        line: '#E3E5EE',
        success: { DEFAULT: '#20845A', subtle: '#E4F4EC' },
        warning: { DEFAULT: '#A86608', subtle: '#FDF0DC' },
        danger: { DEFAULT: '#C83E4D', subtle: '#FBE9EB' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        display: ['2.5rem', { lineHeight: '3rem', fontWeight: '700', letterSpacing: '-0.02em' }],
        h1: ['2rem', { lineHeight: '2.5rem', fontWeight: '700', letterSpacing: '-0.015em' }],
        h2: ['1.5rem', { lineHeight: '2rem', fontWeight: '700', letterSpacing: '-0.01em' }],
        h3: ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],
        body: ['1rem', { lineHeight: '1.5rem' }],
        small: ['0.875rem', { lineHeight: '1.25rem' }],
        caption: ['0.75rem', { lineHeight: '1rem', fontWeight: '500' }],
      },
      spacing: {
        4.5: '1.125rem',
      },
      borderRadius: {
        input: '12px',
        card: '16px',
        modal: '24px',
      },
      boxShadow: {
        float: '0 8px 24px rgba(32, 33, 53, 0.12)',
      },
      maxWidth: {
        content: '1200px',
      },
      width: {
        sidebar: '240px',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
        drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        rise: 'rise 320ms cubic-bezier(0.23, 1, 0.32, 1) both',
      },
    },
  },
  plugins: [],
}
