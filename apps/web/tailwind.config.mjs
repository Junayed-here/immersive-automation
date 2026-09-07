/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#16211C',
        paper: '#EDEFEC',
        surface: '#FFFFFF',
        verdigris: {
          DEFAULT: '#3E6E63',
          dark: '#2C5049',
          light: '#5C8E82',
        },
        copper: '#B9713D',
        slate: '#556059',
        line: '#D8DCD6',
        success: '#3E7A52',
        danger: '#A6432F',
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        sans: ['var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        lg: '10px',
      },
    },
  },
  plugins: [],
};
