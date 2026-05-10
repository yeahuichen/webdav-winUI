/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // <--- 这一行极其重要，告诉 Tailwind 扫描 src 目录下的所有文件
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}