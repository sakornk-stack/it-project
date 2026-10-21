import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

// Theme-aware palettes: every step reads a CSS variable defined in
// src/styles/theme-palette.css (stock Tailwind values in light, a mirrored
// scale in dark), so existing slate-/emerald-/amber-… classes follow the theme.
const PALETTE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const themedPalette = (name: string) =>
  Object.fromEntries(PALETTE_STEPS.map((step) => [step, `rgb(var(--${name}-${step}) / <alpha-value>)`]));

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
      },
      // Thai-safe line heights: tone marks and vowels above/below the line need more room
      // than Latin text, so every step keeps at least ~1.5.
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.25rem' }],
        sm: ['0.875rem', { lineHeight: '1.5rem' }],
        base: ['1rem', { lineHeight: '1.625rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.875rem' }],
        '2xl': ['1.5rem', { lineHeight: '2.125rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.5rem' }],
      },
      colors: {
        slate: themedPalette('slate'),
        emerald: themedPalette('emerald'),
        amber: themedPalette('amber'),
        red: themedPalette('red'),
        sky: themedPalette('sky'),
        violet: themedPalette('violet'),
        rose: themedPalette('rose'),
        blue: themedPalette('blue'),
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        brand: {
          DEFAULT: 'hsl(var(--brand))',
          foreground: 'hsl(var(--brand-foreground))',
          light: 'hsl(var(--brand-light))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
      },
      // One very thin shadow for every resting card; hover lifts use .interactive-card.
      boxShadow: {
        card: '0 1px 2px 0 hsl(var(--foreground) / 0.05)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      // Defined here rather than globals.css so they work with variants
      // (e.g. `before:animate-shimmer`).
      keyframes: {
        shimmer: {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(100%)' },
        },
        pop: {
          '0%': { transform: 'scale(0)' },
          '60%': { transform: 'scale(1.25)' },
          '100%': { transform: 'scale(1)' },
        },
        // Pair with pathLength={1} strokeDasharray={1} on the SVG shape.
        'radar-draw': {
          from: { strokeDashoffset: '1' },
          to: { strokeDashoffset: '0' },
        },
        'radar-fill': {
          from: { fillOpacity: '0' },
          to: { fillOpacity: '0.2' },
        },
        // Whole-chart entrance: grows out from its centre (see origin-center on the user).
        'radar-grow': {
          from: { transform: 'scale(0.6)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        'radar-dot': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        // Digit-entry feedback on OtpInput — quick bounce, not the
        // from-zero `pop` above (that one's for badges appearing).
        'otp-digit-pop': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)' },
        },
        // --x/--y/--r (and --fall for the viewport variant) are set per piece by ConfettiBurst.
        confetti: {
          '0%': { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: '1' },
          '35%': {
            transform: 'translate(calc(-50% + var(--x)), calc(-50% + var(--y))) rotate(calc(var(--r) * 0.4))',
            opacity: '1',
          },
          '100%': {
            transform:
              'translate(calc(-50% + var(--x) * 1.3), calc(-50% + var(--y) + var(--fall, 160px))) rotate(var(--r))',
            opacity: '0',
          },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s ease-in-out infinite',
        // Delayed so it lands after the toast's 300ms slide-in.
        pop: 'pop 400ms ease-out 200ms both',
        // Outline draws first, then the fill and vertex dots settle in.
        'radar-shape': 'radar-draw 900ms ease-out both, radar-fill 500ms ease-out 600ms both',
        'radar-grow': 'radar-grow 600ms ease-out both',
        'radar-dot': 'radar-dot 300ms ease-out 800ms both',
        'spark-line': 'radar-draw 900ms ease-out both',
        'otp-digit-pop': 'otp-digit-pop 220ms ease-out',
        confetti: 'confetti 1400ms cubic-bezier(0.2, 0.7, 0.4, 1) both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
