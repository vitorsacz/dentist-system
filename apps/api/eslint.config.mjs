import base from "@dentist-system/eslint-config";

export default [
  ...base,
  {
    languageOptions: {
      parserOptions: {
        sourceType: "commonjs",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
