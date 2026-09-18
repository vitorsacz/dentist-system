/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Outfit", "system-ui", "sans-serif"],
      },
      colors: {
        // Tokens legados, usados em toda página existente do app — os
        // valores foram re-hexados pros equivalentes oficiais do design
        // system (ver Obsidian "design-system-plataforma-odontologica"),
        // então o app inteiro herda a paleta nova sem precisar reescrever
        // nenhuma classe. app≈gray-50, surface≈white, ink≈gray-800/
        // text-primary, muted≈gray-500/text-secondary, accent≈brand-500,
        // line≈gray-200/border-default, good≈success-text, bad≈error-text.
        app: "#F9FAFB",
        surface: "#FFFFFF",
        ink: "#1D2939",
        muted: "#667085",
        accent: {
          DEFAULT: "#465FFF",
          soft: "#ECF3FF",
        },
        line: "#E4E7EC",
        good: "#039855",
        bad: "#D92D20",

        // Tokens oficiais do design system, aditivos — pra componentes
        // novos/migrados que precisam do tom "-light" exato em vez da
        // aproximação por opacidade (`bg-good/10`) usada nas páginas antigas.
        brand: { 50: "#ECF3FF", 500: "#465FFF" },
        gray: {
          50: "#F9FAFB",
          100: "#F2F4F7",
          200: "#E4E7EC",
          500: "#667085",
          700: "#344054",
          800: "#1D2939",
          900: "#101828",
        },
        success: { solid: "#12B76A", text: "#039855", light: "#ECFDF3" },
        error: { solid: "#F04438", text: "#D92D20", light: "#FEF3F2" },
        warning: { solid: "#F79009", text: "#DC6803", light: "#FFFAEB" },
        info: { solid: "#0BA5EC", light: "#F0F9FF" },
      },
    },
  },
  plugins: [],
};
