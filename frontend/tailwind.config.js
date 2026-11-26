/**
 * Gigly design tokens — Design Board 01A (Foundations & Components).
 * Token names follow the board: brand.primary, brand.accent, surface.*, text.*, border.*, feedback.*.
 * @type {import('tailwindcss').Config}
 */
export default {
  // Hover styles only apply on devices with a real pointer, so taps never leave cards stuck lifted.
  future: { hoverOnlyWhenSupported: true },
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#4A3FC1', // brand.primary
          hover: '#3A31A0', // brand.primary.hover
          soft: '#F0EFFA', // brand.primary.soft
        },
        accent: {
          DEFAULT: '#F8982B', // brand.accent — never under white text (fails contrast)
          strong: '#944600', // brand.accent.strong
          soft: '#FFF1DB', // brand.accent.soft
        },
        surface: '#FFFFFF', // surface.default
        canvas: '#F6F6F8', // surface.canvas
        ink: {
          DEFAULT: '#1A1A22', // text.primary
          muted: '#5E5F6B', // text.secondary
        },
        line: {
          DEFAULT: '#E3E4E9', // border.subtle
          control: '#7A7B88', // border.control
        },
        danger: { DEFAULT: '#B42318', soft: '#FEF3F2' }, // feedback.error
        success: { DEFAULT: '#067647', soft: '#ECFDF3' },
        info: { DEFAULT: '#175CD3', soft: '#EFF8FF' },
        disabled: { bg: '#E3E4E9', text: '#5E5F6B' },
      },
      fontFamily: {
        sans: ['Figtree', '"Inter Variable"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Typography scale from Board 01A (mobile values; desktop steps up via md: prefix)
        display: ['2rem', { lineHeight: '2.5rem', fontWeight: '700', letterSpacing: '-0.02em' }],
        'display-lg': ['2.5rem', { lineHeight: '3rem', fontWeight: '700', letterSpacing: '-0.02em' }],
        h1: ['1.5rem', { lineHeight: '2rem', fontWeight: '600', letterSpacing: '-0.015em' }],
        'h1-lg': ['1.75rem', { lineHeight: '2.25rem', fontWeight: '600', letterSpacing: '-0.015em' }],
        h2: ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600', letterSpacing: '-0.01em' }],
        h3: ['1.125rem', { lineHeight: '1.625rem', fontWeight: '600' }],
        body: ['1rem', { lineHeight: '1.5rem' }],
        small: ['0.875rem', { lineHeight: '1.25rem' }],
        caption: ['0.75rem', { lineHeight: '1.125rem' }],
        numeric: ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],
      },
      borderRadius: {
        sm: '8px',
        md: '10px',
        lg: '14px',
      },
      boxShadow: {
        card: 'none',
        lift: '0 4px 14px -6px rgba(26, 26, 34, 0.14)',
        float: '0 12px 32px -10px rgba(26, 26, 34, 0.22)',
        focus: '0 0 0 3px #FFFFFF, 0 0 0 5px #4A3FC1',
      },
      spacing: { sidebar: '248px' },
      maxWidth: { content: '1240px' },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
        drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        pop: { from: { opacity: '0', transform: 'scale(0.96) translateY(-4px)' }, to: { opacity: '1', transform: 'none' } },
        check: { from: { opacity: '0', transform: 'scale(0.6)' }, to: { opacity: '1', transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        pulseDot: { '0%,100%': { opacity: '0.35' }, '50%': { opacity: '1' } },
        scan: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(250%)' } },
      },
      animation: {
        rise: 'rise 380ms cubic-bezier(0.23, 1, 0.32, 1) both',
        fade: 'fade 240ms ease-out both',
        pop: 'pop 180ms cubic-bezier(0.23, 1, 0.32, 1) both',
        check: 'check 200ms cubic-bezier(0.23, 1, 0.32, 1) both',
        'pulse-dot': 'pulseDot 1.2s ease-in-out infinite',
        scan: 'scan 1.6s cubic-bezier(0.45, 0, 0.55, 1) infinite',
      },
    },
  },
  plugins: [],
}
