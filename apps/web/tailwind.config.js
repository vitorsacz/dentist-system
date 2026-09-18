/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app: "#f3f5f8",
        surface: "#ffffff",
        ink: "#101e3d",
        muted: "#5c6b85",
        accent: {
          DEFAULT: "#3563e9",
          soft: "#e3e9fb",
        },
        line: "#dee4ef",
        good: "#227a52",
        bad: "#b23b3b",
        // Adição pontual pro dashboard da Plataforma (design system TailAdmin,
        // ver Obsidian "feature - design-system-tailadmin-referencia"):
        // accent≈brand, good≈success, bad≈error já cobrem o resto, só faltava
        // um tom de aviso e um cinza claro pra fundo de ícone de stat card.
        warning: {
          DEFAULT: "#f79009",
          soft: "#fffaeb",
        },
        gray: {
          100: "#f2f4f7",
        },
      },
    },
  },
  plugins: [],
};
