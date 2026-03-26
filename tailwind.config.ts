import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Lotus Connect Brand Colors
        lotus: {
          primary: '#0D7377',
          secondary: '#D4A843',
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#0D7377',
          600: '#0b6670',
          700: '#095861',
          800: '#064e56',
          900: '#064348',
        },
        background: '#fcfcfd',
        foreground: '#1a1a2e',
        card: {
          DEFAULT: '#f8fafb',
          foreground: '#1a1a2e',
        },
        popover: {
          DEFAULT: '#ffffff',
          foreground: '#1a1a2e',
        },
        primary: {
          DEFAULT: '#0D7377',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#D4A843',
          foreground: '#1a1a2e',
        },
        muted: {
          DEFAULT: '#f1f5f9',
          foreground: '#4a5568',
        },
        accent: {
          DEFAULT: '#f1f5f9',
          foreground: '#1a1a2e',
        },
        destructive: {
          DEFAULT: '#ef4444',
          foreground: '#ffffff',
        },
        border: '#e2e8f0',
        input: '#e2e8f0',
        ring: '#0D7377',
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
    },
  },
  plugins: [],
}
export default config
