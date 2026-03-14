import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["tests/*.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Allow unused vars prefixed with _
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Allow explicit any in CLI tooling (HubSpot API shapes are dynamic)
      "@typescript-eslint/no-explicit-any": "warn",
      // Enforce no console.log in src (use printResult instead)
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    // Relax rules for tests
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },
  {
    ignores: ["dist/", "node_modules/", "scripts/"],
  },
);
