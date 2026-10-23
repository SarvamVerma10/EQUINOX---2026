/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        forest: '#1E4620',
        deepGreen: '#132A13',
        softGreen: '#E9F5EC',
        accentLime: '#4E9F3D',
        wetGreen: '#1F8A4C',
        dryBlue: '#1769AA',
        hazRed: '#B4232F',
        neutralGrey: '#667085',
        creamBg: '#F7F8F4',
      },
    },
  },
  plugins: [],
};
