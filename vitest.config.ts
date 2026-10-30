import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.{ts,tsx}"],
      thresholds: {
        lines: 95,
        functions: 99,
        branches: 91,
        statements: 96,
        autoUpdate: (threshold, previous) =>
          Math.max(previous, Math.floor(threshold) - 1),
      },
    },
    environment: "happy-dom",
    env: { NODE_ENV: "production" },
    globals: true,
  },
});
