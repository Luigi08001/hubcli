/**
 * hscli · ESLint configuration.
 *
 * Strict on unused imports / `any` / console.log in source; relaxed
 * for tests where mocking + ad-hoc assertions are normal. The
 * `scripts/` directory is excluded because it hosts a mix of
 * throw-away probes, Python helpers, and release tooling that
 * doesn't benefit from the same constraints as the shipped CLI.
 */
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
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 20,
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Unused vars — prefix with _ to intentionally opt out.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // `any` is a warning (not error) because HubSpot API shapes are dynamic,
      // and over-constraining tooling code hurts more than it helps.
      "@typescript-eslint/no-explicit-any": "warn",
      // Source code uses `printResult()` / `printError()` as the output layer,
      // not `console.log`. Reserve console for warn/error diagnostic paths.
      "no-console": ["error", { allow: ["warn", "error"] }],
      // Prefer strict equality — hscli deals with HubSpot IDs (strings that
      // look like numbers), so coercion has bitten us before.
      "eqeqeq": ["error", "always"],
      // `let` → `const` when never reassigned. Catches noise from quick edits.
      "prefer-const": "error",
    },
  },
  {
    // Relax for tests — mocking + inline fixtures are normal here.
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
