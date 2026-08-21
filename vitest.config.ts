import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/terminal/session.ts"],
    },
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
