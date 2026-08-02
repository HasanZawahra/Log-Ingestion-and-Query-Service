import js from "@eslint/js";
import configPrettier from "eslint-config-prettier";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "**/*.ts", "**/*.tsx"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {},
  },
  configPrettier,
];
