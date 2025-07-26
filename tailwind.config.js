/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // 使用 class 策略进行暗色模式切换
  theme: {
    extend: {},
  },
  plugins: [],
}