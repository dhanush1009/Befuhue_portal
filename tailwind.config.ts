import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#FF002C',
          hover: '#E50027',
          light: '#FFF1F2',
          muted: '#FB7185',
          50: '#FFF1F2',
          100: '#FFE4E6',
          200: '#FECDD3',
          300: '#FDA4AF',
          400: '#FB7185',
          500: '#FF002C',
          600: '#E50027',
          700: '#CC0023',
          800: '#9E001B',
          900: '#7F0015',
          950: '#4C000C',
        },
        sidebar: {
          bg: '#0F0F12',
          text: '#A1A1AA',
          active: '#FF002C',
          hover: '#18181D',
        },
        status: {
          present: '#16A34A',
          absent: '#DC2626',
          wfh: '#D97706',
          leave: '#DB2777',
          holiday: '#0891B2',
        },
        priority: {
          p0: '#DC2626',
          p1: '#D97706',
          p2: '#2563EB',
          p3: '#6B7280',
        },
      },
      fontFamily: {
        sans: ['var(--font-mortane)', 'Mortane', 'Mortane Sans', 'MortaneDEMO', 'sans-serif'],
      },
      letterSpacing: {
        tighter: '0.025em',
        tight: '0.04em',
        normal: '0.05em',
        wide: '0.08em',
        wider: '0.12em',
        widest: '0.18em',
      },
    },
  },
  plugins: [],
};

export default config;
