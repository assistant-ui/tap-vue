import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    env: { NODE_ENV: "production" },
  },
});
