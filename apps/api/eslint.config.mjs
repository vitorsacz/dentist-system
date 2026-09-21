import globals from "globals";
import base from "@dentist-system/eslint-config";

export default [
  ...base,
  {
    languageOptions: {
      parserOptions: {
        sourceType: "commonjs",
      },
      // Todo o pacote roda em Node (é a API) — sem isso, arquivos .js puros
      // com `module.exports`/`require` (ex.: test/jest-e2e.config.js) caem
      // no no-undef do eslint-config base, que não declara nenhum global.
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
