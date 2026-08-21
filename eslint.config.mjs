import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [".husky/", "coverage/", "main.js", "node_modules/", "styles.css"],
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["scripts/**/*.mjs"],
    rules: {
      // Build and CI scripts run in Node.js, not in an Obsidian renderer window.
      "obsidianmd/prefer-window-timers": "off",
    },
  },
  {
    files: ["src/settings.ts"],
    rules: {
      // Keep the imperative settings API for the declared Obsidian 1.7.2 minimum.
      "@typescript-eslint/no-deprecated": "off",
      "obsidianmd/settings-tab/prefer-setting-definitions": "off",
      // Vault Shell, WSL, and Ubuntu are proper names in the settings copy.
      "obsidianmd/ui/sentence-case": "off",
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
);
