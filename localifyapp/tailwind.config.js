/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}", 
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  
  presets: [require("nativewind/preset")],
  
  theme: {
    extend: {
      
      fontFamily: {
      poppins: ["Poppins-Regular"],
      poppinsMedium: ["Poppins-Medium"],
      poppinsBold: ["Poppins-Bold"],
      poppinsSemiBold: ["Poppins-SemiBold"]
      },
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        primary: "rgb(var(--primary) / <alpha-value>)",
        textColor: "rgb(var(--text) / <alpha-value>)",
      },
      
    },
  },
  plugins: [],
};