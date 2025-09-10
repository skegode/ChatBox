import type { Config } from "tailwindcss";

export default {
  darkMode: "class", // Enables class-based dark mode support
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        darkBackground: "var(--dark-background)",
        darkForeground: "var(--dark-foreground)",
      },
    },
  },
  plugins: [],
} satisfies Config;
