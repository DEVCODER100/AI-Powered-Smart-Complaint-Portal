/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        border: "hsl(var(--border))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          dark: "hsl(var(--primary-dark))",
          foreground: "hsl(var(--primary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', "system-ui", "sans-serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 4px 24px -6px rgba(30, 42, 120, 0.10), 0 2px 8px -4px rgba(30, 42, 120, 0.06)",
        soft: "0 8px 32px -8px rgba(30, 42, 120, 0.14)",
        pop: "0 12px 40px -8px rgba(30, 42, 120, 0.22)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pop-in": {
          from: { opacity: "0", transform: "translateY(-6px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out both",
        "pop-in": "pop-in 0.16s ease-out both",
      },
    },
  },
  plugins: [],
};
