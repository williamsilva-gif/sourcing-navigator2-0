import { defineConfig } from "vitest/config";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallel: false,
    environment: "node",
  },
});
