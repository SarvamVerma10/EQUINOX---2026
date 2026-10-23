/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'Noto Sans Devanagari', 'system-ui', 'sans-serif'],
        display: ['Fredoka', 'Nunito', 'Noto Sans Devanagari', 'sans-serif'],
        poster: ['Luckiest Guy', 'Fredoka', 'sans-serif'],
        note: ['Caveat', 'cursive'],
        mono: ['Nunito', 'Noto Sans Devanagari', 'sans-serif']
      },
      colors: {
        ivory: '#0F1420',
        forest: '#4285F4',
        forestDark: '#1557B0',
        softGreen: '#161D2B',
        deepGreen: '#F3F4F8',
        wetGreen: '#1F8A4C',
        dryBlue: '#1769AA',
        hazRed: '#B4232F',
        neutralGrey: '#667085',
        creamBg: '#080B11',
      },
    },
  },
  plugins: [],
};
