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
        // Semantic design tokens
        canvas: "var(--color-canvas)",
        surface: {
          DEFAULT: "var(--color-surface)",
          soft: "var(--color-surface-soft)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
        },
        border: {
          DEFAULT: "var(--color-border)",
        },
        champagne: {
          DEFAULT: "var(--color-champagne)",
        },
        accent: {
          storefront: "var(--color-storefront-accent)",
          "storefront-hover": "var(--color-storefront-accent-hover)",
          "storefront-soft": "var(--color-storefront-accent-soft)",
          champagne: "var(--color-champagne)",
        },
        // Backwards compatibility with initial tokens
        brand: {
          canvas: "var(--color-canvas)",
          surface: "var(--color-surface)",
          "surface-soft": "var(--color-surface-soft)",
          ink: "var(--color-text-primary)",
          text: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
          border: "var(--color-border)",
          champagne: "var(--color-champagne)",
        },
      },
      fontFamily: {
        display: ["var(--font-prata)", "Georgia", "serif"],
        editorial: ["var(--font-prata)", "Georgia", "serif"],
        serif: ["var(--font-prata)", "Georgia", "serif"],
        sans: ["var(--font-montserrat)", "Helvetica Neue", "sans-serif"],
      },
      maxWidth: {
        container: "1320px",
      },
      aspectRatio: {
        "4/5": "4 / 5",
      },
      boxShadow: {
        subtle: "0 1px 3px 0 rgba(63, 43, 36, 0.05), 0 1px 2px -1px rgba(63, 43, 36, 0.05)",
        card: "0 2px 6px -1px rgba(63, 43, 36, 0.06), 0 2px 4px -2px rgba(63, 43, 36, 0.04)",
        hover: "0 6px 16px -2px rgba(63, 43, 36, 0.08), 0 2px 6px -2px rgba(63, 43, 36, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
